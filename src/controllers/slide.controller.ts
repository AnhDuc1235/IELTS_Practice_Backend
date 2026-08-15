import { Request, Response } from "express";
import { uploadService } from "../services/upload.service";
import { slideQuery } from "../types/slide.type";
import { slideService } from "../services/slide.service";
import { success } from "zod";

export const slideController = {
  getSlide: async (req: Request, res: Response) => {
    try {
      const query: slideQuery = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        sort: req.query.sort as string,
      };

      const { slides, total } = await slideService.getSlide(query);
      res.json({
        succes: true,
        message: "Get slides success",
        data: slides,
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
  getSlideById: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const slide = await slideService.getSlideById(id);
      res.json({
        success: true,
        message: "Get slide by Id success",
        data: slide
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  createSlide: async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const imageFiles = files?.['slides']?.[0];

      if (!imageFiles) {
        return res.status(400).json({ 
          success: false,
          message: "Need to upload slide Image" 
        });
      }

      const slideImage = await uploadService.uploadImage(imageFiles, "slide");
      const slideImageData = {
        url: slideImage.secure_url,
        publicId: slideImage.public_id
      };

      const slide = await slideService.createSlide(body, slideImageData, req.user?.id as string);
      res.json({
        success: true,
        message: "Create slide success",
        data: slide
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  updateSlide: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const body = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      const newImageFiles = files?.['slides']?.[0];

      let imagesToDeleteIds = body.imagesToDeleteIds;
      if (typeof imagesToDeleteIds === 'string') imagesToDeleteIds = [imagesToDeleteIds];
      else if (!imagesToDeleteIds) imagesToDeleteIds = [];

      let newSlideData = undefined;
      if (newImageFiles) {
        const slideData = await uploadService.uploadImage(newImageFiles, "post");
        newSlideData = {
          url: slideData.secure_url,
          publicId: slideData.public_id
        };
      }

      const slide = await slideService.updateSlide(
        id,
        body,
        newSlideData,
        imagesToDeleteIds,
        req.user?.id as string
      );
      res.json({
        success: true,
        message: "Update slide success",
        data: slide
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  deleteSlide: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const slide = await slideService.deleteSlide(id, req.user?.id as string);
      res.json({
        success: true,
        message: "Delete slide success",
        data: slide
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
};