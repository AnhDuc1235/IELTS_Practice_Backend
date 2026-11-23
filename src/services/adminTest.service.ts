import { prisma } from "../utils/prisma";
import { QuestionType, Skill, TestCategory, TestStatus } from "../generated/prisma/client";
import { CreateTestDto, UpdateTestDto } from "../types/adminTest.type";

const toSkill = (s?: string): Skill => {
  const upper = (s || "READING").toUpperCase();
  if (upper in Skill) return upper as Skill;
  return Skill.READING;
};

const toCategory = (c?: string): TestCategory => {
  const upper = (c || "ACADEMIC").toUpperCase();
  if (upper.includes("GENERAL")) return TestCategory.GENERAL_TRAINING;
  return TestCategory.ACADEMIC;
};

const toStatus = (st?: string): TestStatus => {
  const upper = (st || "DRAFT").toUpperCase();
  if (upper in TestStatus) return upper as TestStatus;
  return TestStatus.DRAFT;
};

export const adminTestService = {
  // Lấy danh sách đề thi (cho Admin xem tất cả các trạng thái DRAFT / PUBLISHED)
  async getTests(params?: { skill?: string; category?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Number(params?.limit) || 20);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.skill) where.skill = toSkill(params.skill);
    if (params?.category) where.category = toCategory(params.category);
    if (params?.search) {
      where.title = { contains: params.search };
    }

    const [tests, total] = await Promise.all([
      prisma.test.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          parts: {
            include: {
              questionGroups: {
                include: {
                  questions: { select: { id: true } },
                },
              },
            },
          },
        },
      }),
      prisma.test.count({ where }),
    ]);

    const mapped = tests.map((t) => {
      let questionsCount = 0;
      t.parts.forEach((p) => p.questionGroups.forEach((g) => (questionsCount += g.questions.length)));

      return {
        id: t.id,
        title: t.title,
        skill: t.skill,
        category: t.category,
        status: t.status,
        durationMinutes: t.durationMinutes,
        questionsCount: questionsCount || (t.skill === Skill.SPEAKING ? 9 : 40),
        updatedAt: t.updatedAt,
        createdAt: t.createdAt,
      };
    });

    return { tests: mapped, total };
  },

  // Lấy chi tiết đề thi theo ID
  async getTestById(id: bigint) {
    const test = await prisma.test.findUnique({
      where: { id },
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
                    options: { orderBy: { label: "asc" } },
                    answers: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!test) throw new Error("Test not found");
    return test;
  },

  // Tạo đề thi mới (Hỗ trợ Listening, Speaking, Reading, Writing đa dạng part & dạng câu hỏi)
  async createTest(userId: string, data: CreateTestDto) {
    const skill = toSkill(data.skill as string);
    const category = toCategory(data.category as string);
    const status = toStatus(data.status as string);

    // 1. Tạo Test chính
    const test = await prisma.test.create({
      data: {
        title: data.title || "Untitled IELTS Test",
        skill,
        category,
        status,
        durationMinutes: data.durationMinutes || (skill === Skill.LISTENING ? 30 : skill === Skill.SPEAKING ? 15 : 60),
        description: data.description ?? null,
        level: data.level ?? "B2-C1",
        createdBy: userId,
      },
    });

    // 2. Nếu có parts truyền lên thì tạo chi tiết từng Part -> QuestionGroup -> Questions
    if (data.parts && data.parts.length > 0) {
      for (const p of data.parts) {
        const audioUrl = p.audioUrl ? p.audioUrl : (p.partNo === 1 ? data.audioUrl ?? null : null);
        const part = await prisma.testPart.create({
          data: {
            testId: test.id,
            partNo: p.partNo,
            title: p.title || `Part ${p.partNo}`,
            instruction: p.instruction ?? null,
            content: p.content ?? null,
            transcript: p.transcript ?? null,
            audioUrl: audioUrl ?? null,
            imageUrl: p.imageUrl ?? null,
          },
        });

        if (p.questionGroups && p.questionGroups.length > 0) {
          for (const g of p.questionGroups) {
            const group = await prisma.questionGroup.create({
              data: {
                partId: part.id,
                groupNo: g.groupNo,
                questionType: (g.questionType as QuestionType) || QuestionType.MCQ_SINGLE,
                instruction: g.instruction ?? null,
                sharedContent: g.sharedContent ?? null,
              },
            });

            if (g.questions && g.questions.length > 0) {
              for (const q of g.questions) {
                const createdQ = await prisma.question.create({
                  data: {
                    groupId: group.id,
                    questionNo: q.questionNo,
                    content: q.content,
                    explanation: q.explanation ?? null,
                    transcriptLocation: q.transcriptLocation ?? null,
                    points: q.points || 1.0,
                  },
                });

                if (q.options && q.options.length > 0) {
                  await prisma.questionOption.createMany({
                    data: q.options.map((opt) => ({
                      questionId: createdQ.id,
                      label: opt.label,
                      content: opt.content,
                    })),
                  });
                }

                if (q.answers && q.answers.length > 0) {
                  await prisma.questionAnswer.createMany({
                    data: q.answers.map((ans) => ({
                      questionId: createdQ.id,
                      answerText: ans.answerText,
                    })),
                  });
                }
              }
            }
          }
        }
      }
    } else {
      // Nếu tạo đề nhanh từ form đơn giản, tự động tạo khung các Part theo kỹ năng
      const defaultPartCount = skill === Skill.SPEAKING ? 3 : skill === Skill.WRITING ? 2 : 4;
      for (let i = 1; i <= defaultPartCount; i++) {
        await prisma.testPart.create({
          data: {
            testId: test.id,
            partNo: i,
            title: `Part ${i}`,
            content: (i === 1 ? data.content : null) ?? null,
            audioUrl: (i === 1 && skill === Skill.LISTENING ? data.audioUrl : null) ?? null,
          },
        });
      }
    }

    return test;
  },

  // Cập nhật đề thi
  async updateTest(id: bigint, data: UpdateTestDto) {
    const updateData: any = {};
    if (data.title) updateData.title = data.title;
    if (data.skill) updateData.skill = toSkill(data.skill as string);
    if (data.category) updateData.category = toCategory(data.category as string);
    if (data.status) updateData.status = toStatus(data.status as string);
    if (data.durationMinutes) updateData.durationMinutes = data.durationMinutes;

    const test = await prisma.test.update({
      where: { id },
      data: updateData,
    });

    // Cập nhật toàn bộ Parts nếu frontend gửi parts
    if (data.parts && data.parts.length > 0) {
      await prisma.testPart.deleteMany({ where: { testId: id } });

      for (const p of data.parts) {
        const audioUrl = p.audioUrl ? p.audioUrl : (p.partNo === 1 ? data.audioUrl ?? null : null);
        const part = await prisma.testPart.create({
          data: {
            testId: id,
            partNo: p.partNo,
            title: p.title || `Part ${p.partNo}`,
            instruction: p.instruction ?? null,
            content: p.content ?? null,
            transcript: p.transcript ?? null,
            audioUrl: audioUrl ?? null,
            imageUrl: p.imageUrl ?? null,
          },
        });

        if (p.questionGroups && p.questionGroups.length > 0) {
          for (const g of p.questionGroups) {
            const group = await prisma.questionGroup.create({
              data: {
                partId: part.id,
                groupNo: g.groupNo,
                questionType: (g.questionType as QuestionType) || QuestionType.MCQ_SINGLE,
                instruction: g.instruction ?? null,
                sharedContent: g.sharedContent ?? null,
              },
            });

            if (g.questions && g.questions.length > 0) {
              for (const q of g.questions) {
                const createdQ = await prisma.question.create({
                  data: {
                    groupId: group.id,
                    questionNo: q.questionNo,
                    content: q.content,
                    explanation: q.explanation ?? null,
                    transcriptLocation: q.transcriptLocation ?? null,
                    points: q.points || 1.0,
                  },
                });

                if (q.options && q.options.length > 0) {
                  await prisma.questionOption.createMany({
                    data: q.options.map((opt) => ({
                      questionId: createdQ.id,
                      label: opt.label,
                      content: opt.content,
                    })),
                  });
                }

                if (q.answers && q.answers.length > 0) {
                  await prisma.questionAnswer.createMany({
                    data: q.answers.map((ans) => ({
                      questionId: createdQ.id,
                      answerText: ans.answerText,
                    })),
                  });
                }
              }
            }
          }
        }
      }
    } else if (data.questions && data.questions.length > 0) {
      for (const q of data.questions) {
        if (q.id) {
          // Update question content
          await prisma.question.updateMany({
            where: { id: BigInt(q.id) },
            data: { content: q.content },
          });

          if (q.answerText) {
            await prisma.questionAnswer.deleteMany({ where: { questionId: BigInt(q.id) } });
            await prisma.questionAnswer.create({
              data: { questionId: BigInt(q.id), answerText: q.answerText },
            });
          }
        }
      }
    }

    return test;
  },

  // Xóa đề thi (Cascade parts, groups, questions)
  async deleteTest(id: bigint) {
    await prisma.test.delete({ where: { id } });
    return true;
  },
};
