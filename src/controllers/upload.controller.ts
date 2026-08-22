import { Request, Response } from "express"
import { uploadService } from "../services/upload.service";

export const uploadController = {
    uploadImage: async (req: Request, res: Response) => {
        try {
            if (!req.file) throw new Error("no file have been uploaded");
            const result = await uploadService.uploadImage(req.file, "editor_uploads");
            res.json({
                success: true,
                message: "Upload image success",
                url: result.url,
                publicId: result.publicId
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    }
}