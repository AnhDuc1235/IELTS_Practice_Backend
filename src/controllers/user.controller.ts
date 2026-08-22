import { Request, Response } from "express"
import { userService } from "../services/user.service";
import { userQuery } from "../types/user.type";

export const userController = {
    getUsers: async (req: Request, res: Response) => {
        try {
            const query: userQuery = {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                sort: req.query.sort as string,
            };

            const { users, total } = await userService.getUsers(query);
            res.json({
                success: true,
                message: "Get users success",
                data: users,
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
    changeActive: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const isActiveData = await userService.changeActive(userId, req.body.isActive, req.params.id as string);
            return res.json({
                success: true,
                message: "Active status changed successfully",
                data: isActiveData
            });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    changeRole: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const changeRoleUser = await userService.changeRole(userId, req.body.role, req.params.id as string);
            return res.json({
                success: true,
                message: "Role changed successfully",
                data: changeRoleUser
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    getUserById: async (req: Request, res: Response) => {
        try {
            const userId = req.params.id as string;
            const user = await userService.find(userId);
            return res.json({
                success: true,
                message: "User found successfully",
                data: user
            });
        } catch (error: any) {
            return res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }

    }
}