import { prisma } from "../utils/prisma"
import { productService } from "./product.service"
export const cartService = {
    async addToCart(userId: string, productId: string, quantity: number) {
        const product = await productService.getProductById(productId)
        if (!product) {
            throw new Error("Cannot find product")
        }
        const cart = await prisma.cart.upsert({
            where: {
                userId
            },
            update: {},
            create: {
                userId
            }
        })
        const productExisting = await prisma.cartItem.findFirst({
            where: {
                cartId: cart.id,
                productId: productId
            },
        })

        const currentQuantity = productExisting ? productExisting.quantity : 0
        const totalRequestQuantity = quantity + currentQuantity

        if (totalRequestQuantity > product.stock) {
            throw new Error("Not enough stock",)
        }

        const upsertCart = await prisma.cartItem.upsert({
            where: {
                cartId_productId: {
                    cartId: cart.id,
                    productId: productId,
                },
            },
            update: {
                quantity: { increment: quantity }
            },
            create: {
                cartId: cart.id,
                productId: productId,
                quantity: quantity
            }
        })

        return upsertCart
    },
    async getCart(userId: string) {
        const cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                cartItems: {
                    include: {
                        product: true
                    }
                }
            }
        });
        if (!cart) {
            return {
                cartItems: [],
                totalItems: 0,
                totalPrice: 0,
                totalUniqueItems: 0
            };
        }
        const totalItems = cart.cartItems.reduce((sum, item) => sum + item.quantity, 0)
        const totalPrice = cart.cartItems.reduce((sum, item) => sum + item.quantity * Number(item.product.price), 0)

        return {
            ...cart,
            totalItems,
            totalPrice,
            totalUniqueItems: cart.cartItems.length
        }
    },
    async updateCartItem(userId: string, productId: string, quantity: number) {
        const product = await productService.getProductById(productId)
        if (!product) {
            throw new Error("Cannot find product")
        }
        if (quantity <= 0) {
            return await this.removeItemCart(userId, productId);
        }

        if (quantity > product.stock) {
            throw new Error("Not enough stock");
        }

        const cart = await prisma.cart.findUnique({
            where: { userId }
        });
        if (!cart) {
            throw new Error("Cart not found");
        }
        const updateCart = await prisma.cartItem.update({
            where: {
                cartId_productId: {
                    cartId: cart.id, productId
                }
            },
            data: {
                quantity
            }
        });

        return updateCart
    },

    async removeItemCart(userId: string, productId: string) {
        const cart = await prisma.cart.findUnique({
            where: {
                userId
            }
        });
        if (!cart) {
            throw new Error("Cart not found");
        }
        const cartDelete = await prisma.cartItem.deleteMany({
            where: {
                cartId: cart.id,
                productId: productId
            }
        });

        return cartDelete
    }
}