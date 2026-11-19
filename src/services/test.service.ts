import { AttemptStatus, Prisma, Skill, TestCategory, TestStatus } from "../generated/prisma/client";
import { errorType } from "../types/error";
import { testQuery } from "../types/test.type";
import { prisma } from "../utils/prisma";

/*
 * Read-only access to IELTS test content for learners.
 * Rules applied everywhere:
 *  - only PUBLISHED tests are visible
 *  - QuestionAnswer (answer key) and explanation are never selected
 *  - results are sorted by partNo / groupNo / questionNo
 */

const notFound = (what: string) => {
    const error = new Error(`${what} not found`) as errorType;
    error.statusCode = 404;
    return error;
};

const isSkill = (value: string): value is Skill => Object.values(Skill).includes(value as Skill);
const isTestCategory = (value: string): value is TestCategory => Object.values(TestCategory).includes(value as TestCategory);

// Test fields shown in lists and detail pages.
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

// A saved answer counts as "answered" once it holds text or an audio recording.
const answeredFilter = {
    OR: [{ answerText: { not: null } }, { audioUrl: { not: null } }],
} satisfies Prisma.AttemptAnswerWhereInput;

// Attempt fields shown as the user's progress.
const attemptSummarySelect = {
    id: true,
    testId: true,
    status: true,
    startedAt: true,
    lastSavedAt: true,
    submittedAt: true,
    timeSpentSeconds: true,
    currentPartNo: true,
    correctCount: true,
    totalQuestions: true,
    bandScore: true,
    _count: { select: { answers: { where: answeredFilter } } },
} satisfies Prisma.AttemptSelect;

type AttemptSummary = Prisma.AttemptGetPayload<{ select: typeof attemptSummarySelect }>;

// Fields shown to learners for a question (no explanation / transcriptLocation / answers).
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

// Flattens an attempt row into the progress object sent to the FE.
const toProgress = (attempt: AttemptSummary | null | undefined, liveTotalQuestions?: number) => {
    if (!attempt) {
        return null;
    }
    const { _count, ...rest } = attempt;
    return {
        ...rest,
        answeredCount: _count.answers,
        // totalQuestions is only stored on the attempt after grading, so fall back to a live count
        totalQuestions: attempt.totalQuestions ?? liveTotalQuestions ?? null,
    };
};

export const testService = {
    // Lists published tests. With a userId each test also carries the user's latest attempt as `progress`.
    async getTests(query: testQuery, userId?: string) {
        const { page, limit, skill, category } = query;

        if (skill && !isSkill(skill)) {
            throw new Error("Invalid skill");
        }
        if (category && !isTestCategory(category)) {
            throw new Error("Invalid category");
        }

        const where = {
            status: TestStatus.PUBLISHED,
            ...(skill && isSkill(skill) && { skill }),
            ...(category && isTestCategory(category) && { category }),
        };

        const [tests, total] = await Promise.all([
            prisma.test.findMany({
                where,
                select: testSummarySelect,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.test.count({ where }),
        ]);

        // One extra query for the whole page: distinct(testId) + newest first keeps
        // only the latest attempt of each listed test.
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
            tests: tests.map((test) => ({ ...test, progress: toProgress(latestByTest.get(test.id)) })),
            total,
        };
    },

    // One published test (metadata + parts list). With a userId it also returns the user's
    // latest attempt as `progress`, or null if the user has never started the test.
    async getTest(testId: bigint, userId?: string) {
        const test = await prisma.test.findFirst({
            where: { id: testId, status: TestStatus.PUBLISHED },
            select: {
                ...testSummarySelect,
                parts: {
                    select: { id: true, partNo: true, title: true },
                    orderBy: { partNo: "asc" },
                },
            },
        });
        if (!test) {
            throw notFound("Test");
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

    // Finds the attempt to resume: the given one, else the user's newest IN_PROGRESS, else their newest.
    // userId is always part of the filter, so a user can never read someone else's attempt.
    async findUserAttempt(userId: string, testId: bigint, attemptId?: bigint) {
        const select = {
            id: true,
            status: true,
            startedAt: true,
            lastSavedAt: true,
            submittedAt: true,
            timeSpentSeconds: true,
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
                throw notFound("Attempt");
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

    // Everything the FE needs to render or resume a test for one user:
    // parts -> question groups -> questions -> options, with the user's saved answer on each
    // question as `answer`, plus `progress` (counts and the first unanswered question).
    // `attempt` is null when the user has not started the test yet.
    async getTestContent(testId: bigint, userId: string, attemptId?: bigint) {
        const test = await prisma.test.findFirst({
            where: { id: testId, status: TestStatus.PUBLISHED },
            select: {
                ...testSummarySelect,
                parts: {
                    orderBy: { partNo: "asc" },
                    select: {
                        // `transcript` is deliberately not selected: it would reveal listening answers
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
            throw notFound("Test");
        }

        const attempt = await testService.findUserAttempt(userId, testId, attemptId);

        // The user's saved answers indexed by question, so merging is a lookup instead of a search
        const answerByQuestion = new Map<bigint, NonNullable<typeof attempt>["answers"][number]>();
        for (const answer of attempt?.answers ?? []) {
            answerByQuestion.set(answer.questionId, answer);
        }
        const showGrading = attempt?.status === AttemptStatus.GRADED; // scores stay hidden until graded

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
        // the raw answer rows are already merged into the questions, so they are dropped from `attempt`
        const attemptInfo = attempt ? (({ answers: _answers, ...rest }) => rest)(attempt) : null;

        return {
            ...testInfo,
            attempt: attemptInfo,
            progress: { answeredCount, totalQuestions, resume },
            parts,
        };
    },
};
