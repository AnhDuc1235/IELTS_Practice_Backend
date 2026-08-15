import { prisma } from "../utils/prisma";
import { Decimal } from "../generated/prisma/internal/prismaNamespace";
import { uploadService } from "./upload.service";
import { productQuery } from "../types/product.type";
import { adminAction, adminLogService } from "./adminLog.service";
import { userService } from "./user.service";

export const productService = {
    async getProduct(query: productQuery) {
        const { page, limit, search, category, minPrice, maxPrice, price, sort } = query;
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
                    sku: {
                        contains: search
                    }
                }
            ];
        }

        if (category) {
            where.categoryId = category;
        }

        if (minPrice !== null || maxPrice !== null) {
            where.price = {
                gte: minPrice !== null ? minPrice : undefined,
                lte: maxPrice !== null ? maxPrice : undefined,
            };
        }

        if (price == "asc") {
            orderBy = {
                price: "asc"
            }
        }
        if (price == "desc") {
            orderBy = {
                price: "desc"
            }
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

        const [products, productCount] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
                include: {
                    images: true
                }
            }),
            prisma.product.count({
                where
            })
        ]);

        return { products, total: productCount };
    },

    async findActiveProduct(id: string) {
        const product = await prisma.product.findFirst({
            where: {
                id,
                deletedAt: null
            }
        });
        if (!product) {
            throw new Error("Product not found or deleted");
        }
        return product;
    },

    async getProductById(id: string) {
        return await prisma.product.findFirst({
            where: {
                id: id,
                deletedAt: null
            },
            include: {
                images: true
            }
        });
    },

    async getImagesByIds(ids: string[], productId: string) {
        return await prisma.productImage.findMany({
            where: {
                id: {
                    in: ids
                },
                productId
            }
        });
    },

    async createProduct(body: any, thumbnailData: { url: string, publicId: string }, imageRecords: any[], adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }

        try {
            const productCreate = await prisma.product.create({
                data: {
                    sku: body.sku,
                    name: body.name,
                    slug: body.slug,
                    thumbnail: thumbnailData.url,
                    thumbnailPublicId: thumbnailData.publicId,
                    description: body.description,
                    price: new Decimal(body.price),
                    stock: Number(body.stock),
                    categoryId: body.categoryId,
                    isFeatured: body.isFeatured === 'true' || body.isFeatured === true,
                    attributes: typeof body.attributes === 'string' ? JSON.parse(body.attributes) : body.attributes,
                    images: {
                        create: imageRecords
                    }
                },
                include: {
                    images: true
                }
            });

            adminLogService.createLog(adminId, adminAction.CREATE, "Create product success")

            return productCreate
        } catch (error) {
            await uploadService.deleteImage(thumbnailData.publicId);

            const galleryPublicIds = imageRecords.map(img => img.publicId);
            if (galleryPublicIds.length > 0) {
                await uploadService.deleteMultipleImages(galleryPublicIds);
            }

            throw new Error((error as Error).message);
        }

    },

    async updateProduct(
        id: string,
        body: any,
        newThumbnailData: { url: string, publicId: string } | undefined,
        newImageRecords: any[],
        imagesToDeleteIds: string[],
        adminId: string
    ) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        const currentProduct = await this.findActiveProduct(id);

        if (imagesToDeleteIds.length > 0) {
            const imagesToRemove = await prisma.productImage.findMany({
                where: {
                    id: {
                        in: imagesToDeleteIds
                    },
                    productId: id
                }
            });
            const publicIds = imagesToRemove.map(img => img.publicId);

            await prisma.productImage.deleteMany({
                where: {
                    id: {
                        in: imagesToDeleteIds
                    }
                }
            });
            await uploadService.deleteMultipleImages(publicIds);
        }

        const updateData: any = {};
        if (newThumbnailData) {
            if (currentProduct.thumbnailPublicId) {
                await uploadService.deleteImage(currentProduct.thumbnailPublicId);
            }
            updateData.thumbnail = newThumbnailData.url;
            updateData.thumbnailPublicId = newThumbnailData.publicId;
        }

        if (body.sku) updateData.sku = body.sku;
        if (body.name) updateData.name = body.name;
        if (body.slug) updateData.slug = body.slug;
        if (body.description) updateData.description = body.description;
        if (body.price) updateData.price = new Decimal(body.price);
        if (body.stock !== undefined) updateData.stock = Number(body.stock);
        if (body.categoryId) updateData.categoryId = body.categoryId;
        if (body.isFeatured !== undefined) updateData.isFeatured = String(body.isFeatured) === "true";
        if (body.attributes) updateData.attributes = typeof body.attributes === "string" ? JSON.parse(body.attributes) : body.attributes;


        const productUpdate = await prisma.product.update({
            where: {
                id
            },
            data: {
                ...updateData,
                images: {
                    create: newImageRecords
                }
            },
            include: {
                images: true
            }
        });

        adminLogService.createLog(adminId, adminAction.UPDATE, "Update product success")

        return productUpdate
    },

    async deleteProduct(id: string, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        await this.findActiveProduct(id);
        const productDelete = await prisma.product.update({
            where: {
                id
            },
            data: {
                deletedAt: new Date()
            }
        });

        adminLogService.createLog(adminId, adminAction.DELETE, "Delete product success")

        return productDelete
    }
};