import { OrderStatus } from "../generated/prisma/enums"
import { prisma } from "../utils/prisma"

export const revenueService = {
    async getOverview(from: Date, to: Date) {
        const [revenueData, totalOrders, prevRevenueData, prevOrders] = await Promise.all([
            prisma.order.aggregate({
                where: {
                    status: OrderStatus.PAID,
                    createdAt: { 
                        gte: from, 
                        lte: to 
                    }
                },
                _sum: { 
                    totalAmount: true 
                },
                _count: true
            }),

            prisma.order.count({
                where: {
                    createdAt: {
                        gte: from,
                        lte: to
                    }
                }
            }),

            prisma.order.aggregate({
                where: {
                    status: OrderStatus.PAID,
                    createdAt: {
                        gte: new Date(from.getTime() - (to.getTime() - from.getTime())),
                        lte: from
                    }
                },
                _sum: {
                    totalAmount: true
                },
                _count: true
            }),

            prisma.order.count({
                where: {
                    createdAt: {
                        gte: new Date(from.getTime() - (to.getTime() - from.getTime())),
                        lte: from
                    }
                }
            })
        ])

        const revenue = Number(revenueData._sum.totalAmount)
        const prevRevenue = Number(prevRevenueData._sum.totalAmount)
        const avgOrderValue = revenueData._count > 0 ? revenue / revenueData._count : 0;
        const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
        const ordersGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

        return {
            revenue,
            totalOrders,
            avgOrderValue,
            revenueGrowth: +revenueGrowth.toFixed(2),
            ordersGrowth: +ordersGrowth.toFixed(2),
        };
    },
    async getRevenueChart(period: string, year?: number, month?: number) {
        let from: Date;
        let to: Date;
        let formatStr: string;
        let fillKeys: string[] = [];

        const now = new Date();

        if (period === "daily") {
            const y = year ?? now.getFullYear();
            const m = (month ?? now.getMonth() + 1) - 1;
            from = new Date(y, m, 1, 0, 0, 0);
            to = new Date(y, m + 1, 0, 23, 59, 59);
            formatStr = "%Y-%m-%d";

            const dayCount = to.getDate();
            for (let d = 1; d <= dayCount; d++) {
                fillKeys.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
            }
        } else if (period === "monthly") {
            const y = year ?? now.getFullYear();
            from = new Date(y, 0, 1, 0, 0, 0);
            to = new Date(y, 11, 31, 23, 59, 59);
            formatStr = "%Y-%m";

            for (let m = 1; m <= 12; m++) {
                fillKeys.push(`${y}-${String(m).padStart(2, "0")}`);
            }
        } else {
            const y = now.getFullYear();
            from = new Date(y - 4, 0, 1, 0, 0, 0);
            to = new Date(y, 11, 31, 23, 59, 59);
            formatStr = "%Y";

            for (let i = y - 4; i <= y; i++) {
                fillKeys.push(String(i));
            }
        }

        const rows = await prisma.$queryRaw<{ label: string; revenue: number; orders: number }[]>`
            SELECT 
                DATE_FORMAT(createdAt, ${formatStr}) AS label,
                SUM(totalAmount) AS revenue,
                COUNT(*) AS orders
            FROM \`orders\`
            WHERE status IN ('PAID')
                AND createdAt BETWEEN ${from} AND ${to}
            GROUP BY label
            ORDER BY label ASC
        `;

        const map = new Map(rows.map(r => [r.label, {
            revenue: Number(r.revenue),
            orders: Number(r.orders)
        }]));

        const data = fillKeys.map(key => ({
            label: key,
            revenue: map.get(key)?.revenue ?? 0,
            orders: map.get(key)?.orders ?? 0,
        }));

        return { period, data };
    },
    async getOrderStats(from: Date, to: Date) {
        const stats = await prisma.order.groupBy({
            by: ["status"],
            where: { 
                createdAt: { 
                    gte: from, 
                    lte: to 
                } 
            },
            _count: { 
                id: true 
            }
        });
        const allStatuses = Object.values(OrderStatus);
        const map = new Map(stats.map(s => [s.status, s._count.id]));

        return allStatuses.map(status => ({
            status,
            count: map.get(status) ?? 0
        }));
    },
    async getTopProduct(from: Date, to: Date, limit: number = 5) {
        const rows = await prisma.$queryRaw<{
            productId: string;
            productName: string;
            totalQuantity: number;
            totalRevenue: number;
        }[]>`
            SELECT 
                oi.productId,
                oi.productName,
                SUM(oi.quantity) AS totalQuantity,
                SUM(oi.quantity * oi.price) AS totalRevenue
            FROM orderItems oi
            INNER JOIN \`orders\` o ON o.id = oi.orderId
            WHERE o.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
                AND o.createdAt BETWEEN ${from} AND ${to}
            GROUP BY oi.productId, oi.productName
            ORDER BY totalRevenue DESC
            LIMIT ${limit}
        `;
        return rows.map(r => ({
            ...r,
            totalQuantity: Number(r.totalQuantity),
            totalRevenue: Number(r.totalRevenue),
        }));
    },
}