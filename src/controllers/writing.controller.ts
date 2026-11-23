import { Request, Response } from "express";
import { aiGraderService } from "../services/aiGrader.service";
import { prisma } from "../utils/prisma";

export const writingController = {
  // Chấm điểm bài viết IELTS Writing trực tiếp (Quick Essay Grader)
  async gradeEssay(req: Request, res: Response) {
    try {
      const { prompt, essay, taskType = "TASK_2" } = req.body;
      if (!prompt || !essay) {
        return res.status(400).json({
          success: false,
          message: "Prompt và essay là bắt buộc",
        });
      }

      const result = await aiGraderService.evaluateWritingEssay(
        String(prompt),
        String(essay),
        taskType === "TASK_1" ? "TASK_1" : "TASK_2"
      );

      return res.json({
        success: true,
        message: "Chấm điểm bài viết IELTS Writing thành công",
        data: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  // Lấy các chủ đề IELTS Writing Task 1 & Task 2 có sẵn trong CSDL
  async getTopics(req: Request, res: Response) {
    try {
      const writingTests = await prisma.test.findMany({
        where: { skill: "WRITING" },
        take: 30,
        select: {
          id: true,
          title: true,
          category: true,
          durationMinutes: true,
          parts: {
            select: {
              partNo: true,
              title: true,
              content: true,
              imageUrl: true,
            },
          },
        },
      });

      return res.json({
        success: true,
        message: "Lấy danh sách chủ đề IELTS Writing thành công",
        data: writingTests,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};
