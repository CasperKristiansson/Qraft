import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectProject, setupInstructions } from "./setup/inspect";

const args = process.argv.slice(2);
if (args.length !== 1 || !["doctor", "setup", "guide"].includes(args[0] ?? "")) {
  console.log(
    "Usage: qraft doctor | qraft setup | qraft guide\nAll commands are read-only. Run doctor or setup from your app directory; guide prints the portable checklist skill.",
  );
  process.exitCode = args.length === 1 && ["--help", "-h"].includes(args[0] ?? "") ? 0 : 1;
} else {
  try {
    if (args[0] === "guide") {
      process.stdout.write(
        await readFile(resolve(import.meta.dirname, "../skills/qraft-review/SKILL.md"), "utf8"),
      );
    } else {
      const report = await inspectProject(process.cwd());
      console.log(`Qraft ${args[0]} · ${report.framework} · ${report.manager}\n${report.root}\n`);

      for (const check of report.checks) {
        console.log(`${check.level === "ok" ? "OK" : "CHECK"} ${check.message}`);
      }

      if (args[0] === "setup") console.log(`\n${setupInstructions(report)}`);
      console.log("\nCreate a human review checklist: qraft guide");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not run this Qraft command.");
    process.exitCode = 1;
  }
}
