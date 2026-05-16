import "dotenv/config";

type PrismaRuntime = {
  $disconnect: () => Promise<void>;
};

let prisma: PrismaRuntime | null = null;

async function loadRuntime() {
  const [db, reports] = await Promise.all([
    import("../db/prisma"),
    import("./weekly-ai-report"),
  ]);

  prisma = db.prisma;

  return reports;
}

async function runWeeklyReportsOnce() {
  const startedAt = Date.now();

  const { generateWeeklyAiReportsForDueUsers } = await loadRuntime();

  if (process.env.WEEKLY_AI_RUNNER_CHECK_ONLY === "1") {
    console.log("[weekly-ai] Runner artifact loaded.");
    return;
  }

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
    await prisma?.$disconnect();
  });
