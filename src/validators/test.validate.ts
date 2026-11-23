import z from "zod";

// ID được gửi lên dưới dạng chuỗi hoặc số và được chuẩn hóa, chuyển đổi sang BigInt tại đây
const idSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^[1-9]\d*$/.test(value), { message: "ID không hợp lệ" })
  .transform((value) => BigInt(value));

// Câu trả lời của thí sinh cho một câu hỏi. Cùng cấu trúc với trường `answer` trong GET /test/:testId/content.
const answerSchema = z.object({
  answerText: z.string().nullish(),
  audioUrl: z.string().max(500, "audioUrl quá dài").nullish(),
  transcript: z.string().nullish(),
});

// Request body khớp với cấu trúc cây nội dung: parts -> questionGroups -> questions, mỗi câu hỏi kèm trường `answer`.
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
  // true = Nộp bài chính thức (chấm điểm Reading / Listening); false hoặc bỏ trống = chỉ lưu tiến trình làm dở
  submit: z.boolean().default(false),
  // Tiếp tục làm bài theo ID phiên thi cụ thể; nếu không truyền thì dùng phiên IN_PROGRESS mới nhất của thí sinh (hoặc tạo mới)
  attemptId: idSchema.optional(),
  // Thời gian bài thi thí sinh chọn (nếu có tùy chỉnh thời gian làm bài)
  durationMinutes: z.number().int().min(0, "durationMinutes không thể là số âm").optional(),
  timeSpentSeconds: z.number().int().min(0, "timeSpentSeconds không thể là số âm").optional(),
  currentPartNo: z.number().int().min(1, "currentPartNo phải tối thiểu là 1").max(127).optional(),
  parts: z.array(partSchema).default([]),
});
