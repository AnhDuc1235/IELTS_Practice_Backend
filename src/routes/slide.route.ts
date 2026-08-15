import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { slideController } from "../controllers/slide.controller"
import { upload } from "../middleware/upload.middleware"
const router = express.Router()

router.get("/slide", slideController.getSlide)
router.get("/slide/:id", slideController.getSlideById)
router.post("/slide", authMiddleware, upload.fields([
    { name: 'slides', maxCount: 1 },
]) ,slideController.createSlide);
router.put("/slide/:id", authMiddleware, upload.fields([
    { name: 'slides', maxCount: 1 },
]) ,slideController.updateSlide);
router.delete("/slide/:id", authMiddleware, slideController.deleteSlide);

export default router