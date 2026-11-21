import { AttemptStatus, Prisma, QuestionType, Skill, TestCategory, TestStatus } from "../generated/prisma/client";
import { errorType } from "../types/error";
import { historyQuery, submitTestBody, testQuery } from "../types/test.type";
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

const conflict = (message: string) => {
    const error = new Error(message) as errorType;
    error.statusCode = 409;
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

// Only a handed-in attempt can be reviewed. An IN_PROGRESS / ABANDONED attempt must never reveal the answer key.
const FINISHED_STATUSES: AttemptStatus[] = [AttemptStatus.SUBMITTED, AttemptStatus.GRADED];

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

// Only these skills are scored automatically. WRITING / SPEAKING are saved as SUBMITTED and graded later.
const AUTO_GRADED_SKILLS: Skill[] = [Skill.READING, Skill.LISTENING];

// What the learner entered for one question (the AttemptAnswer columns the FE controls).
type AnswerInput = { answerText: string | null; audioUrl: string | null; transcript: string | null };

// Blank / whitespace-only input counts as "no answer".
const cleanText = (value?: string | null) => (value && value.trim() ? value.trim() : null);

// Answers are compared ignoring case, leading/trailing spaces and repeated spaces.
const normalizeAnswer = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

// MCQ_MULTI answers are a set of option labels such as "A,C". The key stores one label per
// QuestionAnswer row (or "A,C" in one row), so both sides are turned into a sorted list of labels.
const toLabelSet = (values: string[]) =>
    Array.from(new Set(values.flatMap((value) => value.split(",")).map(normalizeAnswer).filter(Boolean))).sort();

// Every other type is correct when it equals ANY of the question's QuestionAnswer rows (alternative spellings).
const isAnswerCorrect = (type: QuestionType, given: string, keys: string[]) => {
    if (type === QuestionType.MCQ_MULTI) {
        const givenSet = toLabelSet([given]);
        const keySet = toLabelSet(keys);
        return givenSet.length === keySet.length && givenSet.every((label, index) => label === keySet[index]);
    }
    const normalized = normalizeAnswer(given);
    return keys.some((key) => normalizeAnswer(key) === normalized);
};

// Inserts or updates one AttemptAnswer row (unique on attemptId + questionId).
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

    // Saves (or submits) the logged-in user's answers for a test.
    //  - submit = false: stores the attempt + answers as they are, nothing is scored.
    //  - submit = true, READING / LISTENING: compares every question with its QuestionAnswer rows,
    //    stores isCorrect + scoreEarned per answer and correctCount / totalQuestions on the attempt (GRADED).
    //  - submit = true, WRITING / SPEAKING: stores the answers and marks the attempt SUBMITTED (not scored).
    // Returns the same JSON as getTestContent so the FE can re-render from one shape.
    async submitTest(testId: bigint, userId: string, body: submitTestBody) {
        // The answer key is selected ONLY here, on the server, and is never sent back to the FE.
        const test = await prisma.test.findFirst({
            where: { id: testId, status: TestStatus.PUBLISHED },
            select: {
                id: true,
                skill: true,
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
            throw notFound("Test");
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
            throw new Error("Invalid currentPartNo");
        }

        // Flatten parts -> groups -> questions into questionId -> answer. Only the question id is trusted;
        // an id that is not part of this test is rejected.
        const submitted = new Map<bigint, AnswerInput>();
        for (const part of body.parts) {
            for (const group of part.questionGroups) {
                for (const question of group.questions) {
                    if (!questions.has(question.id)) {
                        throw new Error(`Question ${question.id} does not belong to this test`);
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
                // userId is part of every filter, so a user can only ever touch their own attempt.
                let attempt: { id: bigint; status: AttemptStatus } | null;
                if (body.attemptId) {
                    attempt = await tx.attempt.findFirst({
                        where: { id: body.attemptId, userId, testId },
                        select: { id: true, status: true },
                    });
                    if (!attempt) {
                        throw notFound("Attempt");
                    }
                } else {
                    attempt = await tx.attempt.findFirst({
                        where: { userId, testId, status: AttemptStatus.IN_PROGRESS },
                        orderBy: { startedAt: "desc" },
                        select: { id: true, status: true },
                    });
                    if (!attempt) {
                        attempt = await tx.attempt.create({
                            data: { userId, testId },
                            select: { id: true, status: true },
                        });
                    }
                }
                if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                    throw conflict("Attempt has already been submitted");
                }

                const progress = {
                    lastSavedAt: new Date(),
                    ...(body.timeSpentSeconds !== undefined && { timeSpentSeconds: body.timeSpentSeconds }),
                    ...(body.currentPartNo !== undefined && { currentPartNo: body.currentPartNo }),
                };
                let attemptData: Prisma.AttemptUpdateManyMutationInput = progress;

                if (body.submit && AUTO_GRADED_SKILLS.includes(test.skill)) {
                    // Answers saved earlier by "save progress" requests are merged with the ones sent now (now wins).
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
                    // Every question gets a row, so unanswered ones are stored as incorrect.
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

                    attemptData = {
                        ...progress,
                        status: AttemptStatus.GRADED,
                        submittedAt: new Date(),
                        correctCount,
                        totalQuestions,
                    };
                } else {
                    for (const [questionId, answer] of submitted) {
                        await saveAnswer(tx, attempt.id, questionId, answer);
                    }

                    if (body.submit) {
                        // TEMPLATE: WRITING / SPEAKING are not scored yet. The answers are stored as they are
                        // (isCorrect stays null, scoreEarned stays 0) and the attempt waits as SUBMITTED.
                        // Later, create AiFeedback rows (status PENDING) for these answers here and let
                        // the grader move the attempt to GRADED and fill bandScore.
                        attemptData = { ...progress, status: AttemptStatus.SUBMITTED, submittedAt: new Date() };
                    }
                }

                // Only an attempt that is still IN_PROGRESS can be updated, so a double click or two
                // parallel submits cannot grade the same attempt twice.
                const updated = await tx.attempt.updateMany({
                    where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
                    data: attemptData,
                });
                if (updated.count !== 1) {
                    throw conflict("Attempt has already been submitted");
                }

                return attempt.id;
            },
            { timeout: 20000 },
        );

        return testService.getTestContent(testId, userId, attemptId);
    },

    // The logged-in user's attempt history: one row per attempt (newest first) with the test's title,
    // skill and duration and the attempt's time spent / band score / correct count / total questions.
    // Unfinished attempts are included too, so the FE can tell them apart by `status`.
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

    // Review of one finished attempt of a test: parts -> question groups -> questions with the user's answer.
    // Without attemptId the user's newest finished attempt of this test is used.
    //  - READING / LISTENING: answerText + isCorrect + scoreEarned, the question's options and its correct answers.
    //  - WRITING: answerText + the latest AI feedback (no options / correct answers).
    //  - SPEAKING: audioUrl + the latest AI feedback (no options / correct answers).
    // The correct answers are only ever returned for an attempt that has been handed in.
    async getTestHistoryDetail(testId: bigint, userId: string, attemptId?: bigint) {
        // userId is part of the filter, so a user can only review their own attempts.
        const attempt = await prisma.attempt.findFirst({
            where: attemptId ? { id: attemptId, userId, testId } : { userId, testId, status: { in: FINISHED_STATUSES } },
            orderBy: { startedAt: "desc" },
            select: {
                id: true,
                status: true,
                startedAt: true,
                submittedAt: true,
                timeSpentSeconds: true,
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
                        // newest feedback only; errorMessage / modelName are internal and not selected
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
            throw notFound("Attempt");
        }
        if (!FINISHED_STATUSES.includes(attempt.status)) {
            throw conflict("Attempt has not been submitted yet");
        }

        // The attempt exists, so the test does too; it is not filtered by PUBLISHED because the
        // user must still be able to review a test that was archived after they took it.
        const test = await prisma.test.findFirst({
            where: { id: testId },
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
            throw notFound("Test");
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
                    // SPEAKING: the recording instead of text
                    return {
                        ...question,
                        answer: saved ? { audioUrl: saved.audioUrl, aiFeedback: saved.aiFeedbacks[0] ?? null } : null,
                    };
                }),
            })),
        }));

        const { parts: _parts, ...testInfo } = test;
        // the raw answer rows are already merged into the questions, so they are dropped from `attempt`
        const { answers: _answers, ...attemptInfo } = attempt;

        return { ...testInfo, attempt: attemptInfo, parts };
    },
};
