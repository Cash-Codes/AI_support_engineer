import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  server: {
    port: 5173,
    proxy: {
      "/chat": "http://localhost:8080",
      "/session": "http://localhost:8080",
      "/health": "http://localhost:8080",
      "/api": "http://localhost:8080",
    },
  },
  build: {
    outDir: "../../../dist/widget/app",
    emptyOutDir: true,
  },
});
