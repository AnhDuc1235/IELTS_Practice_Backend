import express from "express"
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.middleware"
import { testController } from "../controllers/test.controller"
import { validate } from "../middleware/validate.middleware"
import { submitTestSchema } from "../validators/test.validate"

const router = express.Router()

// public, but `progress` is included when a valid access token is sent
router.get("/test", optionalAuthMiddleware, testController.getTests)
router.get("/test/:testId", optionalAuthMiddleware, testController.getTest)

// needs a logged-in user: test structure merged with that user's saved answers
router.get("/test/:testId/content", authMiddleware, testController.getTestContent)

// needs a logged-in user: saves progress (submit = false) or submits the test (submit = true)
router.post("/test/:testId/submit", authMiddleware, validate(submitTestSchema), testController.submitTest)

// needs a logged-in user: their attempts with test title / skill / duration and scores
router.get("/attempts/history", authMiddleware, testController.getTestHistory)

// needs a logged-in user: review of one finished attempt of the chosen test (?attemptId= to pick another attempt)
router.get("/attempts/:attemptId", authMiddleware, testController.getTestHistoryDetail)

export default router
