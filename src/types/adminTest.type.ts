import { QuestionType, Skill, TestCategory, TestStatus } from "../generated/prisma/client";

export interface CreateTestDto {
  title: string;
  skill: Skill | string;
  category?: TestCategory | string;
  status?: TestStatus | string;
  durationMinutes?: number;
  description?: string;
  level?: string;
  content?: string;
  audioUrl?: string;
  parts?: Array<{
    partNo: number;
    title?: string;
    instruction?: string;
    content?: string;
    transcript?: string;
    audioUrl?: string;
    imageUrl?: string;
    questionGroups?: Array<{
      groupNo: number;
      questionType: QuestionType | string;
      instruction?: string;
      sharedContent?: string;
      questions?: Array<{
        questionNo: number;
        content: string;
        explanation?: string;
        transcriptLocation?: string;
        points?: number;
        options?: Array<{ label: string; content: string }>;
        answers?: Array<{ answerText: string }>;
      }>;
    }>;
  }>;
}

export interface UpdateTestDto extends Partial<CreateTestDto> {
  questions?: Array<{
    id?: number;
    questionNo: number;
    content: string;
    answerText?: string;
  }>;
}
