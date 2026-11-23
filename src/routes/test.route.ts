import express from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware";
import { testController } from "../controllers/test.controller";
import { validate } from "../middleware/validate.middleware";
import { submitTestSchema } from "../validators/test.validate";

const router = express.Router();

// Công khai: Danh sách đề thi và chi tiết đề thi; nếu gửi kèm access token sẽ có thêm tiến trình `progress`
router.get("/test", optionalAuthMiddleware, testController.getTests);
router.get("/test/:testId", optionalAuthMiddleware, testController.getTest);

// Yêu cầu đăng nhập: Lấy cấu trúc đề thi đã được gộp với câu trả lời đã lưu của thí sinh
router.get("/test/:testId/content", authMiddleware, testController.getTestContent);

// Yêu cầu đăng nhập: Lưu tiến trình làm dở (submit = false) hoặc nộp bài chính thức (submit = true)
router.post("/test/:testId/submit", authMiddleware, validate(submitTestSchema), testController.submitTest);

// Yêu cầu đăng nhập: Lịch sử các lần thi của thí sinh (kèm tiêu đề đề thi, kỹ năng, thời lượng và điểm số)
// Hỗ trợ cả /attempts/history, /test-history, /test/history để tương thích tối đa với Frontend
router.get("/attempts/history", authMiddleware, testController.getTestHistory);
router.get("/test-history", authMiddleware, testController.getTestHistory);
router.get("/test/history", authMiddleware, testController.getTestHistory);

// Yêu cầu đăng nhập: Xem lại một lượt thi đã nộp (?attemptId= để chọn lượt thi khác)
// Hỗ trợ cả /attempts/:attemptId và /test-history/:attemptId
router.get("/attempts/:attemptId", authMiddleware, testController.getTestHistoryDetail);
router.get("/test-history/:attemptId", authMiddleware, testController.getTestHistoryDetail);

export default router;
