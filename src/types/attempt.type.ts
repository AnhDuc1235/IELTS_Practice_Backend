export interface StartAttemptDto {
  testId: string | number;
  mode?: "PRACTICE" | "FULL_TEST";
  selectedPartIds?: (string | number)[];
  customDurationMinutes?: number;
  restart?: boolean; // Nếu true: bỏ qua/hủy bài làm dở cũ, làm lại từ đầu
  forceNew?: boolean; // Tương đương restart
}

export interface AnswerItemDto {
  questionId: string | number;
  answerText?: string | null;
  audioUrl?: string | null;
  transcript?: string | null;
}

export interface SaveProgressDto {
  timeSpentSeconds?: number;
  currentPartNo?: number;
  answers?: AnswerItemDto[];
}

export interface SubmitAttemptDto {
  timeSpentSeconds?: number;
  answers?: AnswerItemDto[];
}
