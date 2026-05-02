import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In production the dashboard is bundled into the agent's Cloud Run
// image and served at /dashboard/* by the api itself, sharing the same
// origin as /sessions and /health. Local dev keeps the bare-root path
// so existing `localhost:5174` muscle memory still works.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/dashboard/" : "/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/sessions": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  build: {
    outDir: "../../dist/dashboard",
    emptyOutDir: true,
  },
}));
