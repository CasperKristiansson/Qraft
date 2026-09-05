import { spawnSync } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...args], {
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
