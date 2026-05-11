import "dotenv/config";

import bcrypt from "bcryptjs";
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

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: {
      email: "victor@example.com",
    },
    update: {
      name: "Victor",
      passwordHash,
    },
    create: {
      name: "Victor",
      email: "victor@example.com",
      passwordHash,
    },
  });

  const habits = [
    {
      name: "Dutasteride",
      code: "Dut",
      reminderTime: "14:00",
      reminderMessage: "Have you taken Dutasteride 💊 ? Reply: Dut",
      icon: "pill",
      colour: "emerald",
      validReplies: ["dut"],
      retryTimes: ["16:00", "18:00"],
      scheduleDays: allDays,
    },
    {
      name: "Walk",
      code: "Walk",
      reminderTime: "20:00",
      reminderMessage: "Have you gone for a walk 🚶🏻‍♂️ ? Reply: Walk",
      icon: "walk",
      colour: "lime",
      validReplies: ["walk"],
      retryTimes: ["21:00"],
      scheduleDays: allDays,
    },
    {
      name: "Training",
      code: "Train",
      reminderTime: "16:00",
      reminderMessage: "Have you trained today 💪 ? Reply: Train",
      icon: "dumbbell",
      colour: "orange",
      validReplies: ["train"],
      retryTimes: ["18:00"],
      scheduleDays: weekdayTrainingDays,
    },
    {
      name: "Magnesium",
      code: "Mag",
      reminderTime: "21:15",
      reminderMessage: "Have you taken Magnesium 😴 ? Reply: Mag",
      icon: "sleep",
      colour: "violet",
      validReplies: ["mag"],
      retryTimes: ["22:00"],
      scheduleDays: allDays,
    },
    {
      name: "Study",
      code: "Study",
      reminderTime: "15:00",
      reminderMessage: "Have you studied English today? 📘 Reply: Study",
      icon: "book",
      colour: "sky",
      validReplies: ["study"],
      retryTimes: [],
      scheduleDays: ["MON", "TUE", "WED", "THU", "SAT"],
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
      },
      create: {
        ...habit,
        active: true,
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
