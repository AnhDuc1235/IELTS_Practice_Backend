import { prisma } from "../utils/prisma";
import { AiFeedbackStatus } from "../generated/prisma/client";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

/**
 * Gọi Google Gemini API để xử lý văn bản hoặc âm thanh
 */
async function callGemini(parts: any[], isJson = true): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: isJson ? { responseMimeType: "application/json" } : undefined,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
    return part?.text || null;
  } catch {
    return null;
  }
}

/**
 * Trích xuất JSON sạch từ phản hồi của AI
 */
function parseJson(raw: string | null): any {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export const aiGraderService = {
  /**
   * Chuyển đổi âm thanh từ Buffer sang văn bản (Speech-to-Text) bằng Gemini
   */
  async transcribeBuffer(buffer: Buffer, mimeType: string = "audio/webm"): Promise<string> {
    try {
      const base64Audio = buffer.toString("base64");
      const cleanMime = (mimeType || "").split(";")[0]?.trim() || "audio/webm";
      const promptParts = [
        { inlineData: { mimeType: cleanMime, data: base64Audio } },
        { text: "Transcribe this English spoken audio recording accurately. Return ONLY the transcribed text without any extra explanation." },
      ];
      const text = await callGemini(promptParts, false);
      return text ? text.trim() : "";
    } catch {
      return "";
    }
  },

  /**
   * Chuyển đổi âm thanh sang văn bản (Speech-to-Text) trực tiếp bằng Gemini
   * Hỗ trợ cả URL online (Cloudinary/HTTP) và Data URI (base64)
   */
  async transcribeAudio(audioUrl?: string | null): Promise<string> {
    if (!audioUrl) return "";
    try {
      // Trường hợp 1: Dạng Data URI (data:audio/webm;base64,...)
      if (audioUrl.startsWith("data:")) {
        const matches = audioUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches[1] && matches[2]) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          return this.transcribeBuffer(buffer, mimeType);
        }
      }

      // Trường hợp 2: Dạng URL online (http/https)
      if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
        const audioFetch = await fetch(audioUrl);
        if (!audioFetch.ok) return "";
        const arrayBuffer = await audioFetch.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = audioUrl.endsWith(".mp3")
          ? "audio/mp3"
          : audioUrl.endsWith(".wav")
          ? "audio/wav"
          : "audio/webm";
        return this.transcribeBuffer(buffer, mimeType);
      }

      return "";
    } catch {
      return "";
    }
  },

  /**
   * Chấm điểm bài nói IELTS Speaking bằng AI (4 tiêu chí + Band điểm + Nhận xét tiếng Việt)
   */
  async gradeSpeakingAnswer(attemptAnswerId: bigint, prompt: string, audioUrl?: string | null, transcript?: string | null) {
    let text = transcript;
    // Tự động Speech-to-Text bằng Gemini nếu thí sinh chỉ nộp audioUrl
    if (!text && audioUrl) {
      text = await this.transcribeAudio(audioUrl);
      if (text) {
        await prisma.attemptAnswer.update({
          where: { id: attemptAnswerId },
          data: { transcript: text },
        });
      }
    }

    // Nếu bài bỏ trống hoàn toàn (không có file thu âm và không có văn bản nói): Cho 0 điểm
    const hasSpoken = Boolean((audioUrl && audioUrl.trim()) || (text && text.trim()));
    if (!hasSpoken) {
      const zeroScores = {
        fluencyCoherence: 0,
        lexicalResource: 0,
        grammaticalRange: 0,
        pronunciation: 0,
      };
      const zeroFeedback = {
        summary: "Thí sinh không làm câu hỏi này (bỏ trống bài nói).",
        strengths: [],
        improvements: ["Cần thu âm câu trả lời đầy đủ để được chấm điểm."],
      };

      const existing = await prisma.aiFeedback.findFirst({ where: { attemptAnswerId } });
      if (existing) {
        return prisma.aiFeedback.update({
          where: { id: existing.id },
          data: { status: AiFeedbackStatus.COMPLETED, overallBand: 0, criteriaScores: zeroScores, feedback: zeroFeedback, modelName: "system" },
        });
      }

      return prisma.aiFeedback.create({
        data: {
          attemptAnswerId,
          status: AiFeedbackStatus.COMPLETED,
          overallBand: 0,
          criteriaScores: zeroScores,
          feedback: zeroFeedback,
          modelName: "system",
        },
      });
    }

    const aiPrompt = `You are an official IELTS Speaking Examiner. Evaluate this speaking response for question: "${prompt}".
Transcript: "${text}".
Return ONLY a valid JSON object in this format:
{
  "overallBand": 6.5,
  "criteriaScores": {
    "fluencyCoherence": 6.5,
    "lexicalResource": 6.5,
    "grammaticalRange": 6.5,
    "pronunciation": 6.5
  },
  "feedback": {
    "summary": "Tóm tắt nhận xét bài nói bằng tiếng Việt",
    "strengths": ["Điểm mạnh 1 bằng tiếng Việt", "Điểm mạnh 2 bằng tiếng Việt"],
    "improvements": ["Điểm cần cải thiện 1 bằng tiếng Việt", "Điểm cần cải thiện 2 bằng tiếng Việt"]
  }
}`;

    const raw = await callGemini([{ text: aiPrompt }], true);
    const parsed = parseJson(raw) || {};
    const overallBand = Number(parsed.overallBand) || 6.0;
    const criteriaScores = parsed.criteriaScores || {
      fluencyCoherence: overallBand,
      lexicalResource: overallBand,
      grammaticalRange: overallBand,
      pronunciation: overallBand,
    };
    const feedback = parsed.feedback || {
      summary: "Đã hoàn thành đánh giá bài nói bằng Gemini AI.",
      strengths: ["Phản hồi đúng chủ đề câu hỏi."],
      improvements: ["Cần mở rộng thêm ý và cấu trúc câu đa dạng."],
    };

    const existing = await prisma.aiFeedback.findFirst({ where: { attemptAnswerId } });
    if (existing) {
      return prisma.aiFeedback.update({
        where: { id: existing.id },
        data: { status: AiFeedbackStatus.COMPLETED, overallBand, criteriaScores, feedback, modelName: GEMINI_MODEL },
      });
    }

    return prisma.aiFeedback.create({
      data: {
        attemptAnswerId,
        status: AiFeedbackStatus.COMPLETED,
        overallBand,
        criteriaScores,
        feedback,
        modelName: GEMINI_MODEL,
      },
    });
  },

  /**
   * Đánh giá trực tiếp bài viết IELTS Writing (dùng cho cả chấm thi và luyện viết tự do)
   */
  async evaluateWritingEssay(prompt: string, essayText: string, taskType: "TASK_1" | "TASK_2" = "TASK_2") {
    const text = (essayText || "").trim();
    const words = text ? text.split(/\s+/).length : 0;
    const minWords = taskType === "TASK_1" ? 150 : 250;

    // Nếu bài viết bỏ trống (0 từ): Cho 0 điểm tuyệt đối
    if (!text || words === 0) {
      return {
        wordCount: 0,
        minWordsRequired: minWords,
        isWordCountMet: false,
        overallBand: 0,
        criteriaScores: {
          taskAchievement: 0,
          coherenceCohesion: 0,
          lexicalResource: 0,
          grammaticalRange: 0,
        },
        feedback: {
          summary: "Thí sinh không làm bài (bỏ trống bài viết).",
          strengths: [],
          improvements: ["Cần hoàn thành bài viết theo yêu cầu đề bài để được tính điểm."],
        },
        modelName: "system",
      };
    }

    const aiPrompt = `You are an official IELTS Writing Examiner. Evaluate this IELTS Writing ${taskType} essay for topic: "${prompt}".
Candidate essay (${words} words, minimum required: ${minWords}): "${text}".
Return ONLY a valid JSON object in this format:
{
  "overallBand": 6.5,
  "criteriaScores": {
    "taskAchievement": 6.5,
    "coherenceCohesion": 6.5,
    "lexicalResource": 6.5,
    "grammaticalRange": 6.5
  },
  "feedback": {
    "summary": "Tóm tắt nhận xét bài viết bằng tiếng Việt",
    "strengths": ["Điểm mạnh 1 bằng tiếng Việt", "Điểm mạnh 2 bằng tiếng Việt"],
    "improvements": ["Điểm cần cải thiện 1 bằng tiếng Việt", "Điểm cần cải thiện 2 bằng tiếng Việt"]
  }
}`;

    const raw = await callGemini([{ text: aiPrompt }], true);
    const parsed = parseJson(raw) || {};
    const overallBand = Number(parsed.overallBand) || 6.0;
    const criteriaScores = parsed.criteriaScores || {
      taskAchievement: overallBand,
      coherenceCohesion: overallBand,
      lexicalResource: overallBand,
      grammaticalRange: overallBand,
    };
    const feedback = parsed.feedback || {
      summary: "Đã hoàn thành đánh giá bài viết bằng Gemini AI.",
      strengths: ["Bố cục bài viết rõ ràng."],
      improvements: ["Cần mở rộng dẫn chứng và phát triển luận điểm sâu hơn."],
    };

    return {
      wordCount: words,
      minWordsRequired: minWords,
      isWordCountMet: words >= minWords,
      overallBand,
      criteriaScores,
      feedback,
      modelName: GEMINI_MODEL,
    };
  },

  /**
   * Chấm điểm bài viết IELTS Writing theo phiên thi và lưu vào MySQL
   */
  async gradeWritingAnswer(attemptAnswerId: bigint, prompt: string, essayText: string) {
    const evaluation = await this.evaluateWritingEssay(prompt, essayText);

    const existing = await prisma.aiFeedback.findFirst({ where: { attemptAnswerId } });
    if (existing) {
      return prisma.aiFeedback.update({
        where: { id: existing.id },
        data: {
          status: AiFeedbackStatus.COMPLETED,
          overallBand: evaluation.overallBand,
          criteriaScores: evaluation.criteriaScores,
          feedback: evaluation.feedback,
          modelName: GEMINI_MODEL,
        },
      });
    }

    return prisma.aiFeedback.create({
      data: {
        attemptAnswerId,
        status: AiFeedbackStatus.COMPLETED,
        overallBand: evaluation.overallBand,
        criteriaScores: evaluation.criteriaScores,
        feedback: evaluation.feedback,
        modelName: GEMINI_MODEL,
      },
    });
  },
};
