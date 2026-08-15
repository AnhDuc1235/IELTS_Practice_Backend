import { prisma } from "../utils/prisma";
import { uploadService } from "./upload.service";
import { adminAction, adminLogService } from "./adminLog.service";
import { userService } from "./user.service";
import { slideQuery } from "../types/slide.type";

export const slideService = {
    async getSlide(query: slideQuery) {
        const { page, limit, sort } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const where: any = {
            deletedAt: null
        };
        let orderBy: any = {
            createdAt: "desc"
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

        const [slides, slideCount] = await Promise.all([
            prisma.slide.findMany({
                where,
                skip,
                take: Number(limit),
                orderBy,
                include: {
                    images: true
                }
            }),
            prisma.slide.count({
                where
            })
        ]);

        return { slides, total: slideCount };
    },

    async findActiveSlide(id: string) {
        const slide = await prisma.slide.findFirst({
            where: {
                id,
                deletedAt: null
            }
        });
        if (!slide) {
            throw new Error("slide not found or deleted")
        };
        return slide;
    },

    async getSlideById(id: string) {
        return await prisma.slide.findFirst({
            where: {
                id: id,
                deletedAt: null
            },
            include: {
                images: true
            }
        });
    },

    async getImagesByIds(ids: string[], slideId: string) {
        return await prisma.slideImage.findMany({
            where: {
                id:
                {
                    in: ids
                },
                slideId
            }
        });
    },

    async createSlide(body: any, slideData: { url: string, publicId: string }, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        try {
            const slideCreate = await prisma.slide.create({
                data: {
                    title: body.title,
                    imageUrl: slideData.url,
                    publicId: slideData.publicId,
                    linkUrl: body.linkUrl,
                    order: Number(body.order),
                    images: {
                        create: slideData
                    }
                },
                include: {
                    images: true
                },
            });

            adminLogService.createLog(adminId, adminAction.CREATE, "Create slide success")
            return slideCreate
        } catch (error) {
            await uploadService.deleteImage(slideData.publicId);
            throw new Error((error as Error).message);
        }
    },

    async updateSlide(
        id: string,
        body: any,
        newSlideData: { url: string, publicId: string } | undefined,
        imagesToDeleteIds: string[],
        adminId: string
    ) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        const currentSlide = await this.findActiveSlide(id);

        if (imagesToDeleteIds.length > 0) {
            const imagesToRemove = await prisma.slideImage.findMany({
                where: {
                    id: {
                        in: imagesToDeleteIds
                    },
                    slideId: id
                }
            });
            const publicIds = imagesToRemove.map(img => img.publicId);

            await prisma.slideImage.deleteMany({
                where: {
                    id: {
                        in: imagesToDeleteIds
                    }
                }
            });
            await uploadService.deleteMultipleImages(publicIds);
        }

        const updateData: any = {};
        if (newSlideData) {
            if (currentSlide.publicId) {
                await uploadService.deleteImage(currentSlide.publicId);
            }
            updateData.imageUrl = newSlideData.url;
            updateData.publicId = newSlideData.publicId;
        }

        if (body.title) updateData.title = body.title;
        if (body.linkUrl) updateData.linkUrl = body.linkUrl

        const slideUpdate = await prisma.slide.update({
            where: {
                id
            },
            data: {
                ...updateData,
                ...(newSlideData
                    ? {
                        images: {
                            create: newSlideData,
                        },
                    }
                    : {}),
            },
            include: {
                images: true
            }
        });

        adminLogService.createLog(adminId, adminAction.UPDATE, "update slide success")

        return slideUpdate
    },

    async deleteSlide(id: string, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        await this.findActiveSlide(id);
        const slideDelete = await prisma.slide.update({
            where: {
                id
            },
            data: {
                deletedAt: new Date()
            }
        });

        adminLogService.createLog(adminId, adminAction.DELETE, "Delete slide success")

        return slideDelete
    }
};