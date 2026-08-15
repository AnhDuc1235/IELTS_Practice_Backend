import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { adminLogController } from "../controllers/admin.controller"

const router = express.Router()

router.get("/adminLog", authMiddleware, adminLogController.getAdminLog)
router.get("/adminLog/:id", authMiddleware, adminLogController.getAdminLogById)

export default router