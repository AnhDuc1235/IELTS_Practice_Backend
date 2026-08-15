import { Request, Response } from "express";
import { uploadService } from "../services/upload.service";
import { postService } from "../services/post.service";
import { postQuery } from "../types/post.type";

export const postController = {
  getPost: async (req: Request, res: Response) => {
    try {
      const query: postQuery = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search as string,
        sort: req.query.sort as string,
      };

      const { posts, total } = await postService.getPost(query);
      res.json({
        success: true,
        message: "Get posts success",
        data: posts,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: total,
          totalPages: Math.ceil(total / (query.limit ?? 10)),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  getPostById: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const post = await postService.getPostById(id);
      res.json({
        success: true,
        message: "Get post by Id success",
        data: post
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  createPost: async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const thumbnailFile = files?.['thumbnail']?.[0];
      const imageFiles = files?.['images'] || [];

      if (!thumbnailFile) {
        return res.status(400).json({ error: "Need to upload thumbnail images" });
      }

      const thumbResult = await uploadService.uploadImage(thumbnailFile, "post");
      const thumbnailData = {
        url: thumbResult.secure_url,
        publicId: thumbResult.public_id
      };

      const imageRecords = await uploadService.uploadMultipleImages(imageFiles, "post");

      const post = await postService.createPost(body, thumbnailData, imageRecords, req.user?.id as string);
      res.json({
        success: true,
        message: "Create post success",
        data: post
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  updatePost: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const body = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const newThumbnailFile = files?.['thumbnail']?.[0];
      const newImageFiles = files?.['images'] || [];

      let imagesToDeleteIds = body.imagesToDeleteIds;
      if (typeof imagesToDeleteIds === 'string') imagesToDeleteIds = [imagesToDeleteIds];
      else if (!imagesToDeleteIds) imagesToDeleteIds = [];

      let newThumbnailData = undefined;
      if (newThumbnailFile) {
        const thumbResult = await uploadService.uploadImage(newThumbnailFile, "post");
        newThumbnailData = {
          url: thumbResult.secure_url,
          publicId: thumbResult.public_id
        };
      }

      const newImageRecords = await uploadService.uploadMultipleImages(newImageFiles, "post");

      const post = await postService.updatePost(
        id,
        body,
        newThumbnailData,
        newImageRecords,
        imagesToDeleteIds,
        req.user?.id as string
      );
      res.json({
        success: true,
        message: "Update post success",
        data: post
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  deletePost: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const post = await postService.deletePost(id, req.user?.id as string);
      res.json({
        success: true,
        message: "Delete post success",
        data: post
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
};