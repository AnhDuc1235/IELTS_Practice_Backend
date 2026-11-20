import z from "zod";

// Ids arrive as strings (BigInt cannot travel through JSON) and are converted here.
const idSchema = z.string().regex(/^[1-9]\d*$/, "Invalid id").transform((value) => BigInt(value));

// What the learner entered for one question. Same shape as `answer` in GET /test/:testId/content.
const answerSchema = z.object({
  answerText: z.string().nullish(),
  audioUrl: z.string().max(500, "audioUrl is too long").nullish(),
  transcript: z.string().nullish(),
});

// Body mirrors the content JSON: parts -> questionGroups -> questions, each with its `answer`.
const questionSchema = z.object({
  id: idSchema,
  answer: answerSchema.nullish(),
});

const groupSchema = z.object({
  id: idSchema.optional(),
  questions: z.array(questionSchema),
});

const partSchema = z.object({
  id: idSchema.optional(),
  questionGroups: z.array(groupSchema),
});

export const submitTestSchema = z.object({
  // true = final submit (score Reading / Listening); false or missing = only save progress
  submit: z.boolean().default(false),
  // resume a specific attempt; without it the user's newest IN_PROGRESS attempt is used (or a new one is created)
  attemptId: idSchema.optional(),
  timeSpentSeconds: z.number().int().min(0, "timeSpentSeconds cannot be negative").optional(),
  currentPartNo: z.number().int().min(1, "currentPartNo must be at least 1").max(127).optional(),
  parts: z.array(partSchema).default([]),
});
