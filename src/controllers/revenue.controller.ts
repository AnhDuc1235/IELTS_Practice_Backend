import { Request, Response } from "express";
import { dateTimeFormat } from "../utils/datetimeFormat";
import { revenueService } from "../services/revenue.service";

export const revenueController = {
    getOverview: async (req: Request, res: Response) => {
        const { from, to } = dateTimeFormat(req.query)
        const data = await revenueService.getOverview(from, to)
        return res.json({
            message: "Get overview success",
            data: data
        })
    },
    getRevenueChart: async (req: Request, res: Response) =>{
        const { period, year, month } = req.query
        const data = await revenueService.getRevenueChart(String(period), Number(year), Number(month))
        return res.json({
            message: "Get revenue chart success",
            data: data
        })
    },
    getOrderStatus: async (req: Request, res: Response) =>{
        const { from, to } = dateTimeFormat(req.query)
        const data = await revenueService.getOrderStats(from, to)
        return res.json({
            message: "Get orderStatus success",
            data: data
        })
    },
    getTopProduct: async (req: Request, res: Response) =>{
        const { from, to } = dateTimeFormat(req.query) 
        const data = await revenueService.getTopProduct(from, to, req.query.limit as unknown as number)
        return res.json({
            message: "Get orderStatus success",
            data: data
        })
    }
    
}