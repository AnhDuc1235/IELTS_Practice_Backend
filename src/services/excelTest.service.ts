import * as XLSX from "xlsx";
import { QuestionType, Skill, TestCategory } from "../generated/prisma/client";

export const excelTestService = {
  /**
   * Đọc file Excel và trích xuất thành cấu trúc JSON của đề thi
   * Pattern bảng tính hỗ trợ:
   * Sheet 'Info' (hoặc dòng đầu): Title, Skill, Category, DurationMinutes
   * Sheet 'Questions': Part | Group | QuestionType | QuestionNo | Content | Options | Answer | Explanation | AudioUrl
   */
  parseExcelToTestJson(fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;

    let title = "Đề thi IELTS Import từ Excel";
    let skill: Skill = Skill.LISTENING;
    let category: TestCategory = TestCategory.ACADEMIC;
    let durationMinutes = 30;

    // 1. Đọc sheet Info nếu có
    if (sheetNames.includes("Info")) {
      const infoSheet = workbook.Sheets["Info"];
      if (infoSheet) {
        const infoData: any[] = XLSX.utils.sheet_to_json(infoSheet, { header: 1 });
        for (const row of infoData) {
          if (!row || row.length < 2) continue;
          const key = String(row[0]).trim().toLowerCase();
          const val = String(row[1]).trim();
          if (key.includes("title")) title = val;
          else if (key.includes("skill")) {
            const upper = val.toUpperCase();
            if (upper in Skill) skill = upper as Skill;
          } else if (key.includes("category")) {
            if (val.toUpperCase().includes("GENERAL")) category = TestCategory.GENERAL_TRAINING;
            else category = TestCategory.ACADEMIC;
          } else if (key.includes("duration")) {
            durationMinutes = Number(val) || durationMinutes;
          }
        }
      }
    }

    // 2. Đọc sheet Questions (hoặc sheet đầu tiên)
    const qSheetName = (sheetNames.includes("Questions") ? "Questions" : sheetNames[0]) || "Sheet1";
    const qSheet = workbook.Sheets[qSheetName];
    if (!qSheet) throw new Error("Excel worksheet not found");
    const rows: any[] = XLSX.utils.sheet_to_json(qSheet);

    const partsMap = new Map<number, any>();

    for (const row of rows) {
      const partNo = Number(row["Part"] || row["part"] || row["PartNo"] || 1);
      const groupNo = Number(row["Group"] || row["group"] || row["GroupNo"] || 1);
      const qTypeRaw = String(row["QuestionType"] || row["type"] || "FILL_BLANK").toUpperCase();
      const questionNo = Number(row["QuestionNo"] || row["qNo"] || row["No"] || 1);
      const content = String(row["Content"] || row["question"] || "").trim();
      const optionsRaw = row["Options"] || row["options"] || "";
      const answerRaw = String(row["Answer"] || row["answer"] || "").trim();
      const explanation = row["Explanation"] || row["explanation"] || "";
      const audioUrl = row["AudioUrl"] || row["audioUrl"] || "";

      let questionType: QuestionType = QuestionType.FILL_BLANK;
      if (qTypeRaw in QuestionType) {
        questionType = qTypeRaw as QuestionType;
      } else if (qTypeRaw.includes("MULTI")) {
        questionType = QuestionType.MCQ_MULTI;
      } else if (qTypeRaw.includes("MCQ") || qTypeRaw.includes("CHOICE")) {
        questionType = QuestionType.MCQ_SINGLE;
      } else if (qTypeRaw.includes("MATCH")) {
        questionType = QuestionType.MATCHING;
      } else if (qTypeRaw.includes("TRUE") || qTypeRaw.includes("TF")) {
        questionType = QuestionType.TRUE_FALSE_NG;
      } else if (qTypeRaw.includes("YES") || qTypeRaw.includes("YN")) {
        questionType = QuestionType.YES_NO_NG;
      } else if (qTypeRaw.includes("SHORT")) {
        questionType = QuestionType.SHORT_ANSWER;
      } else if (qTypeRaw.includes("ESSAY") || qTypeRaw.includes("WRIT") || qTypeRaw.includes("TASK")) {
        questionType = QuestionType.ESSAY;
      } else if (qTypeRaw.includes("SPEAK")) {
        questionType = QuestionType.SPEAKING;
      }

      // Xử lý options: "A. option1 | B. option2 | C. option3"
      const options: Array<{ label: string; content: string }> = [];
      if (optionsRaw) {
        const parts = String(optionsRaw).split(/[|\n]/).map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
          const match = p.match(/^([A-Z])[\.:\s]+(.+)$/);
          if (match && match[1] && match[2]) {
            options.push({ label: match[1], content: match[2].trim() });
          } else {
            options.push({ label: String.fromCharCode(65 + options.length), content: p });
          }
        }
      }

      // Khởi tạo Part nếu chưa có
      if (!partsMap.has(partNo)) {
        partsMap.set(partNo, {
          partNo,
          title: `Part ${partNo}`,
          audioUrl: audioUrl || undefined,
          questionGroupsMap: new Map<number, any>(),
        });
      }

      const partObj = partsMap.get(partNo);
      if (audioUrl && !partObj.audioUrl) partObj.audioUrl = audioUrl;

      // Khởi tạo Group nếu chưa có
      if (!partObj.questionGroupsMap.has(groupNo)) {
        partObj.questionGroupsMap.set(groupNo, {
          groupNo,
          questionType,
          questions: [],
        });
      }

      const groupObj = partObj.questionGroupsMap.get(groupNo);
      groupObj.questions.push({
        questionNo,
        content: content || `Question ${questionNo}`,
        points: 1.0,
        explanation: explanation || undefined,
        options: options.length > 0 ? options : undefined,
        answers: answerRaw ? [{ answerText: answerRaw }] : [],
      });
    }

    // Biến đổi Map thành mảng Parts chuẩn
    const parts = Array.from(partsMap.values()).map((p) => ({
      partNo: p.partNo,
      title: p.title,
      audioUrl: p.audioUrl,
      questionGroups: Array.from(p.questionGroupsMap.values()).map((g: any) => ({
        groupNo: g.groupNo,
        questionType: g.questionType,
        questions: g.questions,
      })),
    }));

    return {
      title,
      skill,
      category,
      durationMinutes,
      parts,
    };
  },

  /**
   * Tạo tệp Excel mẫu chuẩn (.xlsx) để người dùng tải về điền đề thi
   */
  generateTemplateExcel(): Buffer {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Thông tin đề
    const infoRows = [
      ["Thuộc tính", "Giá trị"],
      ["Title", "IELTS Listening Practice Test Template"],
      ["Skill", "LISTENING"], // LISTENING, READING, WRITING, SPEAKING
      ["Category", "ACADEMIC"], // ACADEMIC hoặc GENERAL_TRAINING
      ["DurationMinutes", 30],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
    XLSX.utils.book_append_sheet(wb, wsInfo, "Info");

    // Sheet 2: Danh sách câu hỏi mẫu
    const qRows = [
      {
        Part: 1,
        Group: 1,
        QuestionType: "FILL_BLANK",
        QuestionNo: 1,
        Content: "Name: Helen ______",
        Options: "",
        Answer: "Thompson",
        Explanation: "The speaker spells T-H-O-M-P-S-O-N clearly in recording.",
        AudioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
      {
        Part: 1,
        Group: 1,
        QuestionType: "FILL_BLANK",
        QuestionNo: 2,
        Content: "Email address: helen123@ ______.com",
        Options: "",
        Answer: "marketmail",
        Explanation: "Directly mentioned as marketmail.",
        AudioUrl: "",
      },
      {
        Part: 2,
        Group: 1,
        QuestionType: "MCQ_SINGLE",
        QuestionNo: 3,
        Content: "Why did the council build the new community center?",
        Options: "A. Replace old library | B. Encourage fitness | C. Host events",
        Answer: "B",
        Explanation: "The council aimed to improve physical activities for locals.",
        AudioUrl: "",
      },
    ];
    const wsQ = XLSX.utils.json_to_sheet(qRows);
    XLSX.utils.book_append_sheet(wb, wsQ, "Questions");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  },
};
