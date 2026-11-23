import { Request, Response } from "express";
import { testService } from "../services/test.service";
import { errorType } from "../types/error";
import { historyQuery, submitTestBody, testQuery } from "../types/test.type";
import { idFormat } from "../utils/idFormat";

export const testController = {
    // GET /test - Lấy danh sách đề thi đã xuất bản; nếu có access token sẽ kèm tiến trình `progress` của thí sinh
    getTests: async (req: Request, res: Response) => {
        try {
            const query: testQuery = {
                page: Math.max(1, Number(req.query.page) || 1),
                limit: Math.min(50, Math.max(1, Number(req.query.limit) || 10)),
                skill: req.query.skill as string,
                category: req.query.category as string,
                // ?search= tìm kiếm theo tiêu đề đề thi; bỏ qua nếu không phải chuỗi ký tự
                search: typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : undefined,
                sort: req.query.sort as string,
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
                message: (error as Error).message,
            });
        }
    },

    // GET /test/:testId - Lấy chi tiết đề thi; nếu có access token sẽ kèm tiến trình `progress` của thí sinh
    getTest: async (req: Request, res: Response) => {
        try {
            const testId = idFormat(req.params.testId, "testId");
            const test = await testService.getTest(testId, req.user?.id);

            return res.json({
                success: true,
                message: "Get test success",
                data: test,
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message,
            });
        }
    },

    // GET /test/:testId/content?attemptId= - Lấy các phần thi, nhóm câu hỏi, câu hỏi, lựa chọn của đề thi
    // được gộp sẵn với các câu trả lời mà thí sinh đã lưu trước đó
    getTestContent: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const testId = idFormat(req.params.testId, "testId");
            const attemptId = req.query.attemptId ? idFormat(req.query.attemptId, "attemptId") : undefined;

            const content = await testService.getTestContent(testId, userId, attemptId);

            return res.json({
                success: true,
                message: "Get test content success",
                data: content,
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message,
            });
        }
    },

    // POST /test/:testId/submit - Nhận body dạng cây (parts -> questionGroups -> questions -> answer).
    // submit = true: Nộp bài và chấm điểm Reading / Listening; submit = false: Chỉ lưu tiến trình làm dở.
    submitTest: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const testId = idFormat(req.params.testId, "testId");
            const body = req.body as submitTestBody;

            const result = await testService.submitTest(testId, userId, body);

            return res.json({
                success: true,
                message: body.submit ? "Submit test success" : "Save progress success",
                data: result,
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message,
            });
        }
    },

    // GET /attempts/history hoặc /test-history - Lịch sử các lần thi của thí sinh
    getTestHistory: async (req: Request, res: Response) => {
        try {
            const query: historyQuery = {
                page: Math.max(1, Number(req.query.page) || 1),
                limit: Math.min(50, Math.max(1, Number(req.query.limit) || 10)),
            };

            const { attempts, total } = await testService.getTestHistory(req.user!.id, query);

            return res.json({
                success: true,
                message: "Get test history success",
                data: attempts,
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
                message: (error as Error).message,
            });
        }
    },

    // GET /attempts/:attemptId hoặc /test-history/:attemptId - Xem lại bài thi đã hoàn thành:
    // đề thi, các phần thi, nhóm câu hỏi, câu hỏi, câu trả lời của thí sinh, đáp án đúng (Listening/Reading) hoặc nhận xét AI (Writing/Speaking)
    getTestHistoryDetail: async (req: Request, res: Response) => {
        try {
            const userId = req.user!.id;
            const attemptId = idFormat(req.params.attemptId, "attemptId");

            const detail = await testService.getTestHistoryDetail(userId, attemptId);

            return res.json({
                success: true,
                message: "Get test history detail success",
                data: detail,
            });
        } catch (error) {
            return res.status((error as errorType).statusCode ?? 400).json({
                success: false,
                message: (error as Error).message,
            });
        }
    },
};
