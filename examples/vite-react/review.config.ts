import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { qraft } from "../../src/vite";
import { seedFirstReview } from "./first-review";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  plugins: [
    react(),
    {
      name: "qraft-first-review",
      apply: "serve",
      async configureServer() {
        await seedFirstReview(root);
      },
    },
    qraft({ file: "review.local.md" }),
  ],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
