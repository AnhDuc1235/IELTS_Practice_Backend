import { Request, Response } from "express";
import { adminTestService } from "../services/adminTest.service";
import { excelTestService } from "../services/excelTest.service";

export const adminTestController = {
  // GET /tests hoặc /api/tests - Danh sách đề thi cho Admin
  getTests: async (req: Request, res: Response) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const skill = req.query.skill as string;
      const category = req.query.category as string;
      const search = req.query.search as string;

      const { tests, total } = await adminTestService.getTests({ skill, category, search, page, limit });

      return res.json({
        success: true,
        message: "Get tests success",
        data: tests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /tests/:id hoặc /api/tests/:id - Chi tiết đề thi
  getTestById: async (req: Request, res: Response) => {
    try {
      const id = BigInt(String(req.params.id));
      const test = await adminTestService.getTestById(id);
      return res.json({ success: true, message: "Get test success", data: test });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // POST /tests hoặc /api/tests - Tạo đề thi mới
  createTest: async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const test = await adminTestService.createTest(userId, req.body);
      return res.status(201).json({ success: true, message: "Test created successfully", data: test });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // PUT /tests/:id hoặc /api/tests/:id - Cập nhật đề thi
  updateTest: async (req: Request, res: Response) => {
    try {
      const id = BigInt(String(req.params.id));
      const test = await adminTestService.updateTest(id, req.body);
      return res.json({ success: true, message: "Test updated successfully", data: test });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // DELETE /tests/:id hoặc /api/tests/:id - Xóa đề thi
  deleteTest: async (req: Request, res: Response) => {
    try {
      const id = BigInt(String(req.params.id));
      await adminTestService.deleteTest(id);
      return res.json({ success: true, message: "Test deleted successfully" });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // POST /tests/import-excel hoặc /api/tests/import-excel - Đọc file Excel ra JSON đề thi
  importExcel: async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No excel file provided" });
      }

      const testJson = excelTestService.parseExcelToTestJson(req.file.buffer);
      return res.json({
        success: true,
        message: "Import excel success",
        data: testJson,
      });
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },

  // GET /tests/template-excel hoặc /api/tests/template-excel - Tải tệp Excel mẫu chuẩn
  downloadTemplate: async (req: Request, res: Response) => {
    try {
      const buffer = excelTestService.generateTemplateExcel();
      res.setHeader("Content-Disposition", "attachment; filename=ielts_test_template.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(buffer);
    } catch (error) {
      return res.status(400).json({ success: false, message: (error as Error).message });
    }
  },
};
