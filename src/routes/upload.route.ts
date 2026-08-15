import { Router } from "express";
import { productController } from "../controllers/product.controller";
import { upload } from "../middleware/upload.middleware";
import { uploadController } from "../controllers/upload.controller";
import { postController } from "../controllers/post.controller";
import { slideController } from "../controllers/slide.controller";

const router = Router();

router.post("/", upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]), productController.createProduct);

router.put("/:id", upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]), productController.updateProduct);

router.post("/", upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]), postController.createPost);

router.put("/:id", upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]), postController.updatePost);

router.post("/", upload.fields([
    { name: 'slides', maxCount: 20 },
]), slideController.createSlide);

router.put("/:id", upload.fields([
    { name: 'slides', maxCount: 20 },
]), slideController.updateSlide);

router.post("/upload", upload.single("file"), uploadController.uploadImage)

export default router;