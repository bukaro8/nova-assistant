/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");

fs.rmSync("dist/weekly-runner", { recursive: true, force: true });
