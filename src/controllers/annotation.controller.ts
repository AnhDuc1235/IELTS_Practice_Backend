import { Request, Response } from "express";
import { annotationService } from "../services/annotation.service";

export const annotationController = {
  getAnnotations: async (req: Request, res: Response) => {
    try {
      const attemptIdRaw = (req.query.attemptId as string) || req.params.attemptId;
      if (!attemptIdRaw) {
        return res.status(400).json({ success: false, message: "attemptId is required" });
      }

      const attemptId = BigInt(String(attemptIdRaw));
      const partId = req.query.partId ? BigInt(String(req.query.partId)) : undefined;

      const data = await annotationService.getAnnotations(attemptId, partId);
      return res.json({ success: true, message: "Get annotations success", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  createAnnotation: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const data = await annotationService.createAnnotation(userId, req.body);
      return res.status(201).json({ success: true, message: "Annotation created", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  updateAnnotation: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = BigInt(String(req.params.id));
      const data = await annotationService.updateAnnotation(userId, id, req.body);
      return res.json({ success: true, message: "Annotation updated", data });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  deleteAnnotation: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const id = BigInt(String(req.params.id));
      await annotationService.deleteAnnotation(userId, id);
      return res.json({ success: true, message: "Annotation deleted" });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },
};
