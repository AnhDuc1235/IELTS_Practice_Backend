import { Request, Response } from "express"
import { testService } from "../services/test.service";
import { errorType } from "../types/error";
import { testQuery } from "../types/test.type";
import { idFormat } from "../utils/idFormat";

export const testController = {
    // GET /test - published tests; with an access token each test also has the user's `progress`
    getTests: async (req: Request, res: Response) => {
        try {
            const query: testQuery = {
                page: Math.max(1, Number(req.query.page) || 1),
                limit: Math.min(50, Math.max(1, Number(req.query.limit) || 10)),
                skill: req.query.skill as string,
                category: req.query.category as string,
            };

            const { tests, total } = await testService.getTests(query, req.user?.id);

            return res.json({
                success: true,
                message: "Get tests success",
                data: tests,
                pagination: {
                    page: query.page,
                    limit: query.limit,
                    total: total,
                    totalPages: Math.ceil(total / query.limit),
                },
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    // GET /test/:testId - test detail; with an access token it also has the user's `progress`
    getTest: async (req: Request, res: Response) => {
        try {
            const testId = idFormat(req.params.testId, "testId");
            const test = await testService.getTest(testId, req.user?.id);

            return res.json({
                success: true,
                message: "Get test success",
                data: test
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
    // GET /test/:testId/content?attemptId= - question groups / questions / options of the test
    // merged with the answers the logged-in user already saved (their attempt progress)
    getTestContent: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const testId = idFormat(req.params.testId, "testId");
            const attemptId = req.query.attemptId ? idFormat(req.query.attemptId, "attemptId") : undefined;

            const content = await testService.getTestContent(testId, userId, attemptId);

            return res.json({
                success: true,
                message: "Get test content success",
                data: content
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message
            });
        }
    },
}
