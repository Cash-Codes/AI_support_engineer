import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  // The iframe app is served under /widget/ by the api's static route.
  // Without this, built HTML references /assets/... at the domain root
  // and the browser 404s them.
  base: "/widget/",
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
