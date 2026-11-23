import express from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { annotationController } from "../controllers/annotation.controller";

const router = express.Router();

router.get("/annotations", authMiddleware, annotationController.getAnnotations);
router.get("/attempts/:attemptId/annotations", authMiddleware, annotationController.getAnnotations);
router.post("/annotations", authMiddleware, annotationController.createAnnotation);
router.put("/annotations/:id", authMiddleware, annotationController.updateAnnotation);
router.delete("/annotations/:id", authMiddleware, annotationController.deleteAnnotation);

export default router;
