import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { qraft } from "../../src/vite";
import { exampleFixturePlugin } from "./example-fixture-plugin";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), exampleFixturePlugin(), qraft({ file: "QA.local.md" })],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
