import { prisma } from "../utils/prisma";
import { uploadService } from "./upload.service";
import { postQuery } from "../types/post.type";
import { adminAction, adminLogService } from "./adminLog.service";
import { userService } from "./user.service";

export const postService = {
    async getPost(query: postQuery) {
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
                        title: { 
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

            const [posts, postCount] = await Promise.all([
                prisma.post.findMany({
                    where,
                    skip,
                    take: Number(limit),
                    orderBy,
                    include: {
                        images: true
                    }
                }),
                prisma.post.count({
                    where
                })
            ]);

            return { posts, total: postCount };
    },

    async findActivePost(id: string) {
        const post = await prisma.post.findFirst({
            where: { 
                id,
                deletedAt: null 
            }
        });
        if (!post) {
            throw new Error("post not found or deleted")
        };
        return post;
    },
    async getPostById(id: string) {
        return await prisma.post.findFirst({
            where: { 
                id: id, 
                deletedAt: null 
            },
            include: { 
                images: true 
            }
        });
    },
    async getImagesByIds(ids: string[], postId: string) {
        return await prisma.postImage.findMany({
            where: { 
                id: { 
                    in: ids 
                }, 
                postId 
            }
        });
    },
    async createPost(body: any, thumbnailData: { url: string, publicId: string }, imageRecords: any[], adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        try {
            const postCreate = await prisma.post.create({
                data: {
                    title: body.title,
                    slug: body.slug,
                    thumbnail: thumbnailData.url,
                    thumbnailPublicId: thumbnailData.publicId,
                    content: body.content,
                    images: {
                        create: imageRecords
                    }
                },
                include: {
                    images: true
                }
            });

            adminLogService.createLog(adminId, adminAction.CREATE, "Create post success")

            return postCreate
        } catch (error) {
            await uploadService.deleteImage(thumbnailData.publicId);

            const galleryPublicIds = imageRecords.map(img => img.publicId);
            if (galleryPublicIds.length > 0) {
                await uploadService.deleteMultipleImages(galleryPublicIds);
            }

            throw new Error((error as Error).message);
        }

    },

    async updatePost(
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
        const currentPost = await this.findActivePost(id);

        if (imagesToDeleteIds.length > 0) {
            const imagesToRemove = await prisma.postImage.findMany({
                where: { 
                    id: { 
                        in: imagesToDeleteIds 
                    }, 
                    postId: id 
                }
            });
            const publicIds = imagesToRemove.map(img => img.publicId);

            await prisma.postImage.deleteMany({
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
            if (currentPost.thumbnailPublicId) {
                await uploadService.deleteImage(currentPost.thumbnailPublicId);
            }
            updateData.thumbnail = newThumbnailData.url;
            updateData.thumbnailPublicId = newThumbnailData.publicId;
        }

        if (body.title) updateData.title = body.title;
        if (body.slug) updateData.slug = body.slug;
        if (body.content) updateData.content = body.content

        const postUpdate = await prisma.post.update({
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

        adminLogService.createLog(adminId, adminAction.UPDATE, "update post success")

        return postUpdate
    },

    async deletePost(id: string, adminId: string) {
        const role = await userService.find(adminId)
        if (role.role === "USER") {
            throw new Error("Only admin can process")
        }
        await this.findActivePost(id);
        const postDelete = await prisma.post.update({
            where: { 
                id 
            },
            data: { 
                deletedAt: new Date() 
            }
        });

        adminLogService.createLog(adminId, adminAction.DELETE, "Delete post success")

        return postDelete
    }
};