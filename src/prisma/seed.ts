import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, Role } from "../generated/prisma/client";
import {
  createDemoTests,
  DEMO_AUTHOR_ID,
  DEMO_TEST_TITLES,
} from "./factories/test.factory";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(databaseUrl),
});

async function seed(): Promise<void> {
  await prisma.user.upsert({
    where: { id: DEMO_AUTHOR_ID },
    update: {},
    create: {
      id: DEMO_AUTHOR_ID,
      email: "demo-test-author@example.test",
      name: "Demo Test Author",
      role: Role.ADMIN,
    },
  });

  await prisma.test.deleteMany({
    where: {
      createdBy: DEMO_AUTHOR_ID,
      title: { in: [...DEMO_TEST_TITLES] },
    },
  });

  for (const test of createDemoTests()) {
    await prisma.test.create({ data: test });
  }

  console.info(`Seeded ${DEMO_TEST_TITLES.length} demo IELTS tests.`);
}

seed()
  .catch((error: unknown) => {
    console.error("Failed to seed demo IELTS tests:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
