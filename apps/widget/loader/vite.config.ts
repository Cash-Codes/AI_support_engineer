import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../../dist/widget/loader",
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
