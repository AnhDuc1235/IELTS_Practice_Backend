import { prisma } from "../utils/prisma";
import { CreateAnnotationDto, UpdateAnnotationDto } from "../types/annotation.type";

export const annotationService = {
  async getAnnotations(attemptId: bigint, partId?: bigint) {
    return prisma.annotation.findMany({
      where: {
        attemptId,
        ...(partId ? { partId } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async createAnnotation(userId: string, data: CreateAnnotationDto) {
    const attemptId = BigInt(data.attemptId);
    const partId = BigInt(data.partId);

    // Xác thực attempt thuộc về user
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, userId },
    });
    if (!attempt) {
      throw new Error("Attempt not found or unauthorized");
    }

    return prisma.annotation.create({
      data: {
        attemptId,
        partId,
        type: data.type,
        startOffset: Number(data.startOffset || 0),
        endOffset: Number(data.endOffset || 0),
        selectedText: data.selectedText || "",
        noteText: data.noteText || null,
        color: data.color || "#ffeb3b",
      },
    });
  },

  async updateAnnotation(userId: string, id: bigint, data: UpdateAnnotationDto) {
    const annotation = await prisma.annotation.findFirst({
      where: { id, attempt: { userId } },
    });
    if (!annotation) {
      throw new Error("Annotation not found or unauthorized");
    }

    return prisma.annotation.update({
      where: { id },
      data: {
        ...(data.noteText !== undefined && { noteText: data.noteText }),
        ...(data.color !== undefined && { color: data.color }),
      },
    });
  },

  async deleteAnnotation(userId: string, id: bigint) {
    const annotation = await prisma.annotation.findFirst({
      where: { id, attempt: { userId } },
    });
    if (!annotation) {
      throw new Error("Annotation not found or unauthorized");
    }

    await prisma.annotation.delete({ where: { id } });
    return true;
  },
};
