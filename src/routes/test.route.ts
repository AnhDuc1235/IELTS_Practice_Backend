import express from "express"
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware"
import { testController } from "../controllers/test.controller"

const router = express.Router()

// public, but `progress` is included when a valid access token is sent
router.get("/test", optionalAuthMiddleware, testController.getTests)
router.get("/test/:testId", optionalAuthMiddleware, testController.getTest)

// needs a logged-in user: test structure merged with that user's saved answers
router.get("/test/:testId/content", authMiddleware, testController.getTestContent)

export default router
