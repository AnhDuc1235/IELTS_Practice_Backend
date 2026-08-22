import express from "express";
import cors from "cors";
import "dotenv/config";
import authRouter from "./routes/auth.route";
import profileRouter from "./routes/profile.route";
import uploadRouter from "./routes/upload.route";
import userRouter from "./routes/user.route";
import adminRouter from "./routes/admin.route";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.send({});
});

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", uploadRouter);
app.use("/", userRouter);
app.use("/", adminRouter);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
