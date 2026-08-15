import { Request, Response } from "express";
import { productService } from "../services/product.service";
import { uploadService } from "../services/upload.service";
import { productQuery } from "../types/product.type";

export const productController = {
  getProduct: async (req: Request, res: Response) => {
    try {
      const query: productQuery = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search as string,
        category: req.query.category as string,
        sort: req.query.sort as string,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : null,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : null,
        price: req.query.price as string
      };

      const { products, total } = await productService.getProduct(query);

      res.json({
        success: true,
        message: "Get products success",
        data: products,
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
  getProductById: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const product = await productService.getProductById(id);
      res.json({
        success: true,
        message: "Get product by id success",
        data: product
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  createProduct: async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const thumbnailFile = files?.['thumbnail']?.[0];
      const imageFiles = files?.['images'] || [];

      if (!thumbnailFile) {
        return res.status(400).json({ 
          success: false,
          message: "Need to upload thumbnail images" 
        });
      }

      const thumbResult = await uploadService.uploadImage(thumbnailFile, "product");
      const thumbnailData = {
        url: thumbResult.secure_url,
        publicId: thumbResult.public_id
      };

      const imageRecords = await uploadService.uploadMultipleImages(imageFiles, "product");

      const product = await productService.createProduct(body, thumbnailData, imageRecords, req.user?.id as string);
      res.json({
        success: true,
        message: "Create Product success",
        data: product
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  updateProduct: async (req: Request, res: Response) => {
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
        const thumbResult = await uploadService.uploadImage(newThumbnailFile, "product");
        newThumbnailData = {
          url: thumbResult.secure_url,
          publicId: thumbResult.public_id
        };
      }

      const newImageRecords = await uploadService.uploadMultipleImages(newImageFiles, "product");

      const product = await productService.updateProduct(
        id,
        body,
        newThumbnailData,
        newImageRecords,
        imagesToDeleteIds,
        req.user?.id as string
      );
      res.json({
        success: true,
        message: "Update product success",
        data: product
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
  deleteProduct: async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const product = await productService.deleteProduct(id, req.user?.id as string);
      res.json({
        success: true,
        message: "Delete product success",
        data: product
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: (error as Error).message
      });
    }
  },
};