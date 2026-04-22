import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

export default defineConfig({
  root: __dirname,
  build: {
    outDir: resolve(REPO_ROOT, "dist/widget/loader"),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/loader.ts"),
      name: "AISupportWidget",
      formats: ["iife"],
      fileName: () => "loader.js",
    },
    sourcemap: true,
    minify: "esbuild",
  },
});
