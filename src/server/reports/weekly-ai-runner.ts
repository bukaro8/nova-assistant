import "dotenv/config";

import { prisma } from "../db/prisma";
import { generateWeeklyAiReportsForDueUsers } from "./weekly-ai-report";

async function runWeeklyReportsOnce() {
  const startedAt = Date.now();

  console.log("[weekly-ai] Started.");

  const result = await generateWeeklyAiReportsForDueUsers({
    stagger: false,
  });

  console.log("[weekly-ai] Completed.", {
    processed: result.total,
    generated: result.stored,
    skipped: result.skipped + result.existing,
    failed: result.fallback,
    durationMs: Date.now() - startedAt,
  });
}

runWeeklyReportsOnce()
  .catch((error) => {
    console.error("[weekly-ai] Failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
