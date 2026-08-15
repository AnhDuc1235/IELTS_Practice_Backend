import { Request, Response } from "express"
import { adminLogService } from "../services/adminLog.service";
import { adminLogQuery } from "../types/adminLog.type";

export const adminLogController = {
    getAdminLog: async (req: Request, res: Response) => {
        try {
            const sortQuery = req.query.sort as string | undefined;
            const actionQuery = req.query.action as string | undefined;
            const query: adminLogQuery = {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                action:
                    actionQuery === "CREATE" ||
                    actionQuery === "CREATED" ||
                    actionQuery === "UPDATE" ||
                    actionQuery === "DELETE"
                        ? actionQuery
                        : undefined,
                sort: sortQuery === "asc" || sortQuery === "desc" ? sortQuery : undefined,
            };

            const { logs, total } = await adminLogService.getLog(req.user?.id as string, query);

            return res.status(200).json({
                success: true,
                message: "Get Admin log success",
                data: logs,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total: total,
                    totalPages: Math.ceil(total / (query.limit ?? 10)),
                },
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },

    getAdminLogById: async (req: Request, res: Response) => {
        try {
            const sortQuery = req.query.sort as string | undefined;
            const actionQuery = req.query.action as string | undefined;
            const query: adminLogQuery = {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                action:
                    actionQuery === "CREATE" ||
                    actionQuery === "CREATED" ||
                    actionQuery === "UPDATE" ||
                    actionQuery === "DELETE"
                        ? actionQuery
                        : undefined,
                sort: sortQuery === "asc" || sortQuery === "desc" ? sortQuery : undefined,
            };

            const { logs, total } = await adminLogService.getLogById(req.user?.id as string, query);

            return res.status(200).json({
                success: true,
                message: "Get Admin log by Id success",
                data: logs,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total: total,
                    totalPages: Math.ceil(total / (query.limit ?? 10)),
                },
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    }
}