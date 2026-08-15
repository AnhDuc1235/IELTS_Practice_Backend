import express from "express"
import { cartController } from "../controllers/cart.controller"
import { authMiddleware } from "../middleware/auth.middleware"

const router = express.Router()

router.get("/cart", authMiddleware, cartController.getCart)
router.post("/cart", authMiddleware, cartController.addToCart)

router.put("/cart/:productId", authMiddleware, cartController.updateCart);
router.delete("/cart/:productId", authMiddleware, cartController.deleteCart);
export default router