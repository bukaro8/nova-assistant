/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join("dist", "weekly-runner");
const dbDir = path.join(root, "server", "db");
const runnerDir = path.join(root, "server", "reports");
const dbSource = path.join(dbDir, "prisma.weekly-runner.js");
const dbTarget = path.join(dbDir, "prisma.js");
const runnerSource = path.join(runnerDir, "weekly-ai-runner.js");
const runnerTarget = path.join(runnerDir, "weekly-ai-runner.cjs");

for (const requiredPath of [dbSource, runnerSource]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`${requiredPath} is missing`);
    process.exit(1);
  }
}

fs.copyFileSync(dbSource, dbTarget);
fs.copyFileSync(runnerSource, runnerTarget);
fs.rmSync(path.join(root, "generated"), { recursive: true, force: true });
fs.writeFileSync(
  path.join(root, "package.json"),
  `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
);
