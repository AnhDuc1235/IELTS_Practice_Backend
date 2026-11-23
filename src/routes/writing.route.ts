import { Router } from "express";
import { writingController } from "../controllers/writing.controller";

const router = Router();

// Hỗ trợ cả /writing/grade, /grade và /writing/topics, /topics
router.post("/writing/grade", writingController.gradeEssay);
router.get("/writing/topics", writingController.getTopics);
router.post("/grade", writingController.gradeEssay);
router.get("/topics", writingController.getTopics);

export default router;
