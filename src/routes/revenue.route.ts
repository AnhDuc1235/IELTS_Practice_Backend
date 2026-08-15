import express from "express"
import { authMiddleware } from "../middleware/auth.middleware"
import { revenueController } from "../controllers/revenue.controller"

const router = express.Router()

router.get("/overview", authMiddleware, revenueController.getOverview)
router.get("/chartRevenue", authMiddleware, revenueController.getRevenueChart)
router.get("/order-stats", authMiddleware, revenueController.getOrderStatus)
router.get("/top-products", authMiddleware, revenueController.getTopProduct)

export default router