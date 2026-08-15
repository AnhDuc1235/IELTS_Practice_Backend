import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { profileController } from "../controllers/profile.controller"

const router = express.Router()

router.get("/profile", authMiddleware, profileController.profile)
router.patch("/profile", authMiddleware, profileController.updateProfile)

export default router