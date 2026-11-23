import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
let dbUrl = process.env.DATABASE_URL || "mysql://root:dev1012@127.0.0.1:3307/IELTS_Pratice";
if (!dbUrl.includes("allowPublicKeyRetrieval")) {
  dbUrl += (dbUrl.includes("?") ? "&" : "?") + "allowPublicKeyRetrieval=true";
}

const adapter = new PrismaMariaDb(dbUrl);
const prisma = new PrismaClient({
  adapter,
  log: [
    {
      emit: "stdout",
      level: "query",
    },
  ],
});
export { prisma };
