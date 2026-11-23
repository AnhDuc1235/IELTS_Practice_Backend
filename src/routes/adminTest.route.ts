import express from "express";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { adminTestController } from "../controllers/adminTest.controller";

const router = express.Router();

// Tải file mẫu và import Excel (đặt trước các route có param :id)
router.get("/tests/template-excel", adminTestController.downloadTemplate);
router.post("/tests/import-excel", authMiddleware, upload.single("file"), adminTestController.importExcel);

// Lấy danh sách & chi tiết đề thi (public hoặc kèm user progress)
router.get("/tests", optionalAuthMiddleware, adminTestController.getTests);
router.get("/tests/:id", optionalAuthMiddleware, adminTestController.getTestById);

// Các thao tác quản trị yêu cầu quyền đăng nhập
router.post("/tests", authMiddleware, adminTestController.createTest);
router.put("/tests/:id", authMiddleware, adminTestController.updateTest);
router.delete("/tests/:id", authMiddleware, adminTestController.deleteTest);

export default router;
