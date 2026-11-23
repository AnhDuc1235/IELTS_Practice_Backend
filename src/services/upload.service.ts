import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Cấu hình Cloudinary nếu có khai báo trong .env
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME as string,
    api_key: process.env.CLOUDINARY_API_KEY as string,
    api_secret: process.env.CLOUDINARY_API_SECRET as string,
  });
}

// Thư mục lưu file trên server nếu không dùng Cloudinary
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const uploadService = {
  // Tải file lên (hỗ trợ cả file ảnh và file âm thanh ghi âm)
  async uploadFile(file: Express.Multer.File, folder: string = "editor_uploads") {
    if (!file) throw new Error("Chưa có file nào được tải lên");

    // Trường hợp 1: Tải lên Cloudinary
    if (hasCloudinary) {
      try {
        const base64Data = Buffer.from(file.buffer).toString("base64");
        const dataUri = `data:${file.mimetype};base64,${base64Data}`;
        const isAudio = file.mimetype.startsWith("audio/");
        const res = await cloudinary.uploader.upload(dataUri, {
          folder,
          resource_type: isAudio ? "video" : "auto",
        });
        return { url: res.secure_url, publicId: res.public_id };
      } catch (err) {
        console.warn("Cloudinary upload failed, falling back to local server storage:", (err as Error).message);
      }
    }

    // Trường hợp 2: Lưu trực tiếp vào thư mục uploads/ của server
    const ext = path.extname(file.originalname) || (file.mimetype.startsWith("audio/") ? ".webm" : ".bin");
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    await fs.promises.writeFile(filePath, file.buffer);

    const port = process.env.PORT || 3001;
    return {
      url: `http://localhost:${port}/uploads/${fileName}`,
      publicId: fileName,
    };
  },

  // Upload ảnh (gọi lại uploadFile để code ngắn gọn, không lặp lại)
  async uploadImage(file: Express.Multer.File, folder: string = "editor_uploads") {
    return this.uploadFile(file, folder);
  },

  // Xóa ảnh khi cần
  async deleteImage(publicId: string) {
    if (hasCloudinary) {
      await cloudinary.uploader.destroy(publicId);
    } else {
      const filePath = path.join(UPLOAD_DIR, publicId);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }
    return true;
  },
};
