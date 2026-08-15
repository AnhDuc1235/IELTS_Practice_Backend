import express from "express"
import { productController } from "../controllers/product.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { postController } from "../controllers/post.controller";

const router = express.Router()

router.get("/posts", postController.getPost);
router.get("/posts/:id", postController.getPostById);
router.post("/posts", authMiddleware, upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]),postController.createPost);
router.put("/posts/:id", authMiddleware, upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]),postController.updatePost);
router.delete("/posts/:id", authMiddleware, postController.deletePost);

export default router