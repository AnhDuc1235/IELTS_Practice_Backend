import { prisma } from "../utils/prisma"
import { categoryQuery } from "../types/category.type";
import { adminAction, adminLogService } from "./adminLog.service";
import { userService } from "./user.service";

export const categoryService = {
    async findActiveCategory(id: string) {
        const category = await prisma.category.findFirst({
            where: {
                id,
                deletedAt: null
            }
        });

        if (!category) {
            throw new Error("category not found or deleted");
        }

        return category;
    },
    async getCategories(query: categoryQuery) {

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

        const [categories, categoryCount] = await Promise.all([
            prisma.category.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
            }),
            prisma.category.count({
                where
            })
        ]);

        return { categories, total: categoryCount };
    },
    async getCategoryById(id: string) {
        return await prisma.category.findUnique({
            where: {
                id,
                deletedAt: null
            },
            include: {
                products: true
            }
        });
    },
    async createCategories(name: string, slug: string, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        const category = await prisma.category.create({
            data: {
                name,
                slug
            }
        })

        adminLogService.createLog(adminId, adminAction.CREATE, "Create category success")

        return category
    },
    async updateCategory(id: string, name: string, slug: string, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        await this.findActiveCategory(id)

        const categoryUpdate = await prisma.category.update({
            where: {
                id
            },
            data: {
                name,
                slug
            }
        });

        adminLogService.createLog(adminId, adminAction.UPDATE, "Update category success")

        return categoryUpdate

    },
    async deleteCategory(id: string, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        await this.findActiveCategory(id)
        const categoryDelete = await prisma.category.update({
            where: {
                id
            },
            data: { 
                deletedAt: new Date() 
            }
        });

        adminLogService.createLog(adminId, adminAction.DELETE, "Delete category success")

        return categoryDelete
    }
}