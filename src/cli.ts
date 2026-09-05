import { inspectProject, setupInstructions } from "./setup/inspect";

const args = process.argv.slice(2);
if (args.length !== 1 || !["doctor", "setup"].includes(args[0] ?? "")) {
  console.log(
    "Usage: qraft doctor | qraft setup\nRun from your app directory. Both commands are read-only; setup prints integration instructions.",
  );
  process.exitCode = args.length === 1 && ["--help", "-h"].includes(args[0] ?? "") ? 0 : 1;
} else {
  try {
    const report = await inspectProject(process.cwd());
    console.log(`Qraft ${args[0]} · ${report.framework} · ${report.manager}\n${report.root}\n`);
    for (const check of report.checks)
      console.log(`${check.level === "ok" ? "OK" : "CHECK"} ${check.message}`);
    if (args[0] === "setup") console.log(`\n${setupInstructions(report)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not inspect this app.");
    process.exitCode = 1;
  }
}
