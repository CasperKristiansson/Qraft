import { constants } from "node:fs";
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function seedFirstReview(root: string): Promise<void> {
  try {
    await copyFile(
      resolve(root, "first-review.md"),
      resolve(root, "review.local.md"),
      constants.COPYFILE_EXCL,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
