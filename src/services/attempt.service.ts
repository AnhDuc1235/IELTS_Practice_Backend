import { prisma } from "../utils/prisma";
import { AttemptStatus, QuestionType, Skill } from "../generated/prisma/client";
import { StartAttemptDto, SaveProgressDto, SubmitAttemptDto } from "../types/attempt.type";
import { calculateBandScore } from "../utils/bandScore";
import { aiGraderService } from "./aiGrader.service";

export const attemptService = {
  // Bắt đầu làm bài thi (Tạo, tái sử dụng hoặc làm lại từ đầu với giới hạn 5 bản lưu FIFO)
  async startAttempt(userId: string, data: StartAttemptDto) {
    const testId = BigInt(data.testId);
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new Error("Test not found");

    const isRestart = Boolean(data.restart || data.forceNew);

    // 1. Nếu người dùng chọn "Làm lại từ đầu" (restart: true)
    if (isRestart) {
      await prisma.attempt.updateMany({
        where: { userId, testId, status: AttemptStatus.IN_PROGRESS },
        data: { status: AttemptStatus.ABANDONED },
      });
    } else {
      // 2. Tìm bài làm dở gần nhất nếu không chọn restart
      const existing = await prisma.attempt.findFirst({
        where: { userId, testId, status: AttemptStatus.IN_PROGRESS },
        orderBy: { lastSavedAt: "desc" },
      });

      if (existing) {
        return {
          attemptId: existing.id,
          testId: test.id,
          title: test.title,
          skill: test.skill,
          durationMinutes: existing.durationMinutes ?? data.customDurationMinutes ?? test.durationMinutes ?? 60,
          startedAt: existing.startedAt,
          lastSavedAt: existing.lastSavedAt,
          currentPartNo: existing.currentPartNo,
          timeSpentSeconds: existing.timeSpentSeconds,
          isResumed: true,
        };
      }
    }

    // 3. Cơ chế xoay vòng tối đa 5 lần lưu tiến trình trong 1 đề (FIFO - cũ nhất bị xóa khi có cái mới)
    const savedAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        testId,
        status: { in: [AttemptStatus.IN_PROGRESS, AttemptStatus.ABANDONED] },
      },
      orderBy: { startedAt: "asc" }, // Cũ nhất trước
    });

    if (savedAttempts.length >= 5) {
      const deleteCount = savedAttempts.length - 4; // Nhường chỗ cho bản ghi mới để tổng <= 5
      const toDelete = savedAttempts.slice(0, deleteCount);
      for (const item of toDelete) {
        await prisma.attemptAnswer.deleteMany({ where: { attemptId: item.id } });
        await prisma.annotation.deleteMany({ where: { attemptId: item.id } });
        await prisma.attempt.delete({ where: { id: item.id } });
      }
    }

    // Xác định thời lượng phiên làm bài (thời gian tùy chọn hoặc theo thời gian mặc định của đề)
    const targetDurationMinutes = data.customDurationMinutes !== undefined
      ? data.customDurationMinutes
      : (test.durationMinutes || 60);

    // 4. Tạo bản ghi bài thi mới
    const newAttempt = await prisma.attempt.create({
      data: {
        userId,
        testId,
        status: AttemptStatus.IN_PROGRESS,
        durationMinutes: targetDurationMinutes,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        currentPartNo: 1,
      },
    });

    return {
      attemptId: newAttempt.id,
      testId: test.id,
      title: test.title,
      skill: test.skill,
      durationMinutes: targetDurationMinutes,
      startedAt: newAttempt.startedAt,
      isResumed: false,
    };
  },

  // Lấy thông tin các lần lưu tiến trình dở dang của đề thi (hỗ trợ Frontend hiển thị Modal hỏi Resume / Restart)
  async getSavedProgress(userId: string, testIdStr: string | number) {
    const testId = BigInt(testIdStr);
    const attempts = await prisma.attempt.findMany({
      where: { userId, testId, status: AttemptStatus.IN_PROGRESS },
      orderBy: { lastSavedAt: "desc" },
      take: 5,
      include: {
        _count: {
          select: { answers: true },
        },
      },
    });

    return {
      hasInProgress: attempts.length > 0,
      count: attempts.length,
      maxAllowed: 5,
      savedAttempts: attempts.map((a) => ({
        attemptId: a.id.toString(),
        testId: a.testId.toString(),
        startedAt: a.startedAt,
        lastSavedAt: a.lastSavedAt,
        durationMinutes: a.durationMinutes,
        timeSpentSeconds: a.timeSpentSeconds,
        currentPartNo: a.currentPartNo,
        answeredCount: a._count.answers,
      })),
    };
  },

  // Reset bài thi đang làm dở về ban đầu (xóa bài làm, giữ nguyên attempt)
  async resetAttempt(userId: string, attemptId: bigint) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId, status: AttemptStatus.IN_PROGRESS },
    });
    if (!attempt) throw new Error("Attempt not found or not in progress");

    await prisma.attemptAnswer.deleteMany({ where: { attemptId } });
    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        timeSpentSeconds: 0,
        currentPartNo: 1,
        lastSavedAt: new Date(),
      },
    });

    return { success: true, message: "Bài thi đã được đặt lại từ đầu" };
  },

  // Autosave tiến trình làm bài dở dang
  async saveProgress(userId: string, attemptId: bigint, data: SaveProgressDto) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId, status: AttemptStatus.IN_PROGRESS },
    });
    if (!attempt) throw new Error("Attempt not found or already submitted");

    // 1. Cập nhật attempt
    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        lastSavedAt: new Date(),
        ...(data.timeSpentSeconds !== undefined && { timeSpentSeconds: data.timeSpentSeconds }),
        ...(data.currentPartNo !== undefined && { currentPartNo: data.currentPartNo }),
      },
    });

    // 2. Lưu các câu trả lời tạm thời
    if (data.answers && data.answers.length > 0) {
      // Lấy danh sách câu hỏi của đề thi để map an toàn giữa questionId và questionNo
      const testQuestions = await prisma.question.findMany({
        where: { group: { part: { testId: attempt.testId } } },
        select: { id: true, questionNo: true },
      });
      const validIdSet = new Set(testQuestions.map((q) => q.id.toString()));
      const qNoToId = new Map(testQuestions.map((q) => [q.questionNo, q.id]));

      for (const ans of data.answers) {
        const rawStr = ans.questionId?.toString();
        let questionId: bigint | null = null;
        if (rawStr && validIdSet.has(rawStr)) {
          questionId = BigInt(rawStr);
        } else {
          const byNo = qNoToId.get(Number(ans.questionId));
          if (byNo !== undefined) questionId = byNo;
        }

        if (!questionId) continue;

        await prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          create: {
            attemptId,
            questionId,
            answerText: ans.answerText ?? null,
            audioUrl: ans.audioUrl ?? null,
            transcript: ans.transcript ?? null,
          },
          update: {
            answerText: ans.answerText ?? null,
            audioUrl: ans.audioUrl ?? null,
            transcript: ans.transcript ?? null,
          },
        });
      }
    }

    return { lastSavedAt: new Date() };
  },

  // Lấy toàn bộ nội dung đề để làm bài (Giấu đáp án đúng, khôi phục câu trả lời dở)
  async getExamContent(attemptId: bigint, userId: string) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        test: {
          include: {
            parts: {
              orderBy: { partNo: "asc" },
              include: {
                questionGroups: {
                  orderBy: { groupNo: "asc" },
                  include: {
                    questions: {
                      orderBy: { questionNo: "asc" },
                      select: {
                        id: true,
                        groupId: true,
                        questionNo: true,
                        content: true,
                        points: true,
                        options: {
                          select: { id: true, label: true, content: true },
                          orderBy: { label: "asc" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) throw new Error("Attempt not found or unauthorized");

    // Map câu trả lời đã lưu
    const savedAnswers = attempt.answers.map((a) => ({
      questionId: a.questionId,
      answerText: a.answerText,
      audioUrl: a.audioUrl,
      transcript: a.transcript,
    }));

    const durationMinutes = attempt.durationMinutes ?? attempt.test.durationMinutes ?? 60;

    return {
      attemptId: attempt.id,
      status: attempt.status,
      durationMinutes,
      timeSpentSeconds: attempt.timeSpentSeconds,
      currentPartNo: attempt.currentPartNo,
      test: {
        id: attempt.test.id,
        title: attempt.test.title,
        skill: attempt.test.skill,
        category: attempt.test.category,
        durationMinutes,
        parts: attempt.test.parts,
      },
      savedAnswers,
    };
  },

  // Nộp bài và chấm điểm (Hỗ trợ AI cho Listening, Speaking và Writing)
  async submitAttempt(attemptId: bigint, userId: string, data: SubmitAttemptDto) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId, status: AttemptStatus.IN_PROGRESS },
      include: { test: true },
    });
    if (!attempt) throw new Error("Attempt not found or already submitted");

    // 1. Lưu answers cuối cùng nếu có gửi lên
    if (data.answers && data.answers.length > 0) {
      const testQuestions = await prisma.question.findMany({
        where: { group: { part: { testId: attempt.testId } } },
        select: { id: true, questionNo: true },
      });
      const validIdSet = new Set(testQuestions.map((q) => q.id.toString()));
      const qNoToId = new Map(testQuestions.map((q) => [q.questionNo, q.id]));

      for (const ans of data.answers) {
        const rawStr = ans.questionId?.toString();
        let questionId: bigint | null = null;
        if (rawStr && validIdSet.has(rawStr)) {
          questionId = BigInt(rawStr);
        } else {
          const byNo = qNoToId.get(Number(ans.questionId));
          if (byNo !== undefined) questionId = byNo;
        }

        if (!questionId) continue;

        await prisma.attemptAnswer.upsert({
          where: { attemptId_questionId: { attemptId, questionId } },
          create: {
            attemptId,
            questionId,
            answerText: ans.answerText ?? null,
            audioUrl: ans.audioUrl ?? null,
            transcript: ans.transcript ?? null,
          },
          update: {
            answerText: ans.answerText ?? null,
            audioUrl: ans.audioUrl ?? null,
            transcript: ans.transcript ?? null,
          },
        });
      }
    }

    const isAutoGraded = attempt.test.skill === Skill.READING || attempt.test.skill === Skill.LISTENING;

    if (isAutoGraded) {
      // 2a. Chấm điểm Reading & Listening (kết hợp so khớp CSDL + AI Listening thông minh)
      const questions = await prisma.question.findMany({
        where: { group: { part: { testId: attempt.testId } } },
        include: { answers: true },
      });

      const userAnswers = await prisma.attemptAnswer.findMany({ where: { attemptId } });
      const userAnsMap = new Map(userAnswers.map((a) => [a.questionId.toString(), a]));

      let correctCount = 0;
      const totalQuestions = questions.length;

      for (const q of questions) {
        const userAns = userAnsMap.get(q.id.toString());

        // Lấy câu trả lời của thí sinh (bỏ dấu cách thừa, chuyển chữ thường)
        const userText = (userAns?.answerText || "").trim().toLowerCase();

        // Lấy danh sách đáp án đúng của câu hỏi trong CSDL
        const correctAnswers = q.answers.map((a) => a.answerText.trim().toLowerCase());

        // Đúng nếu câu trả lời của thí sinh trùng với 1 trong các đáp án đúng
        const isCorrect = userText !== "" && correctAnswers.includes(userText);

        if (isCorrect) correctCount++;

        if (userAns) {
          await prisma.attemptAnswer.update({
            where: { id: userAns.id },
            data: { isCorrect, scoreEarned: isCorrect ? Number(q.points) : 0 },
          });
        }
      }

      const bandScore = calculateBandScore(correctCount, attempt.test.skill, attempt.test.category);

      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.GRADED,
          submittedAt: new Date(),
          timeSpentSeconds: data.timeSpentSeconds ?? attempt.timeSpentSeconds,
          correctCount,
          totalQuestions,
          bandScore,
        },
      });

      return { attemptId, correctCount, totalQuestions, bandScore, timeSpentSeconds: data.timeSpentSeconds };
    } else {
      // 2b. Chấm điểm Speaking & Writing bằng AI (Speech to Text + 4 tiêu chí IELTS)
      // Lấy toàn bộ danh sách câu hỏi của đề thi để đảm bảo câu nào bỏ trống cũng được tính điểm 0
      const allTestQuestions = await prisma.question.findMany({
        where: { group: { part: { testId: attempt.testId } } },
        include: { group: { include: { part: true } } },
      });
      const totalTestQuestions = allTestQuestions.length;

      // Danh sách câu trả lời thí sinh đã nộp
      const userAnswers = await prisma.attemptAnswer.findMany({
        where: { attemptId },
        include: { question: true },
      });
      const userAnsMap = new Map(userAnswers.map((a) => [a.questionId.toString(), a]));

      let totalBand = 0;
      let answeredCount = 0;

      for (const q of allTestQuestions) {
        let ans = userAnsMap.get(q.id.toString());

        // Nếu câu này thí sinh không làm (chưa có câu trả lời): tạo bản ghi rỗng
        if (!ans) {
          ans = await prisma.attemptAnswer.create({
            data: {
              attemptId,
              questionId: q.id,
              answerText: null,
              audioUrl: null,
              transcript: null,
            },
            include: { question: true },
          });
        }

        if (attempt.test.skill === Skill.SPEAKING) {
          const hasSpoken = Boolean((ans.audioUrl && ans.audioUrl.trim()) || (ans.transcript && ans.transcript.trim()));
          const res = await aiGraderService.gradeSpeakingAnswer(ans.id, q.content, ans.audioUrl, ans.transcript);
          const score = res.overallBand !== undefined ? Number(res.overallBand) : 0;
          totalBand += score;
          if (hasSpoken && score > 0) {
            answeredCount++;
          }
        } else if (attempt.test.skill === Skill.WRITING) {
          const text = (ans.answerText || "").trim();
          const hasWritten = text.length > 0;
          const res = await aiGraderService.gradeWritingAnswer(ans.id, q.content, ans.answerText || "");
          const score = res.overallBand !== undefined ? Number(res.overallBand) : 0;
          totalBand += score;
          if (hasWritten && score > 0) {
            answeredCount++;
          }
        }
      }

      // Điểm tổng: Nếu bỏ trống toàn bộ thì 0 điểm. Nếu có làm, trung bình chia cho tổng số câu của đề thi
      const bandScore = totalTestQuestions > 0 && answeredCount > 0
        ? Number((totalBand / totalTestQuestions).toFixed(1))
        : 0;

      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.GRADED,
          submittedAt: new Date(),
          timeSpentSeconds: data.timeSpentSeconds ?? attempt.timeSpentSeconds,
          totalQuestions: totalTestQuestions,
          correctCount: answeredCount,
          bandScore,
        },
      });

      return { attemptId, bandScore, status: AttemptStatus.GRADED };
    }
  },

  // Kết quả thi tổng quan (Hỗ trợ cấu trúc riêng cho cả Listening và Speaking)
  async getResult(attemptId: bigint, userId: string) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        test: {
          include: {
            parts: {
              include: {
                questionGroups: {
                  include: {
                    questions: {
                      include: {
                        answers: true,
                        attemptAnswers: {
                          where: { attemptId },
                          include: { aiFeedbacks: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        answers: {
          include: {
            aiFeedbacks: true,
            question: { include: { answers: true, group: { include: { part: true } } } },
          },
        },
      },
    });

    if (!attempt) throw new Error("Result not found or unauthorized");

    const totalQuestions = attempt.totalQuestions || 40;
    const correctCount = attempt.correctCount || 0;
    const answeredCount = attempt.answers.filter((a) => a.answerText || a.audioUrl).length;
    const skippedCount = Math.max(0, totalQuestions - answeredCount);
    const incorrectCount = Math.max(0, totalQuestions - correctCount - skippedCount);
    const accuracy = answeredCount > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    // Định dạng hh:mm:ss
    const s = attempt.timeSpentSeconds || 0;
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const timeSpentFormatted = `${hh > 0 ? `${hh}:` : ""}${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;

    // Chi tiết câu hỏi cho kết quả Reading & Listening
    const questionsList = attempt.answers.map((a) => ({
      qNo: a.question.questionNo,
      partNo: a.question.group.part.partNo,
      questionType: a.question.group.questionType,
      questionSummary: a.question.content,
      userAnswer: a.answerText || "",
      correctAnswer: a.question.answers[0]?.answerText || "",
      isCorrect: a.isCorrect === true,
    }));

    // Chi tiết câu hỏi cho kết quả Speaking
    const speakingReviews = attempt.test.parts.map((p) => ({
      partNo: p.partNo,
      partTitle: p.title || `Part ${p.partNo}`,
      questions: p.questionGroups.flatMap((g) =>
        g.questions.map((q) => {
          const ans = q.attemptAnswers[0];
          const fb = ans?.aiFeedbacks[0];
          const hasSpoken = Boolean((ans?.audioUrl && ans.audioUrl.trim()) || (ans?.transcript && ans.transcript.trim()));
          return {
            qNo: q.questionNo,
            topic: q.content,
            prompt: q.content,
            audioUrl: ans?.audioUrl || null,
            transcript: ans?.transcript || null,
            feedback: fb?.feedback
              ? (fb.feedback as any).summary
              : hasSpoken
              ? "Đã hoàn thành bài nói."
              : "Thí sinh không làm câu hỏi này (bỏ trống).",
            bandScore: fb?.overallBand !== undefined ? Number(fb.overallBand) : 0,
          };
        }),
      ),
    }));

    // Chi tiết bài viết cho kết quả Writing
    const writingReviews = attempt.test.parts.map((p) => {
      const q = p.questionGroups[0]?.questions[0];
      const ans = q?.attemptAnswers[0];
      const fb = ans?.aiFeedbacks[0];
      const text = (ans?.answerText || "").trim();
      const words = text ? text.split(/\s+/).length : 0;
      return {
        taskNo: p.partNo,
        taskTitle: p.title || `Task ${p.partNo}`,
        prompt: q?.content || p.content || "",
        imageUrl: p.imageUrl || null,
        userEssay: ans?.answerText || "",
        wordCount: words,
        minWordsRequired: p.partNo === 1 ? 150 : 250,
        bandScore: fb?.overallBand !== undefined ? Number(fb.overallBand) : (words > 0 ? Number(attempt.bandScore || 0) : 0),
        criteriaScores: fb?.criteriaScores || null,
        feedback: fb?.feedback || (words === 0 ? { summary: "Thí sinh không làm bài (bỏ trống bài viết)." } : null),
      };
    });

    // Tính toán các tiêu chí Speaking / Writing để phục vụ Frontend
    let sumFluency = 0, sumLexical = 0, sumGrammar = 0, sumPron = 0, fbCount = 0;
    for (const ans of attempt.answers) {
      const fb = ans.aiFeedbacks?.[0];
      if (fb && fb.criteriaScores) {
        const cs = fb.criteriaScores as any;
        sumFluency += Number(cs.fluencyCoherence || cs.fluency || 0);
        sumLexical += Number(cs.lexicalResource || cs.lexical || 0);
        sumGrammar += Number(cs.grammaticalRange || cs.grammar || 0);
        sumPron += Number(cs.pronunciation || 0);
        fbCount++;
      }
    }
    const defaultBand = attempt.bandScore ? Number(attempt.bandScore) : 0;
    const criteria = {
      fluency: fbCount > 0 ? Number((sumFluency / fbCount).toFixed(1)) : defaultBand,
      lexical: fbCount > 0 ? Number((sumLexical / fbCount).toFixed(1)) : defaultBand,
      grammar: fbCount > 0 ? Number((sumGrammar / fbCount).toFixed(1)) : defaultBand,
      pronunciation: fbCount > 0 ? Number((sumPron / fbCount).toFixed(1)) : defaultBand,
    };

    return {
      attemptId: attempt.id,
      testTitle: attempt.test.title,
      test: {
        id: attempt.test.id,
        title: attempt.test.title,
        skill: attempt.test.skill,
        category: attempt.test.category,
      },
      skill: attempt.test.skill,
      category: attempt.test.category,
      durationMinutes: attempt.durationMinutes ?? attempt.test.durationMinutes ?? 60,
      totalQuestions,
      correctCount,
      incorrectCount,
      skippedCount,
      accuracy,
      timeSpentSeconds: attempt.timeSpentSeconds,
      timeSpentFormatted,
      bandScore: attempt.bandScore ? Number(attempt.bandScore) : 0,
      criteria,
      questions: questionsList,
      readingQuestions: questionsList,
      listeningQuestions: questionsList,
      speakingReviews,
      writingReviews,
    };
  },

  // Xem chi tiết đáp án & lời giải (Review)
  async getReview(attemptId: bigint, userId: string) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        test: {
          include: {
            parts: {
              orderBy: { partNo: "asc" },
              include: {
                questionGroups: {
                  orderBy: { groupNo: "asc" },
                  include: {
                    questions: {
                      orderBy: { questionNo: "asc" },
                      include: {
                        options: true,
                        answers: true,
                        attemptAnswers: { where: { attemptId } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new Error("Review not found or unauthorized");

    const parts = attempt.test.parts.map((part) => ({
      partNo: part.partNo,
      title: part.title,
      content: part.content,
      transcript: part.transcript,
      audioUrl: part.audioUrl,
      questionGroups: part.questionGroups.map((group) => ({
        groupNo: group.groupNo,
        questionType: group.questionType,
        instruction: group.instruction,
        sharedContent: group.sharedContent,
        questions: group.questions.map((q) => {
          const userAns = q.attemptAnswers[0];
          let status: "CORRECT" | "INCORRECT" | "SKIPPED" = "SKIPPED";
          if (userAns && (userAns.answerText || userAns.audioUrl)) {
            status = userAns.isCorrect ? "CORRECT" : "INCORRECT";
          }

          return {
            id: q.id,
            questionNo: q.questionNo,
            content: q.content,
            points: q.points,
            explanation: q.explanation,
            transcriptLocation: q.transcriptLocation,
            options: q.options,
            correctAnswers: q.answers.map((a) => a.answerText),
            userAnswer: userAns?.answerText || userAns?.audioUrl || null,
            status,
          };
        }),
      })),
    }));

    return {
      attemptId: attempt.id,
      testTitle: attempt.test.title,
      skill: attempt.test.skill,
      category: attempt.test.category,
      parts,
    };
  },

  // Lấy lịch sử làm bài thi
  async getHistory(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [attempts, total] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] } },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
        include: {
          test: { select: { id: true, title: true, skill: true, category: true } },
        },
      }),
      prisma.attempt.count({
        where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] } },
      }),
    ]);

    return {
      attempts: attempts.map((a) => ({
        id: a.id,
        testId: a.test.id,
        testTitle: a.test.title,
        skill: a.test.skill,
        category: a.test.category,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        timeSpentSeconds: a.timeSpentSeconds,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        bandScore: a.bandScore ? Number(a.bandScore) : 0,
      })),
      total,
    };
  },

  // Lấy bài làm mới nhất
  async getRecent(userId: string) {
    const attempt = await prisma.attempt.findFirst({
      where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] } },
      orderBy: { submittedAt: "desc" },
      include: {
        test: { select: { id: true, title: true, skill: true, category: true } },
      },
    });

    if (!attempt) return null;

    return {
      id: attempt.id,
      testId: attempt.test.id,
      testTitle: attempt.test.title,
      skill: attempt.test.skill,
      category: attempt.test.category,
      submittedAt: attempt.submittedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      correctCount: attempt.correctCount,
      totalQuestions: attempt.totalQuestions,
      bandScore: attempt.bandScore ? Number(attempt.bandScore) : 0,
    };
  },
};
