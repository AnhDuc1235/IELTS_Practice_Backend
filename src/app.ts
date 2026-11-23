import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import authRouter from "./routes/auth.route";
import profileRouter from "./routes/profile.route";
import uploadRouter from "./routes/upload.route";
import userRouter from "./routes/user.route";
import adminRouter from "./routes/admin.route";
import testRouter from "./routes/test.route";
import annotationRouter from "./routes/annotation.route";
import attemptRouter from "./routes/attempt.route";
import adminTestRouter from "./routes/adminTest.route";
import writingRouter from "./routes/writing.route";

// Tự động chuyển đổi BigInt sang string khi serialize JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files cho uploads (âm thanh, ảnh, audio thi IELTS)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/", (req, res) => {
  res.send({});
});

// Các route hệ thống và xác thực
app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", uploadRouter);
app.use("/", userRouter);
app.use("/", adminRouter);

// Các route: Attempts, Autosave & Annotations
app.use("/", annotationRouter);
app.use("/api", annotationRouter);

app.use("/", attemptRouter);
app.use("/api", attemptRouter);

// Các route đề thi của bạn Huy
app.use("/", testRouter);
app.use("/api", testRouter);

app.use("/", adminTestRouter);
app.use("/api", adminTestRouter);

app.use("/", writingRouter);
app.use("/api", writingRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
