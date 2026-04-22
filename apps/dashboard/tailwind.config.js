import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{ts,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        fg: {
          0: "var(--fg-0)",
          1: "var(--fg-1)",
          2: "var(--fg-2)",
          3: "var(--fg-3)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          weak: "var(--brand-weak)",
          hover: "var(--brand-hover)",
        },
        success: {
          DEFAULT: "var(--success)",
          weak: "var(--success-weak)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          weak: "var(--warning-weak)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          weak: "var(--danger-weak)",
        },
        info: {
          DEFAULT: "var(--info)",
          weak: "var(--info-weak)",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
      },
    },
  },
  plugins: [],
};
