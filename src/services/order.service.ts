import { orderQuery } from "../types/order.type";
import { prisma } from "../utils/prisma"
import { OrderStatus } from "../generated/prisma/enums";
import { restoreUUID } from "../utils/uuidFormat";

export const orderService = {
    async getMyOrders(query: orderQuery, userId: string) {
        const { page, limit, sort } = query;
        const skip = (Number(page) - 1) * Number(limit);
        let orderBy: any = {
            createdAt: "desc"
        }
        let where: any = {
            userId: userId
        }

        if (sort == "asc") {
            orderBy = {
                createdAt: "asc"
            }
        }
        if (sort == "desc") {
            orderBy = {
                createdAt: "desc"
            }
        }

        const [orders, orderCount] = await Promise.all([
            prisma.order.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
                include: {
                    orderItems: true
                }
            }),
            prisma.order.count({
                where
            })
        ]);

        return { orders, total: orderCount };
    },
    async getOrder(query: orderQuery) {

        const { page, limit, sort } = query;
        const skip = (Number(page) - 1) * Number(limit);
        let orderBy: any = {
            createdAt: "desc"
        }
        let where: any = {}

        if (sort == "asc") {
            orderBy = {
                createdAt: "asc"
            }
        }
        if (sort == "desc") {
            orderBy = {
                createdAt: "desc"
            }
        }

        const [orders, orderCount] = await Promise.all([
            prisma.order.findMany({
                skip,
                take: Number(limit),
                orderBy,
                include: {
                    orderItems: true
                }
            }),
            prisma.order.count({
                where
            })
        ]);

        return { orders, total: orderCount };

    },
    async getOrderById(userId: string, orderId: string) {

        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId: userId
            },
            include: {
                orderItems: true
            }
        })
        return order

    },
    async createOrder(userId: string, receiverName: string, phone: string, shippingAddress: string, paymentMethod: string) {

        const createOrder = await prisma.$transaction(async (tr) => {
            const cart = await tr.cart.findUnique({
                where: {
                    userId
                },
                include: {
                    cartItems: {
                        include: {
                            product: true,
                        }
                    }
                }
            })
            if (!cart) {
                throw new Error("Cannot find cart")
            }

            const checkStock = cart.cartItems.filter(
                (item) => item.quantity > item.product.stock
            )

            if (checkStock.length > 0) {
                throw new Error("Not enough stock")
            }
            // const totalItems = cart.cartItems.reduce((sum, item) => sum + item.quantity, 0)
            const totalPrice = cart.cartItems.reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)

            const order = await tr.order.create({
                data: {
                    userId,
                    subTotal: totalPrice,
                    totalAmount: totalPrice,
                    receiverName: receiverName,
                    phone: phone,
                    shippingAddress: shippingAddress,
                    paymentMethod: paymentMethod,
                    orderItems: {
                        create: cart.cartItems.map((item) => ({
                            productId: item.productId,
                            productName: item.product.name,
                            price: item.product.price,
                            quantity: item.quantity,
                        }))
                    },
                    expiresAt: new Date(Date.now() + 5 * 60 * 1000)

                },
            })

            await Promise.all(
                cart.cartItems.map((item) =>
                    tr.product.update({
                        where: {
                            id: item.productId
                        },
                        data: {
                            stock: {
                                decrement: item.quantity
                            }
                        }
                    })
                )
            )
            await tr.cartItem.deleteMany({
                where: {
                    cartId: cart.id
                }
            });

            const qrUrl = `https://qr.sepay.vn/img?acc=${process.env.SEPAY_ACCOUNT}&bank=${process.env.SEPAY_BANK}&amount=${Math.round(Number(order.totalAmount))}&des=DH${order.id}`;
            return { order, qrUrl }
        })
        return createOrder

    },
    async updateOrder(userId: string, orderId: string, status: string) {

        if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
            throw new Error(`Invalid status: ${status}`)
        }
        const newStatus = status as OrderStatus
        const order = await prisma.order.findFirst({
            where: {
                id: orderId,
                userId: userId
            }
        })

        if (!order) {
            throw new Error("Order not found")
        }

        const validTransitions: Record<OrderStatus, OrderStatus[]> = {
            [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
            [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED],
            [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
            [OrderStatus.DELIVERED]: [OrderStatus.RETURNED, OrderStatus.REFUNDED],
            [OrderStatus.CANCELLED]: [],
            [OrderStatus.REFUNDED]: [],
            [OrderStatus.FAILED]: [OrderStatus.PENDING],
            [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
        }

        if (!validTransitions[order.status]?.includes(newStatus)) {
            throw new Error(`Cannot change from ${order.status} to ${status}`)
        }

        const updated = await prisma.order.update({
            where: {
                id: orderId
            },
            data: {
                status: status as OrderStatus
            }
        })

        return updated

    },
    async handleSepayWebhook(payload: {
        id: number;
        gateway: string;
        transactionDate: string;
        accountNumber: string;
        subAccount: string | null;
        code: string | null;
        content: string;
        transferType: "in" | "out";
        transferAmount: number;
        accumulated: number;
        referenceCode: string;
        description: string;
    },) {

        if (payload.transferType !== "in") {
            return {
                success: false,
                message: "Not an incoming transfer"
            };
        }

        const existed = await prisma.order.findFirst({
            where: {
                sepayRef: String(payload.id)
            }
        });
        if (existed) {
            return {
                success: false, message: "Transaction already processed"
            };
        }

        let orderId: string | null = null;
        const match = payload.content.match(/DH([a-zA-Z0-9-]+)/i);
        if (match) {
            orderId = match as unknown as string
            orderId = match[1] ?? null;;
        }


        if (!orderId) {
            return {
                success: false, message: "Cannot extract order ID"
            };
        }
        const validUuid = restoreUUID(orderId);

        const order = await prisma.order.findFirst({
            where: {
                id: validUuid,
                totalAmount: payload.transferAmount,
                isPaid: false,
            }
        });

        if (!order) {
            return {
                success: false, message: `No matching order for DH${orderId}`
            };
        }

        const currentTime = new Date();

        if (currentTime > order.expiresAt || order.status === OrderStatus.CANCELLED) {
            const orderItems = await prisma.orderItem.findMany({
                where: {
                    orderId: validUuid
                }
            });

            await prisma.$transaction([
                ...orderItems.map(item =>
                    prisma.product.update({
                        where: {
                            id: item.productId!
                        },
                        data: {
                            stock: {
                                increment: item.quantity
                            }
                        }
                    })
                ),
                prisma.order.update({
                    where: {
                        id: validUuid
                    },
                    data: {
                        sepayRef: String(payload.id),
                        status: OrderStatus.FAILED,
                        description: `order has already expired`
                    }
                })
            ]);

            return {
                success: false,
                message: "Payment expired, manual check required"
            };
        }

        const updated = await prisma.order.update({
            where: {
                id: validUuid
            },
            data: {
                status: OrderStatus.PAID,
                isPaid: true,
                sepayRef: String(payload.id),
            },
            include: {
                orderItems: {
                    include: {
                        product: {
                            select: {
                                thumbnail: true,
                            }
                        }
                    }
                },
                user: {
                    select: {
                        email: true,
                        name: true
                    }
                }
            }
        });

        return {
            success: true,
            message: "Order paid successfully",
            order: updated
        };
    },

}