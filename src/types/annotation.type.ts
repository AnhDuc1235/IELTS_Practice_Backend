import { AnnotationType } from "../generated/prisma/client";

export interface CreateAnnotationDto {
  attemptId: string | number;
  partId: string | number;
  type: AnnotationType;
  startOffset?: number;
  endOffset?: number;
  selectedText?: string;
  noteText?: string | null;
  color?: string | null;
}

export interface UpdateAnnotationDto {
  noteText?: string | null;
  color?: string | null;
}
