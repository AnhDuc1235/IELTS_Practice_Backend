import z from "zod";
import { submitTestSchema } from "../validators/test.validate";

// Các tham số query khi tìm kiếm và phân trang danh sách đề thi
export type testQuery = {
    page: number;
    limit: number;
    skill?: string | undefined;
    category?: string | undefined;
    search?: string | undefined;
    sort?: string | undefined;
};

// Các tham số query khi xem lịch sử thi
export type historyQuery = {
    page: number;
    limit: number;
};

// Kiểu dữ liệu body của POST /test/:testId/submit (sau khi validate qua submitTestSchema)
export type submitTestBody = z.output<typeof submitTestSchema>;
