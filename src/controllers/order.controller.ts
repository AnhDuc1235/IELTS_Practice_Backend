import { Request, Response } from "express"
import { CreateOrderInput, orderQuery } from "../types/order.type";
import { orderService } from "../services/order.service";
import { emailQueue } from "../queues/email.queue";

export const orderController = {
    getMyOrders: async (req: Request, res: Response) => {
        try {
            const query: orderQuery = {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                sort: req.query.sort as string,
            };

            const { orders, total } = await orderService.getMyOrders(query, req.user?.id as string);
            res.json({
                success: true,
                message: "Get orders success",
                data: orders,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total: total,
                    totalPages: Math.ceil(total / (query.limit ?? 10)),
                },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    getOrder: async (req: Request, res: Response) => {
        try {
            const query: orderQuery = {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                sort: req.query.sort as string,
            };

            const { orders, total } = await orderService.getOrder(query);
            res.json({
                success: true,
                message: "Get orders success",
                data: orders,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total: total,
                    totalPages: Math.ceil(total / (query.limit ?? 10)),
                },
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    getOrderById: async (req: Request, res: Response) => {
        try {
            const orderId = req.params.id || req.body.id;
            if (!orderId) {
                return res.status(400).json({ 
                    success: false,
                    message: "Order id is required" 
                });
            }

            const order = await orderService.getOrderById(req.user?.id as string, orderId);
            if (!order) {
                return res.status(404).json({ 
                    success: false,
                    message: "Order not found" 
                });
            }

            return res.json({
                success: true,
                message: "Get order success",
                data: order,
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: (error as Error).message,
            });
        }
    },
    createOrder: async (req: Request, res: Response) => {
        const { receiverName, phone, shippingAddress, paymentMethod }: CreateOrderInput = req.body
        try {
            const order = await orderService.createOrder(req.user?.id as string, receiverName, phone, shippingAddress, paymentMethod)

            return res.status(201).json({
                success: true,
                message: "create order success",
                data: order,
                qrUrl: order.qrUrl,
            })
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: (error as Error).message
            })
        }
    },
    updateOrder: async (req: Request, res: Response) => {
        try {
            const order = await orderService.updateOrder(req.user?.id as string, req.params.id as string, req.body.status)
            return res.json({
                success: true,
                message: "update order success",
                data: order
            })
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: (error as Error).message
            })
        }
    },
    handleWebhook: async (req: Request, res: Response) => {
        const authHeader = req.headers["authorization"];
        if (authHeader !== `Apikey ${process.env.SEPAY_API_KEY}`) {
            return res.status(200).json({ 
                success: false, 
                message: "Unauthorized" 
            });
        }
        try {
            const result = await orderService.handleSepayWebhook(req.body);

            if (result.success && result.order) {
                await emailQueue.add('send-email-order', {
                    to: result.order?.user.email,
                    subject: "payment successful",
                    template: "order",
                    options: {
                        receiverName: result.order?.receiverName,
                        orderId: result.order?.id,
                        orderAddress: result.order?.shippingAddress,
                        orderTime: result.order?.updatedAt,
                        orderPayment: result.order?.paymentMethod,
                        orderItems: result.order?.orderItems,
                        orderSubtotal: result.order?.subTotal,
                        orderShip: result.order?.shippingFee,
                        orderTotal: result.order?.totalAmount,

                    }
                }).catch(err => console.error("Queue error:", err))
            }
            return res.status(200).json(result);
        } catch (error) {
            return res.status(200).json({ 
                success: false, 
                message: (error as Error).message 
            });
        }
    }
}