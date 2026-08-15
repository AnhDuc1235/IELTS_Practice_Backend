import { Prisma } from "../generated/prisma/browser";
import { UserData, userQuery } from "../types/user.type";
import { hashPassword } from "../utils/hasing";
import { prisma } from "../utils/prisma";
import { Role } from "../generated/prisma/client";

export const userService = {
    async existingEmail(email: string) {
        const count = await prisma.user.count({
            where: {
                email,
            },
        });
        return count;
    },
    async create(userData: UserData) {
        const user = await prisma.user.create({
            data: {
                ...userData,
                password: hashPassword(userData.password)
            }
        });

        return user;
    },
    async findByEmail(email: string) {
        const user = await prisma.user.findFirst({
            where: {
                email,
                isActive: true,
                deletedAt: null
            },
        });
        if (!user) {
            return user
        }
        return user;
    },
    async find(id: string) {
        const user = await prisma.user.findFirst({
            where: {
                id,
                deletedAt: null
            },
            omit: {
                password: true,
            },
        });
        if (!user) {
            throw new Error("Unauthorized");
        }
        return user;
    },
    async changeRole(adminId: string, role: string, id: string) {
        const checkRole = await userService.find(adminId)
        if (checkRole.role === "USER") {
            throw new Error("Only admin can process")
        }
        const user = await prisma.user.findFirst({
            where: {
                id: adminId,
                isActive: true,
                deletedAt: null,
                role: "ADMIN"
            },
        });
        if (!user) {
            throw new Error("Admin not found");
        }
        const changeRoleUser = await prisma.user.update({
            where: {
                id: id,
                role: "USER"
            },
            data: {
                role: role as Role
            },
            omit: {
                password: true,
            },
        });
        return changeRoleUser;
    },
    async getUsers(query: userQuery) {
        const { page, limit, search, sort } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {
            deletedAt: null
        };
        let orderBy: any = {
            createdAt: "desc"
        }

        if (search) {
            where.OR = [
                {
                    name: {
                        contains: search
                    }
                },
                {
                    email: {
                        contains: search
                    }
                },
                {
                    phone: {
                        contains: search
                    }
                }
            ];
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

        const [users, userCount] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
            }),
            prisma.user.count({
                where
            })
        ]);

        return { users, total: userCount };

    },
    async changeActive(adminId: string, isActive: boolean, id: string) {
        const checkRole = await userService.find(adminId)
        if (checkRole.role === "USER") {
            throw new Error("Only admin can process")
        }
        const user = await prisma.user.findFirst({
            where: {
                id: adminId,
                isActive: true,
                deletedAt: null,
                role: "ADMIN"
            },
        });
        if (!user) {
            throw new Error("Admin not found");
        }
        const changeActiveUser = await prisma.user.update({
            where: {
                id: id,
            },
            data: {
                isActive: isActive
            },
            omit: {
                password: true,
            },
        });
        return changeActiveUser;
    },
};