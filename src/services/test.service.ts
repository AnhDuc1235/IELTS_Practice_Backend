import { AttemptStatus, Prisma, QuestionType, Skill, TestCategory, TestStatus } from "../generated/prisma/client";
import { errorType } from "../types/error";
import { historyQuery, submitTestBody, testQuery } from "../types/test.type";
import { prisma } from "../utils/prisma";
import { calculateBandScore } from "../utils/bandScore";

/*
 * Dịch vụ xử lý nội dung đề thi IELTS cho học viên.
 * Các nguyên tắc áp dụng toàn hệ thống:
 *  - Chỉ hiển thị các đề thi có trạng thái PUBLISHED (Đã xuất bản)
 *  - Tuyệt đối không chọn trường QuestionAnswer (đáp án đúng) và explanation (giải thích) khi học viên đang làm bài
 *  - Dữ liệu luôn được sắp xếp theo thứ tự partNo / groupNo / questionNo
 */

// Hàm tạo lỗi 404 Not Found
const notFound = (what: string) => {
    const error = new Error(`${what} không tồn tại`) as errorType;
    error.statusCode = 404;
    return error;
};

// Hàm tạo lỗi 409 Conflict
const conflict = (message: string) => {
    const error = new Error(message) as errorType;
    error.statusCode = 409;
    return error;
};

const isSkill = (value: string): value is Skill => Object.values(Skill).includes(value as Skill);
const isTestCategory = (value: string): value is TestCategory => Object.values(TestCategory).includes(value as TestCategory);

// Các tùy chọn sắp xếp hợp lệ của ?sort= trên GET /test (mặc định là "newest" - mới nhất).
const testSortOrder = {
    newest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    title: { title: "asc" },
} satisfies Record<string, Prisma.TestOrderByWithRelationInput>;

const isTestSort = (value: string): value is keyof typeof testSortOrder => Object.keys(testSortOrder).includes(value);

// Các trường thông tin tóm tắt đề thi hiển thị trong danh sách và trang chi tiết.
const testSummarySelect = {
    id: true,
    skill: true,
    category: true,
    title: true,
    description: true,
    level: true,
    durationMinutes: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.TestSelect;

// Một câu trả lời được tính là "đã trả lời" khi có nội dung chữ hoặc file ghi âm.
const answeredFilter = {
    OR: [{ answerText: { not: null } }, { audioUrl: { not: null } }],
} satisfies Prisma.AttemptAnswerWhereInput;

// Các trường thông tin của lượt thi hiển thị tiến trình của thí sinh.
const attemptSummarySelect = {
    id: true,
    testId: true,
    status: true,
    startedAt: true,
    lastSavedAt: true,
    submittedAt: true,
    timeSpentSeconds: true,
    durationMinutes: true,
    currentPartNo: true,
    correctCount: true,
    totalQuestions: true,
    bandScore: true,
    _count: { select: { answers: { where: answeredFilter } } },
} satisfies Prisma.AttemptSelect;

type AttemptSummary = Prisma.AttemptGetPayload<{ select: typeof attemptSummarySelect }>;

// Các trường câu hỏi hiển thị cho thí sinh (ẩn explanation, transcriptLocation và đáp án đúng).
const questionSelect = {
    id: true,
    groupId: true,
    questionNo: true,
    content: true,
    points: true,
    options: {
        select: { id: true, label: true, content: true },
        orderBy: { label: "asc" },
    },
} satisfies Prisma.QuestionSelect;

// Chỉ lượt thi đã hoàn thành (SUBMITTED hoặc GRADED) mới được phép xem lại chi tiết và đáp án.
const FINISHED_STATUSES: AttemptStatus[] = [AttemptStatus.SUBMITTED, AttemptStatus.GRADED];

// Chuyển đổi dữ liệu lượt thi thành đối tượng tiến trình (progress) gửi về cho Frontend.
const toProgress = (attempt: AttemptSummary | null | undefined, liveTotalQuestions?: number) => {
    if (!attempt) {
        return null;
    }
    const { _count, ...rest } = attempt;
    return {
        ...rest,
        answeredCount: _count.answers,
        // totalQuestions chỉ được lưu trên attempt sau khi chấm điểm, nên dùng số đếm câu hỏi trực tiếp làm dự phòng
        totalQuestions: attempt.totalQuestions ?? liveTotalQuestions ?? null,
    };
};

// Các kỹ năng được chấm điểm tự động tức thì (Reading và Listening).
const AUTO_GRADED_SKILLS: Skill[] = [Skill.READING, Skill.LISTENING];

// Kiểu dữ liệu câu trả lời mà thí sinh gửi lên cho một câu hỏi
type AnswerInput = { answerText: string | null; audioUrl: string | null; transcript: string | null };

// Làm sạch chuỗi: chuỗi rỗng hoặc chỉ có khoảng trắng được coi là null (chưa trả lời).
const cleanText = (value?: string | null) => (value && value.trim() ? value.trim() : null);

// Chuẩn hóa chuỗi đáp án: bỏ khoảng trắng đầu/cuối, gom nhiều khoảng trắng liên tiếp và chuyển về chữ thường.
const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

// Đáp án trắc nghiệm nhiều lựa chọn (MCQ_MULTI): tập hợp các nhãn như "A,C". Chuẩn hóa thành danh sách nhãn đã sắp xếp.
const toLabelSet = (values: string[]) =>
    Array.from(new Set(values.flatMap((value) => value.split(",")).map(normalizeAnswer).filter(Boolean))).sort();

// Kiểm tra câu trả lời có đúng hay không so với danh sách đáp án được chấp nhận
const isAnswerCorrect = (type: QuestionType, given: string, keys: string[]) => {
    if (type === QuestionType.MCQ_MULTI) {
        const givenSet = toLabelSet([given]);
        const keySet = toLabelSet(keys);
        return givenSet.length === keySet.length && givenSet.every((label, index) => label === keySet[index]);
    }
    const normalized = normalizeAnswer(given);
    return keys.some((key) => normalizeAnswer(key) === normalized);
};

// Thêm mới hoặc cập nhật một bản ghi câu trả lời trong lượt thi (AttemptAnswer).
const saveAnswer = (
    tx: Prisma.TransactionClient,
    attemptId: bigint,
    questionId: bigint,
    data: AnswerInput & { isCorrect?: boolean | null; scoreEarned?: number },
) =>
    tx.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: { attemptId, questionId, ...data },
        update: data,
    });

