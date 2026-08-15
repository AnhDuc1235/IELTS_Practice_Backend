import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { emailQueue } from "../queues/email.queue";
import { verifyOtp } from "../utils/otp";
import { userService } from "../services/user.service";

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const user = await authService.register(req.body);
      emailQueue.add('send-email-register', {
        to: user.email,
        subject: "Register success",
        template: "welcome-register",
        options: {
          name: user.name
        }
      }).catch(err => console.error("Queue error:", err))

      return res.json({
        success: true,
        message: "success",
        data: user
      })
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      })
    }
  },
  login: async (req: Request, res: Response) => {
    const { email, password } = req.body
    try {
      const result = await authService.login(email, password)
      return res.json({
        success: true,
        message: "Login success",
        data: result
      })
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      })
    }
  },
  logout: async (req: Request, res: Response) => {
    await authService.logout(req.tokenJti!, req.tokenExp!)
    return res.json({
      message: "Logout success"
    })
  },
  refreshToken: async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body
      const newToken = await authService.refreshToken(refreshToken)
      return res.status(201).json({
        message: "success",
        data: newToken
      })
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      })
    }
  },
  changePassword: async (req: Request, res: Response) => {
    try {
      const isValid = await verifyOtp(req.user!.id, req.body.otp)
      if (!isValid) {
        return res.status(400).json({ 
          success: false,
          message: "OTP not valid or expired" 
        })
      }
      const password = await authService.changePassword(req.user!.id, req.body.password)
      return res.status(200).json({
        success: true,
        message: "Change password success",
        data: password
      })
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message
      })
    }
  },
  forgotPassword: async (req: Request, res: Response) => {
    try {
      const userId = await userService.findByEmail(req.body.email)
      if (!userId) {
        return res.json({
          success: false,
          message: "Cannot find email" 
        })
      }
      const isValid = await verifyOtp(userId?.id as string, req.body.otp)
      if (!isValid) {
        return res.status(400).json({ 
          success: false,
          message: "OTP not valid or expired" 
        })
      }
      const password = await authService.forgotPassword(userId?.id as string, req.body.password)
      return res.status(200).json({
        success: true,
        message: "reset password success",
        data: password
      })
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message
      })
    }
  },
  googleRedirect: async (req: Request, res: Response) => {
    const redirectTo = req.query.redirectTo as string 
    const linkRedirect = await authService.googleRedirect(redirectTo)
    return res.redirect(linkRedirect)
  },
  googleCallback: async (req: Request, res: Response) => {
    const code = req.query.code as string
    const state = req.query.state as string
    const callback = await authService.googleCallback(code, state)
    return res.redirect(callback)
  },
  googleLogin: async (req: Request, res: Response) => {
    try {
      const code = req.body.code
      const login = await authService.googleLogin(code)
      return res.json({
        success: true,
        message: "Login success",
        data: login
      })
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: (error as Error).message || "Google Auth failed"
      })
    }
  },

};