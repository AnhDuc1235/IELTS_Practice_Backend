import { Router } from "express";
import { upload } from "../middleware/upload.middleware";
import { uploadController } from "../controllers/upload.controller";

const router = Router();

router.post("/upload", upload.single("file"), uploadController.uploadImage)

export default router;
