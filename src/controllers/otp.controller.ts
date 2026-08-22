import { Request, Response } from "express"
import { userService } from "../services/user.service"
import { generateOtp, saveOtp, verifyOtp } from "../utils/otp"

export const otpController = {
    sendOtp: async (req: Request, res: Response) => {
        const user = await userService.find(req.user!.id as string)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        const otp = generateOtp()
        await saveOtp(user.id, otp)

        // TODO: send OTP email once a new mail/queue setup is wired up

        return res.json({
            success: true,
            message: "OTP has been sent"
        })
    },
    sendOtpByEmail: async (req: Request, res: Response) => {
        const user = await userService.findByEmail(req.body.email)
        if (!user) {
            return res.json({
                success: false,
                message: "Cannot find email"
            })
        }

        const otp = generateOtp()
        await saveOtp(user.id, otp)

        // TODO: send OTP email once a new mail/queue setup is wired up

        return res.json({
            success: true,
            message: "OTP has been sent"
        })
    },

}
