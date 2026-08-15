import { Request, Response } from "express"
import { profileService } from "../services/profile.service"

export const profileController = {
    updateProfile: async (req: Request, res: Response) => {
        try {
            const { email, name, phone, address } = req.body;
            const userId = req.user!.id;

            const updateData = await profileService.updateProfile(userId, { 
                email, 
                name, 
                phone, 
                address 
            });

            return res.json({
                success: true,
                message: "Update profile success",
                data: updateData
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    profile: async (req: Request, res: Response) => {
        return res.json({
            message: "User information retrieved successfully.",
            data: req.user
        })
    },
    
}