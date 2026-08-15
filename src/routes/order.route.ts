import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { orderController } from "../controllers/order.controller"

const router = express.Router()

router.get("/order", authMiddleware, orderController.getOrder)
router.get("/order/me", authMiddleware, orderController.getMyOrders)
router.get("/order/:id", authMiddleware, orderController.getOrderById)
router.post("/order", authMiddleware, orderController.createOrder)
router.put("/order/:id", authMiddleware, orderController.updateOrder)
router.post("/webhook/sepay", orderController.handleWebhook);

export default router