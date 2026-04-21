/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  test: {
    environment: "jsdom",
    globals: true,
    env: { VITEST: "true" },
  },
});
