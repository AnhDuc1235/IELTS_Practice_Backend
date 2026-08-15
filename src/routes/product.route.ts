import express from "express"
import { productController } from "../controllers/product.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = express.Router()

router.get("/products", productController.getProduct);
router.get("/products/:id", productController.getProductById);
router.post("/products", authMiddleware, upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]),productController.createProduct);
router.put("/products/:id", authMiddleware, upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]),productController.updateProduct);
router.delete("/products/:id", authMiddleware, productController.deleteProduct);

export default router