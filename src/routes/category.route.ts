import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { categoryController } from "../controllers/category.controller"

const router = express.Router()
router.get("/category", categoryController.getCategories);
router.get("/category/:id", categoryController.getCategoryById);

router.post("/category", authMiddleware, categoryController.addCategory)
router.put("/category/:id", authMiddleware, categoryController.updateCategory);
router.delete("/category/:id", authMiddleware, categoryController.deleteCategory);

export default router