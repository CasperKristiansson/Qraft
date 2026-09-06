import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function verifyPackagedGuide(consumer) {
  const packaged = join(consumer, "node_modules/@qraft/qa");
  const metadata = JSON.parse(await readFile(join(packaged, "package.json"), "utf8"));
  assert.equal(metadata.license, "MIT");
  assert.equal(
    await readFile(join(packaged, "LICENSE"), "utf8"),
    await readFile("LICENSE", "utf8"),
  );
  const skill = join(packaged, "skills/qraft-review");
  const expected = await readFile(join(skill, "SKILL.md"), "utf8");
  const root = await mkdtemp(join(tmpdir(), "qraft-guide-project-"));
  const originals = {
    "AGENTS.md": "# Existing instructions\r\nKeep these.\r\n",
    "CLAUDE.md": "# Team rules\nKeep these too.\n",
    "QRAFT.md": "# Preferences\nUse local test data.\n",
    "review.md": "\uFEFF# Review\r\n\r\n- [x] Reviewed\r\n  - Note: Preserve this feedback",
  };

  for (const [name, bytes] of Object.entries(originals)) {
    await writeFile(join(root, name), bytes);
  }

  // There is deliberately no package.json in this working directory. The guide
  // must resolve from the installed executable and must not configure the host.
  const result = spawnSync(process.execPath, [join(packaged, "dist/cli.js"), "guide"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.deepEqual((await readdir(root)).sort(), Object.keys(originals).sort());

  for (const [name, bytes] of Object.entries(originals)) {
    assert.equal(await readFile(join(root, name), "utf8"), bytes);
  }

  // Exercise the documented manual-copy layouts in an isolated project. This
  // establishes installation integrity, not activation inside an agent session.
  const destinations = [".agents/skills/qraft-review", ".claude/skills/qraft-review"];
  for (const destination of destinations) {
    await mkdir(join(root, destination), { recursive: true });
    await cp(skill, join(root, destination), { recursive: true });
    assert.equal(await readFile(join(root, destination, "SKILL.md"), "utf8"), expected);
  }

  return { root, exactBundledOutput: true, hostFilesPreserved: true, destinations };
}
