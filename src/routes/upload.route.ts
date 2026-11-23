import { Router } from "express";
import { upload } from "../middleware/upload.middleware";
import { uploadController } from "../controllers/upload.controller";

const router = Router();

router.post("/upload", upload.single("file"), uploadController.uploadImage);
router.post("/upload/audio", upload.single("file"), uploadController.uploadImage);
router.post("/speech/transcribe", upload.single("file"), uploadController.transcribeSpeech);
router.post("/api/speech/transcribe", upload.single("file"), uploadController.transcribeSpeech);

export default router;
