import { prisma } from "../utils/prisma"

export const profileService = {
    async updateProfile(userId: string, updateData: Partial<{ email: string, name: string, phone: string, address: string }>) {
        const profileUpdate = await prisma.user.update({
            where: {
                id: userId
            },
            data: updateData
        })

        if (!profileUpdate) {
            throw new Error("Cập nhật thất bại")
        }

        return profileUpdate
    }
}