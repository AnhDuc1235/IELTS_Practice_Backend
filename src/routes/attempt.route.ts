import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { attemptController } from "../controllers/attempt.controller";

const router = express.Router();

// Lịch sử & kết quả gần nhất & tiến trình đã lưu (phải đặt trước route có :id)
router.get("/attempts/history", authMiddleware, attemptController.getHistory);
router.get("/attempts/recent", authMiddleware, attemptController.getRecent);
router.get("/attempts/saved-progress", authMiddleware, attemptController.getSavedProgress);

// Khởi tạo và nộp bài
router.post("/attempts", authMiddleware, attemptController.startAttempt);
router.post("/attempts/:id/reset", authMiddleware, attemptController.resetAttempt);
router.post("/attempts/:id/save", authMiddleware, attemptController.saveProgress);
router.put("/attempts/:id/save", authMiddleware, attemptController.saveProgress);
router.get("/attempts/:id/take", authMiddleware, attemptController.getExamContent);
router.post("/attempts/:id/submit", authMiddleware, attemptController.submitAttempt);
router.get("/attempts/:id/result", authMiddleware, attemptController.getResult);
router.get("/attempts/:id/review", authMiddleware, attemptController.getReview);

export default router;