export const testService = {
    // Lấy danh sách đề thi đã xuất bản. Kèm theo lượt thi mới nhất của thí sinh dưới dạng `progress` nếu có userId.
    async getTests(query: testQuery, userId?: string) {
        const { page, limit, search, sort = "newest" } = query;
        const skill = query.skill ? (query.skill.toUpperCase() as Skill) : undefined;
        let category: TestCategory | undefined = undefined;
        if (query.category) {
            const upper = query.category.toUpperCase();
            if (upper.includes("GENERAL")) category = TestCategory.GENERAL_TRAINING;
            else if (upper.includes("ACADEMIC")) category = TestCategory.ACADEMIC;
            else if (isTestCategory(upper)) category = upper as TestCategory;
            else throw new Error("Phân loại (category) không hợp lệ");
        }

        if (skill && !isSkill(skill)) {
            throw new Error("Kỹ năng (skill) không hợp lệ");
        }
        if (!isTestSort(sort)) {
            throw new Error("Kiểu sắp xếp (sort) không hợp lệ");
        }

        const where = {
            status: TestStatus.PUBLISHED,
            ...(skill && { skill }),
            ...(category && { category }),
            // Tìm kiếm theo tiêu đề (không phân biệt hoa thường)
            ...(search && { title: { contains: search } }),
        };

        const [tests, total] = await Promise.all([
            prisma.test.findMany({
                where,
                select: {
                    ...testSummarySelect,
                    // Đếm số phần thi và số lượt thi đã nộp
                    _count: { select: { parts: true, attempts: { where: { status: { in: FINISHED_STATUSES } } } } },
                    // Đếm tổng số câu hỏi từ các nhóm câu hỏi
                    parts: { select: { questionGroups: { select: { _count: { select: { questions: true } } } } } },
                },
                // id làm tiêu chí sắp xếp phụ để thứ tự luôn ổn định giữa các trang
                orderBy: [testSortOrder[sort], { id: "desc" }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.test.count({ where }),
        ]);

        // Gom lượt thi mới nhất của mỗi đề thi cho thí sinh
        const latestByTest = new Map<bigint, AttemptSummary>();
        if (userId && tests.length > 0) {
            const attempts = await prisma.attempt.findMany({
                where: { userId, testId: { in: tests.map((test) => test.id) } },
                select: attemptSummarySelect,
                orderBy: { startedAt: "desc" },
                distinct: ["testId"],
            });
            for (const attempt of attempts) {
                latestByTest.set(attempt.testId, attempt);
            }
        }

        return {
            tests: tests.map(({ _count, parts, ...test }) => ({
                ...test,
                partsCount: _count.parts,
                totalQuestions: parts.reduce(
                    (sum, part) => sum + part.questionGroups.reduce((groupSum, group) => groupSum + group._count.questions, 0),
                    0,
                ),
                attemptsCount: _count.attempts,
                progress: toProgress(latestByTest.get(test.id)),
            })),
            total,
        };
    },

    // Lấy thông tin chi tiết một đề thi đã xuất bản (thông tin chung + danh sách các phần thi).
    // Nếu có userId, trả về kèm lượt thi gần nhất dưới dạng `progress`, hoặc null nếu chưa từng bắt đầu.
    async getTest(testId: bigint, userId?: string) {
        const test = await prisma.test.findFirst({
            where: { id: testId, status: TestStatus.PUBLISHED },
            select: {
                ...testSummarySelect,
                parts: {
                    select: {
                        id: true,
                        partNo: true,
                        title: true,
                        questionGroups: {
                            select: {
                                questionType: true,
                                _count: { select: { questions: true } },
                            },
                        },
                    },
                    orderBy: { partNo: "asc" },
                },
            },
        });
        if (!test) {
            throw notFound("Đề thi");
        }
        if (!userId) {
            return { ...test, progress: null };
        }

        const [attempt, totalQuestions] = await Promise.all([
            prisma.attempt.findFirst({
                where: { userId, testId },
                select: attemptSummarySelect,
                orderBy: { startedAt: "desc" },
            }),
            prisma.question.count({ where: { group: { part: { testId } } } }),
        ]);

        return { ...test, progress: toProgress(attempt, totalQuestions) };
    },

    // Tìm lượt thi để làm tiếp: theo attemptId truyền vào, hoặc phiên IN_PROGRESS mới nhất, hoặc phiên mới nhất.
    // Luôn lọc theo userId để đảm bảo học viên không truy cập nhầm bài của người khác.
    async findUserAttempt(userId: string, testId: bigint, attemptId?: bigint) {
        const select = {
            id: true,
            status: true,
            startedAt: true,
            lastSavedAt: true,
            submittedAt: true,
            timeSpentSeconds: true,
            durationMinutes: true,
            currentPartNo: true,
            correctCount: true,
            totalQuestions: true,
            bandScore: true,
            answers: {
                select: {
                    questionId: true,
                    answerText: true,
                    audioUrl: true,
                    transcript: true,
                    scoreEarned: true,
                    isCorrect: true,
                    updatedAt: true,
                },
            },
        } satisfies Prisma.AttemptSelect;

        if (attemptId) {
            const attempt = await prisma.attempt.findFirst({
                where: { id: attemptId, userId, testId },
                select,
            });
            if (!attempt) {
                throw notFound("Lượt thi");
            }
            return attempt;
        }

        const inProgress = await prisma.attempt.findFirst({
            where: { userId, testId, status: AttemptStatus.IN_PROGRESS },
            select,
            orderBy: { startedAt: "desc" },
        });
        if (inProgress) {
            return inProgress;
        }

        return prisma.attempt.findFirst({
            where: { userId, testId },
            select,
            orderBy: { startedAt: "desc" },
        });
    },

    // Toàn bộ dữ liệu Frontend cần để hiển thị hoặc làm tiếp đề thi cho một học viên:
    // parts -> question groups -> questions -> options, gộp sẵn câu trả lời đã lưu của thí sinh ở từng câu hỏi,
    // kèm đối tượng `progress` (số câu đã làm, tổng số câu, và câu chưa làm đầu tiên để nhảy đến làm tiếp).
    async getTestContent(testId: bigint, userId: string, attemptId?: bigint) {
        const test = await prisma.test.findFirst({
            where: { id: testId, status: TestStatus.PUBLISHED },
            select: {
                ...testSummarySelect,
                parts: {
                    orderBy: { partNo: "asc" },
                    select: {
                        // Ẩn transcript để tránh lộ đáp án bài thi nghe
                        id: true,
                        partNo: true,
                        title: true,
                        instruction: true,
                        content: true,
                        audioUrl: true,
                        imageUrl: true,
                        questionGroups: {
                            orderBy: { groupNo: "asc" },
                            select: {
                                id: true,
                                groupNo: true,
                                questionType: true,
                                instruction: true,
                                sharedContent: true,
                                questions: { select: questionSelect, orderBy: { questionNo: "asc" } },
                            },
                        },
                    },
                },
            },
        });
        if (!test) {
            throw notFound("Đề thi");
        }

        const attempt = await testService.findUserAttempt(userId, testId, attemptId);

        // Tạo Map câu trả lời đã lưu theo questionId để tra cứu nhanh O(1)
        const answerByQuestion = new Map<bigint, NonNullable<typeof attempt>["answers"][number]>();
        for (const answer of attempt?.answers ?? []) {
            answerByQuestion.set(answer.questionId, answer);
        }
        const showGrading = attempt?.status === AttemptStatus.GRADED;

        let totalQuestions = 0;
        let answeredCount = 0;
        let resume: { partId: bigint; partNo: number; groupId: bigint; questionId: bigint } | null = null;

        const parts = test.parts.map((part) => ({
            ...part,
            questionGroups: part.questionGroups.map((group) => ({
                ...group,
                questions: group.questions.map((question) => {
                    const saved = answerByQuestion.get(question.id);
                    const answered = !!saved && (saved.answerText !== null || saved.audioUrl !== null);

                    totalQuestions++;
                    if (answered) {
                        answeredCount++;
                    } else if (!resume) {
                        resume = { partId: part.id, partNo: part.partNo, groupId: group.id, questionId: question.id };
                    }

                    return {
                        ...question,
                        answer: saved
                            ? {
                                  answerText: saved.answerText,
                                  audioUrl: saved.audioUrl,
                                  transcript: saved.transcript,
                                  updatedAt: saved.updatedAt,
                                  ...(showGrading && { scoreEarned: saved.scoreEarned, isCorrect: saved.isCorrect }),
                              }
                            : null,
                    };
                }),
            })),
        }));

        const { parts: _parts, ...testInfo } = test;
        const attemptInfo = attempt ? (({ answers: _answers, ...rest }) => rest)(attempt) : null;
        const durationMinutes = attempt?.durationMinutes ?? test.durationMinutes ?? 60;

        return {
            ...testInfo,
            durationMinutes,
            attempt: attemptInfo,
            progress: { answeredCount, totalQuestions, resume },
            parts,
        };
    },

    // Lưu tiến trình hoặc nộp bài thi cho học viên:
    //  - submit = false: Chỉ lưu lại tiến trình và câu trả lời tạm thời, chưa chấm điểm.
    //  - submit = true (READING / LISTENING): So khớp câu trả lời với đáp án chuẩn, lưu isCorrect, scoreEarned
    //    và cập nhật correctCount, totalQuestions, tính bandScore chuẩn IELTS (1.0 - 9.0) (GRADED).
    //  - submit = true (WRITING / SPEAKING): Lưu lại câu trả lời và chuyển trạng thái sang SUBMITTED.
    async submitTest(testId: bigint, userId: string, body: submitTestBody) {
        // Đáp án đúng CHỈ ĐƯỢC LẤY TRÊN SERVER TẠI ĐÂY để chấm điểm, tuyệt đối không gửi về Frontend
        const test = await prisma.test.findFirst({
            where: { id: testId, status: TestStatus.PUBLISHED },
            select: {
                id: true,
                skill: true,
                category: true,
                durationMinutes: true,
                parts: {
                    select: {
                        questionGroups: {
                            select: {
                                questionType: true,
                                questions: {
                                    select: { id: true, points: true, answers: { select: { answerText: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!test) {
            throw notFound("Đề thi");
        }

        const questions = new Map<bigint, { type: QuestionType; points: number; keys: string[] }>();
        for (const part of test.parts) {
            for (const group of part.questionGroups) {
                for (const question of group.questions) {
                    questions.set(question.id, {
                        type: group.questionType,
                        points: Number(question.points),
                        keys: question.answers.map((answer) => answer.answerText),
                    });
                }
            }
        }

        if (body.currentPartNo !== undefined && body.currentPartNo > test.parts.length) {
            throw new Error("currentPartNo không hợp lệ");
        }

        // Làm phẳng cấu trúc parts -> groups -> questions thành Map questionId -> answer
        const submitted = new Map<bigint, AnswerInput>();
        for (const part of body.parts) {
            for (const group of part.questionGroups) {
                for (const question of group.questions) {
                    if (!questions.has(question.id)) {
                        throw new Error(`Câu hỏi ${question.id} không thuộc về đề thi này`);
                    }
                    if (question.answer) {
                        submitted.set(question.id, {
                            answerText: cleanText(question.answer.answerText),
                            audioUrl: cleanText(question.answer.audioUrl),
                            transcript: cleanText(question.answer.transcript),
                        });
                    }
                }
            }
        }

        const attemptId = await prisma.$transaction(
            async (tx) => {
                let attempt: { id: bigint; status: AttemptStatus } | null;
                if (body.attemptId) {
                    attempt = await tx.attempt.findFirst({
                        where: { id: body.attemptId, userId, testId },
                        select: { id: true, status: true },
                    });
                    if (!attempt) {
                        throw notFound("Lượt thi");
                    }
                } else {
                    attempt = await tx.attempt.findFirst({
                        where: { userId, testId, status: AttemptStatus.IN_PROGRESS },
                        orderBy: { startedAt: "desc" },
                        select: { id: true, status: true },
                    });
                    if (!attempt) {
                        attempt = await tx.attempt.create({
                            data: {
                                userId,
                                testId,
                                durationMinutes: body.durationMinutes ?? test.durationMinutes ?? 60,
                            },
                            select: { id: true, status: true },
                        });
                    }
                }
                if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                    throw conflict("Lượt thi này đã được nộp trước đó");
                }

                const progress = {
                    lastSavedAt: new Date(),
                    ...(body.timeSpentSeconds !== undefined && { timeSpentSeconds: body.timeSpentSeconds }),
                    ...(body.durationMinutes !== undefined && { durationMinutes: body.durationMinutes }),
                    ...(body.currentPartNo !== undefined && { currentPartNo: body.currentPartNo }),
                };
                let attemptData: Prisma.AttemptUpdateManyMutationInput = progress;

                if (body.submit && AUTO_GRADED_SKILLS.includes(test.skill)) {
                    // Gộp câu trả lời đã lưu từ các lần lưu dở trước với câu trả lời gửi lên lần này
                    const saved = await tx.attemptAnswer.findMany({
                        where: { attemptId: attempt.id },
                        select: { questionId: true, answerText: true, audioUrl: true, transcript: true },
                    });
                    const merged = new Map<bigint, AnswerInput>();
                    for (const answer of saved) {
                        merged.set(answer.questionId, answer);
                    }
                    for (const [questionId, answer] of submitted) {
                        merged.set(questionId, answer);
                    }

                    let correctCount = 0;
                    let totalQuestions = 0;
                    for (const [questionId, question] of questions) {
                        const answer = merged.get(questionId) ?? { answerText: null, audioUrl: null, transcript: null };
                        const gradable =
                            question.type !== QuestionType.ESSAY &&
                            question.type !== QuestionType.SPEAKING &&
                            question.keys.length > 0;

                        let isCorrect: boolean | null = null;
                        if (gradable) {
                            totalQuestions++;
                            isCorrect = answer.answerText !== null && isAnswerCorrect(question.type, answer.answerText, question.keys);
                            if (isCorrect) {
                                correctCount++;
                            }
                        }
                        await saveAnswer(tx, attempt.id, questionId, {
                            ...answer,
                            isCorrect,
                            scoreEarned: isCorrect ? question.points : 0,
                        });
                    }

                    // Tự động tính điểm IELTS Band Score chuẩn (1.0 - 9.0)
                    const bandScore = calculateBandScore(correctCount, test.skill, test.category);

                    attemptData = {
                        ...progress,
                        status: AttemptStatus.GRADED,
                        submittedAt: new Date(),
                        correctCount,
                        totalQuestions,
                        bandScore,
                    };
                } else {
                    for (const [questionId, answer] of submitted) {
                        await saveAnswer(tx, attempt.id, questionId, answer);
                    }

                    if (body.submit) {
                        // WRITING / SPEAKING được đánh dấu SUBMITTED và chờ chấm điểm
                        attemptData = { ...progress, status: AttemptStatus.SUBMITTED, submittedAt: new Date() };
                    }
                }

                // Chỉ cập nhật khi lượt thi vẫn đang IN_PROGRESS để ngăn chặn click đúp hoặc gửi nhiều request cùng lúc
                const updated = await tx.attempt.updateMany({
                    where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
                    data: attemptData,
                });
                if (updated.count !== 1) {
                    throw conflict("Lượt thi này đã được nộp trước đó");
                }

                return attempt.id;
            },
            { timeout: 20000 },
        );

        return testService.getTestContent(testId, userId, attemptId);
    },

    // Lịch sử các lần thi của thí sinh đăng nhập: mỗi lượt thi kèm tiêu đề đề thi, kỹ năng, thời lượng, điểm band, số câu đúng...
    async getTestHistory(userId: string, query: historyQuery) {
        const { page, limit } = query;
        const where = { userId };

        const [attempts, total] = await Promise.all([
            prisma.attempt.findMany({
                where,
                select: {
                    id: true,
                    status: true,
                    startedAt: true,
                    submittedAt: true,
                    timeSpentSeconds: true,
                    durationMinutes: true,
                    bandScore: true,
                    correctCount: true,
                    totalQuestions: true,
                    test: { select: { id: true, title: true, skill: true, durationMinutes: true } },
                },
                orderBy: { startedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.attempt.count({ where }),
        ]);

        return { attempts, total };
    },

    // Xem lại một lượt thi đã nộp: parts -> question groups -> questions kèm câu trả lời của thí sinh.
    // Nếu không truyền attemptId, hệ thống tự động lấy lượt thi đã nộp gần nhất của người dùng.
    async getTestHistoryDetail(userId: string, attemptId?: bigint) {
        const attempt = await prisma.attempt.findFirst({
            where: attemptId ? { id: attemptId, userId } : { userId, status: { in: FINISHED_STATUSES } },
            orderBy: { startedAt: "desc" },
            select: {
                id: true,
                testId: true,
                status: true,
                startedAt: true,
                submittedAt: true,
                timeSpentSeconds: true,
                durationMinutes: true,
                correctCount: true,
                totalQuestions: true,
                bandScore: true,
                answers: {
                    select: {
                        questionId: true,
                        answerText: true,
                        audioUrl: true,
                        scoreEarned: true,
                        isCorrect: true,
                        // Chỉ lấy nhận xét AI mới nhất
                        aiFeedbacks: {
                            select: { id: true, status: true, overallBand: true, criteriaScores: true, feedback: true, createdAt: true },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        },
                    },
                },
            },
        });
        if (!attempt) {
            throw notFound("Lượt thi");
        }
        if (!FINISHED_STATUSES.includes(attempt.status)) {
            throw conflict("Lượt thi này chưa được nộp");
        }

        const test = await prisma.test.findFirst({
            where: { id: attempt.testId },
            select: {
                ...testSummarySelect,
                parts: {
                    orderBy: { partNo: "asc" },
                    select: {
                        id: true,
                        partNo: true,
                        title: true,
                        instruction: true,
                        content: true,
                        audioUrl: true,
                        imageUrl: true,
                        questionGroups: {
                            orderBy: { groupNo: "asc" },
                            select: {
                                id: true,
                                groupNo: true,
                                questionType: true,
                                instruction: true,
                                sharedContent: true,
                                questions: {
                                    select: { ...questionSelect, answers: { select: { answerText: true } } },
                                    orderBy: { questionNo: "asc" },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!test) {
            throw notFound("Đề thi");
        }

        const answerByQuestion = new Map<bigint, (typeof attempt.answers)[number]>();
        for (const answer of attempt.answers) {
            answerByQuestion.set(answer.questionId, answer);
        }

        const parts = test.parts.map((part) => ({
            ...part,
            questionGroups: part.questionGroups.map((group) => ({
                ...group,
                questions: group.questions.map(({ options, answers: keys, ...question }) => {
                    const saved = answerByQuestion.get(question.id);

                    if (test.skill === Skill.READING || test.skill === Skill.LISTENING) {
                        return {
                            ...question,
                            options,
                            correctAnswers: keys.map((key) => key.answerText),
                            answer: saved
                                ? { answerText: saved.answerText, isCorrect: saved.isCorrect, scoreEarned: saved.scoreEarned }
                                : null,
                        };
                    }
                    if (test.skill === Skill.WRITING) {
                        return {
                            ...question,
                            answer: saved ? { answerText: saved.answerText, aiFeedback: saved.aiFeedbacks[0] ?? null } : null,
                        };
                    }
                    // SPEAKING: trả về audioUrl và nhận xét AI
                    return {
                        ...question,
                        answer: saved ? { audioUrl: saved.audioUrl, aiFeedback: saved.aiFeedbacks[0] ?? null } : null,
                    };
                }),
            })),
        }));

        const { parts: _parts, ...testInfo } = test;
        const { answers: _answers, ...attemptInfo } = attempt;

        return { ...testInfo, attempt: attemptInfo, parts };
    },
};
