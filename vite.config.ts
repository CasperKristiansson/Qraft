import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const external = [
  ...builtinModules,
  ...builtinModules.map((moduleName) => `node:${moduleName}`),
  "react",
  "react-dom",
  "react/jsx-runtime",
  "vite",
  /^@radix-ui\//,
  "lucide-react",
  "react-grab",
  /^react-grab\//,
  "write-file-atomic",
  "zod",
];

export default defineConfig({
  build: {
    lib: {
      entry: {
        cli: resolve(import.meta.dirname, "src/cli.ts"),
        index: resolve(import.meta.dirname, "src/index.ts"),
        next: resolve(import.meta.dirname, "src/next.ts"),
        vite: resolve(import.meta.dirname, "src/vite.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external,
      output: {
        banner: (chunk) =>
          chunk.name === "index"
            ? '"use client";'
            : chunk.name === "cli"
              ? "#!/usr/bin/env node"
              : "",
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
