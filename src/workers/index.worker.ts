import { Job } from "bullmq";
import { bullMq } from "../utils/bullmq";
import { email } from "./email.worker";
import { prisma } from "../utils/prisma";
import { OrderStatus } from "../generated/prisma/enums";

bullMq.createWorker("EMAIL_QUEUE", async (job: Job) => {
    if (job.name === "send-email-register") {
        await email.emailRegister(job);
    } else if (job.name === "send-email-order") {
        await email.orderEmail(job);
    } else if (job.name === "send-email-otp") {
        await email.otpEmail(job);
    }
});

bullMq.createWorker("ORDER_QUEUE", async (job: Job) => {
    if (job.name === "order-expired") {
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: OrderStatus.PENDING,
                isPaid: false,
                expiresAt: { lt: new Date() }
            },
            include: {
                orderItems: true
            }
        });

        if (expiredOrders.length === 0) return;

        for (const order of expiredOrders) {
            await prisma.$transaction([
                ...order.orderItems.map(item =>
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
                        id: order.id
                    },
                    data: {
                        status: OrderStatus.CANCELLED
                    }
                })
            ]);
        }
    }
})