import { adminLogQuery } from "../types/adminLog.type"
import { prisma } from "../utils/prisma"
import { userService } from "./user.service"

export const adminAction = {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE',
}

export const adminLogService = {
    async createLog(adminId: string, action: string, logAdmin: any) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        const logType = typeof logAdmin === "string" ? logAdmin : JSON.stringify(logAdmin)

        return await prisma.adminLog.create({
            data: {
                adminId: adminId,
                action: action,
                details: logType
            }
        })
    },

    async getLog(adminId: string, query: adminLogQuery) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }

        const { page, limit, search, action, sort } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {};
        let orderBy: any = { createdAt: "desc" };

        if (search) {
            where.details = { contains: search };
        }

        if (action) {
            where.action = action === "CREATED" ? "CREATE" : action;
        }

        if (sort === "asc") {
            orderBy = { createdAt: "asc" };
        }
        if (sort === "desc") {
            orderBy = { createdAt: "desc" };
        }

        const [logs, logCount] = await Promise.all([
            prisma.adminLog.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy
            }),
            prisma.adminLog.count({ where })
        ]);

        return { logs, total: logCount };
    },

    async getLogById(adminId: string, query: adminLogQuery) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }

        const { page, limit, search, action, sort } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = { adminId: adminId };
        let orderBy: any = { createdAt: "desc" };

        if (search) {
            where.details = { contains: search };
        }

        if (action) {
            where.action = action === "CREATED" ? "CREATE" : action;
        }

        if (sort === "asc") {
            orderBy = { createdAt: "asc" };
        }
        if (sort === "desc") {
            orderBy = { createdAt: "desc" };
        }

        const [logs, logCount] = await Promise.all([
            prisma.adminLog.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy
            }),
            prisma.adminLog.count({ where })
        ]);

        return { logs, total: logCount };
    }
}