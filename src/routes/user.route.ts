import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { userController } from "../controllers/user.controller"

const router = express.Router()

router.put("/user/:id/change-role", authMiddleware, userController.changeRole)
router.put("/user/:id/change-active", authMiddleware, userController.changeActive)
router.get("/user", authMiddleware, userController.getUsers)
router.get("/user/:id", authMiddleware, userController.getUserById)

export default router