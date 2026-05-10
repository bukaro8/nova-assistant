import "dotenv/config";

import { prisma } from "../db/prisma";
import { pollHabitReplies } from "./habit-bot";
import { startHabitScheduler } from "./habit-scheduler";

async function shutdown() {
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

async function main() {
  console.log("Starting Telegram habit listener and scheduler.");

  await Promise.all([pollHabitReplies(), startHabitScheduler()]);
}

main().catch(async (error) => {
  console.error("[telegram:habit:dev] Caught error.", error);
  await prisma.$disconnect();
  process.exit(1);
});
