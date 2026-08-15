import { Request, Response } from "express"
import { cartService } from "../services/cart.Service"

export const cartController = {
    getCart: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const cart = await cartService.getCart(userId);
            return res.json({
                success: true,
                message: "Get cart success",
                data: cart
            });
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: (error as Error).message
            })
        }
    },
    addToCart: async (req: Request, res: Response) => {
        try {
            const addToCart = await cartService.addToCart(req.user!.id, req.body.productId, req.body.quantity)

            return res.json({
                success: true,
                message: "Add to cart success",
                data: addToCart
            })
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: (error as Error).message
            })

        }
    },
    updateCart: async (req: Request, res: Response) => {
        try {
            const { productId } = req.params;
            const { quantity } = req.body;
            const data = await cartService.updateCartItem(req.user!.id, productId as string, quantity);
            return res.json({ 
                success: true,
                message: "Update quantity success", data 
            });
        } catch (error) {
            res.status(400).json({ 
                success: false,
                message: (error as Error).message
            });
        }
    },

    deleteCart: async (req: Request, res: Response) => {
        try {
            const { productId } = req.params;
            await cartService.removeItemCart(req.user!.id, productId as string);
            return res.json({ 
                success: true,
                message: "Delete item success" 
            });
        } catch (error) {
            res.status(400).json({ 
                success: false,
                message: (error as Error).message
            });
        }
    }
}