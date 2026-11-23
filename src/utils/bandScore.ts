/**
 * Quy đổi số câu đúng sang điểm IELTS Band Score chuẩn (thang điểm 1.0 - 9.0)
 * Theo bảng quy chuẩn IELTS chính thức của British Council & IDP
 */
export function calculateBandScore(correctCount: number, skill: string, category: string = "ACADEMIC"): number {
  const count = Math.max(0, Math.min(40, correctCount));
  const s = (skill || "").toUpperCase();
  const isGeneral = (category || "").toUpperCase() === "GENERAL_TRAINING";

  if (s === "READING") {
    if (isGeneral) {
      if (count >= 40) return 9.0;
      if (count >= 39) return 8.5;
      if (count >= 37) return 8.0;
      if (count >= 36) return 7.5;
      if (count >= 34) return 7.0;
      if (count >= 32) return 6.5;
      if (count >= 30) return 6.0;
      if (count >= 27) return 5.5;
      if (count >= 23) return 5.0;
      if (count >= 19) return 4.5;
      if (count >= 15) return 4.0;
      if (count >= 12) return 3.5;
      if (count >= 8) return 3.0;
      if (count >= 5) return 2.5;
      if (count >= 3) return 2.0;
      if (count >= 1) return 1.0;
      return 0.0;
    } else {
      // Reading Academic
      if (count >= 39) return 9.0;
      if (count >= 37) return 8.5;
      if (count >= 35) return 8.0;
      if (count >= 33) return 7.5;
      if (count >= 30) return 7.0;
      if (count >= 27) return 6.5;
      if (count >= 23) return 6.0;
      if (count >= 19) return 5.5;
      if (count >= 15) return 5.0;
      if (count >= 13) return 4.5;
      if (count >= 10) return 4.0;
      if (count >= 8) return 3.5;
      if (count >= 6) return 3.0;
      if (count >= 4) return 2.5;
      if (count >= 2) return 2.0;
      if (count >= 1) return 1.0;
      return 0.0;
    }
  }

  // Listening (Chuẩn chung cho cả Academic và General Training)
  if (count >= 39) return 9.0;
  if (count >= 37) return 8.5;
  if (count >= 35) return 8.0;
  if (count >= 32) return 7.5;
  if (count >= 30) return 7.0;
  if (count >= 26) return 6.5;
  if (count >= 23) return 6.0;
  if (count >= 18) return 5.5;
  if (count >= 16) return 5.0;
  if (count >= 13) return 4.5;
  if (count >= 10) return 4.0;
  if (count >= 6) return 3.5;
  if (count >= 4) return 3.0;
  if (count >= 3) return 2.5;
  if (count >= 2) return 2.0;
  if (count >= 1) return 1.0;
  return 0.0;
}
