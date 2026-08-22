// NOTE: still points at a local Redis for now. This will be reconfigured to
// point at the new Docker/Redis instance once that's set up — auth/otp code
// keeps using `redisClient` as-is, only the connection details below change.
import { createClient } from "redis";
export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
}).on("error", (err) => console.log("Redis Client Error", err));

redisClient.connect();
