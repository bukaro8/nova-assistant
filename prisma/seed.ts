import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const allDays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const weekdayTrainingDays = ["MON", "TUE", "WED", "THU"];
const defaultReplies = ["done", "skip", "missed"];

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: "victor@example.com",
    },
    update: {
      name: "Victor",
    },
    create: {
      name: "Victor",
      email: "victor@example.com",
    },
  });

  const habits = [
    {
      name: "Dutasteride",
      code: "Dut",
      reminderTime: "14:00",
      reminderMessage: "Time to take Dutasteride.",
      retryTimes: ["16:00", "18:00"],
      scheduleDays: allDays,
    },
    {
      name: "Walk",
      code: "Walk",
      reminderTime: "20:00",
      reminderMessage: "Time for your walk.",
      retryTimes: ["21:00"],
      scheduleDays: allDays,
    },
    {
      name: "Training",
      code: "Train",
      reminderTime: "16:00",
      reminderMessage: "Time for training.",
      retryTimes: ["18:00"],
      scheduleDays: weekdayTrainingDays,
    },
    {
      name: "Magnesium",
      code: "Mag",
      reminderTime: "21:15",
      reminderMessage: "Time to take Magnesium.",
      retryTimes: ["22:00"],
      scheduleDays: allDays,
    },
  ];

  for (const habit of habits) {
    await prisma.habit.upsert({
      where: {
        userId_code: {
          userId: user.id,
          code: habit.code,
        },
      },
      update: {
        ...habit,
        active: true,
        validReplies: defaultReplies,
      },
      create: {
        ...habit,
        active: true,
        validReplies: defaultReplies,
        userId: user.id,
      },
    });
  }

  console.log(`Seeded ${habits.length} habits for ${user.email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
