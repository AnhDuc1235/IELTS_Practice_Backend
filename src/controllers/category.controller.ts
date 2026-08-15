import { Request, Response } from "express"
import { categoryService } from "../services/category.service";
import { categoryQuery } from "../types/category.type";


export const categoryController = {
    getCategories: async (req: Request, res: Response) => {
        try {
            const query: categoryQuery = {
                page: Number(req.query.page) || 1,
                limit: Number(req.query.limit) || 10,
                search: req.query.search as string,
                sort: req.query.sort as string,
            };

            const { categories, total } = await categoryService.getCategories(query);
            res.status(200).json({
                success: true,
                message: "Get categories success",
                data: categories,
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

    getCategoryById: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const category = await categoryService.getCategoryById(id as string);

            if (!category) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Get category by id success",
                data: category
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    addCategory: async (req: Request, res: Response) => {
        try {
            const category = await categoryService.createCategories(req.body.name, req.body.slug, req.user?.id as string)
            return res.status(201).json({
                success: true,
                message: "Create category success",
                data: category
            })
        } catch (error) {
            res.status(400).json({
                success: false,
                message: (error as Error).message
            })
        }

    },
    updateCategory: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { name, slug } = req.body;
            const data = await categoryService.updateCategory(id as string, name, slug, req.user?.id as string);
            return res.status(200).json({
                success: true,
                message: "Update category success", data
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: "Delete category failed"
            });
        }
    },
    deleteCategory: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            await categoryService.deleteCategory(id as string, req.user?.id as string);
            return res.status(200).json({
                success: true,
                message: "Delete category success"
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: "Delete category failed"
            });
        }
    }
}