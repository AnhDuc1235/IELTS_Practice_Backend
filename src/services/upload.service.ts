// TODO: replace this with Cloudflare R2 (S3-compatible SDK, e.g. @aws-sdk/client-s3).
// Cloudinary has been removed. Keep the same method signatures (uploadImage /
// uploadMultipleImages / deleteImage / deleteMultipleImages) so callers don't
// need to change, and return { url, publicId } (or the R2 equivalent: object key)
// once the R2 client is wired up.

export const uploadService = {
    async uploadImage(file: Express.Multer.File, folder: string): Promise<{ url: string; publicId: string }> {
        throw new Error("Upload storage not configured yet (Cloudinary removed, R2 pending)");
    },

    async uploadMultipleImages(files: Express.Multer.File[], folder: string) {
        if (!files || files.length === 0) return [];

        const uploadPromises = files.map(file => this.uploadImage(file, folder));
        return Promise.all(uploadPromises);
    },

    async deleteImage(publicId: string) {
        throw new Error("Upload storage not configured yet (Cloudinary removed, R2 pending)");
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
