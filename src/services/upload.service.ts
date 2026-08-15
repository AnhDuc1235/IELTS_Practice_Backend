import cloudinary from "../config/cloudinary.config";

export const uploadService = {
    async uploadImage(file: Express.Multer.File, folder: string): Promise<any> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ folder: folder },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(file.buffer);
        });
    },

    async uploadMultipleImages(files: Express.Multer.File[], folder: string) {
        if (!files || files.length === 0) return [];

        const uploadPromises = files.map(file => this.uploadImage(file, folder));
        const results = await Promise.all(uploadPromises);

        return results.map(res => ({
            url: res.secure_url,
            publicId: res.public_id
        }));
    },

    async deleteImage(publicId: string) {
        try {
            return await cloudinary.uploader.destroy(publicId, { invalidate: true });
        } catch (error) {
            throw new Error(`Cannot delete image from Cloudinary`);
        }
    },

    async deleteMultipleImages(publicIds: string[]) {
        if (!publicIds || publicIds.length === 0) {
            throw new Error("cannot find ids")
        };
        const validIds = publicIds.filter(id => id);
        const deletePromises = validIds.map(id => this.deleteImage(id));
        await Promise.all(deletePromises);
    }
};