import express from "express"
import { authController } from "../controllers/auth.controller"
import { validate } from "../middleware/validate.middleware"
import { loginSchema, refreshTokenSchema, registerSchema } from "../validators/auth.validate"
import { authMiddleware } from "../middleware/auth.middleware"
import { otpController } from "../controllers/otp.controller"
const router = express.Router()

router.post("/auth/register", validate(registerSchema),authController.register)
router.post("/auth/login", validate(loginSchema), authController.login)
router.delete("/auth/logout", authMiddleware, authController.logout)
router.post("/auth/refresh-token", validate(refreshTokenSchema), authController.refreshToken)
router.patch("/auth/change-password", authMiddleware, authController.changePassword)
router.patch("/auth/forgot-password", authController.forgotPassword)
router.get("/auth/google", authController.googleRedirect)
router.get("/auth/google/callback", authController.googleCallback)
router.post("/auth/google/login", authController.googleLogin);

router.post("/otp/send", authMiddleware, otpController.sendOtp)
router.post("/otp/forgot-email", otpController.sendOtpByEmail)

export default router