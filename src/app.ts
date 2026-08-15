import express from "express";
import cors from "cors";
import "dotenv/config";
import "./workers/index.worker";
import "./schedulers/index"
import authRouter from "./routes/auth.route";
import cartRouter from "./routes/cart.route";
import productRouter from "./routes/product.route";
import categoryRouter from "./routes/category.route";
import profileRouter from "./routes/profile.route";
import uploadRouter from "./routes/upload.route";
import postRouter from "./routes/post.route";
import userRouter from "./routes/user.route";
import adminRouter from "./routes/admin.route";
import slideRouter from "./routes/slide.route";
import orderRouter from "./routes/order.route";
import revenueRouter from "./routes/revenue.route";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const localCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:3002",
  "http://localhost:4000",
  "http://localhost:4002",
  "http://3.26.223.90:3000"
];
const envCorsOrigins = [
  process.env.FRONTEND,
  process.env.DASHBOARD,
  process.env.CORS_ORIGINS,
]
  .flatMap((origin) => origin?.split(",") ?? [])
  .map((origin) => origin.trim())
  .filter((origin): origin is string => Boolean(origin));
const corsOrigins = Array.from(new Set([...localCorsOrigins, ...envCorsOrigins]));

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/", (req, res) => {
  res.send({});
});

app.use("/", authRouter);
app.use("/", cartRouter);
app.use("/", productRouter);
app.use("/", categoryRouter);
app.use("/", profileRouter);
app.use("/", uploadRouter);
app.use("/", postRouter);
app.use("/", userRouter);
app.use("/", adminRouter);
app.use("/", slideRouter);
app.use("/", orderRouter);
app.use("/", revenueRouter);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
