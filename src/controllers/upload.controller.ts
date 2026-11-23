import { Request, Response } from "express";
import { uploadService } from "../services/upload.service";
import { aiGraderService } from "../services/aiGrader.service";

export const uploadController = {
  // Xử lý tải file lên (hình ảnh, file ghi âm bài nói)
  uploadImage: async (req: Request, res: Response) => {
    try {
      if (!req.file) throw new Error("Chưa chọn file nào để tải lên");
      const folder = req.file.mimetype.startsWith("audio/") ? "speaking_audio" : "editor_uploads";
      const result = await uploadService.uploadFile(req.file, folder);
      return res.json({
        success: true,
        message: "Tải file lên thành công",
        url: result.url,
        audioUrl: result.url,
        publicId: result.publicId,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  },

  // Tải file ghi âm lên đồng thời chuyển thành văn bản (Speech-to-Text) bằng AI
  transcribeSpeech: async (req: Request, res: Response) => {
    try {
      if (!req.file) throw new Error("Chưa chọn file âm thanh để tải lên");
      const [uploadResult, transcript] = await Promise.all([
        uploadService.uploadFile(req.file, "speaking_audio"),
        aiGraderService.transcribeBuffer(req.file.buffer, req.file.mimetype || "audio/webm"),
      ]);

      return res.json({
        success: true,
        message: "Xử lý âm thanh và Speech-to-Text thành công",
        url: uploadResult.url,
        audioUrl: uploadResult.url,
        transcript,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  },
};
