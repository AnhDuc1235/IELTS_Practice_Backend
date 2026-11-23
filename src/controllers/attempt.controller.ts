import { Request, Response } from "express";
import { attemptService } from "../services/attempt.service";

export const attemptController = {
  // POST /attempts - Khởi tạo phiên thi
  startAttempt: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = await attemptService.startAttempt(userId, req.body);
      return res.status(201).json({ success: true, message: "Start attempt success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // POST /attempts/:id/save - Autosave bài thi dở dang
  saveProgress: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const attemptId = BigInt(String(req.params.id));
      const data = await attemptService.saveProgress(userId, attemptId, req.body);
      return res.json({ success: true, message: "Autosave progress success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /attempts/:id/take - Lấy đề thi để làm bài
  getExamContent: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const attemptId = BigInt(String(req.params.id));
      const data = await attemptService.getExamContent(attemptId, userId);
      return res.json({ success: true, message: "Get exam content success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // POST /attempts/:id/submit - Nộp bài thi
  submitAttempt: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const attemptId = BigInt(String(req.params.id));
      const data = await attemptService.submitAttempt(attemptId, userId, req.body);
      return res.json({ success: true, message: "Submit exam success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /attempts/:id/result - Kết quả tổng quan
  getResult: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const attemptId = BigInt(String(req.params.id));
      const data = await attemptService.getResult(attemptId, userId);
      return res.json({ success: true, message: "Get result success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /attempts/:id/review - Xem lại chi tiết đáp án & lời giải
  getReview: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const attemptId = BigInt(String(req.params.id));
      const data = await attemptService.getReview(attemptId, userId);
      return res.json({ success: true, message: "Get review success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /attempts/history - Lịch sử làm bài
  getHistory: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const { attempts, total } = await attemptService.getHistory(userId, page, limit);

      return res.json({
        success: true,
        message: "Get history success",
        data: attempts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /attempts/recent - Kết quả thi gần nhất
  getRecent: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = await attemptService.getRecent(userId);
      return res.json({ success: true, message: "Get recent attempt success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /attempts/saved-progress - Danh sách bài làm dở dang của đề thi (hỗ trợ modal hỏi Resume / Restart)
  getSavedProgress: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const testId = req.query.testId ? String(req.query.testId) : "";
      if (!testId) {
        return res.status(400).json({ success: false, message: "testId query parameter is required" });
      }
      const data = await attemptService.getSavedProgress(userId, testId);
      return res.json({ success: true, message: "Get saved progress success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // POST /attempts/:id/reset - Đặt lại bài thi về từ đầu
  resetAttempt: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const attemptId = BigInt(String(req.params.id));
      const data = await attemptService.resetAttempt(userId, attemptId);
      return res.json({ success: true, message: "Reset attempt success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },
};
