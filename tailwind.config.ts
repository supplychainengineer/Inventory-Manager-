import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    // Cool & calm: gentle rounded corners instead of hard edges.
    borderRadius: {
      none: "0",
      sm: "6px",
      DEFAULT: "8px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      full: "9999px",
    },
    extend: {
      colors: {
        // Calm deep-teal accent on cool, soft neutrals.
        accent: {
          DEFAULT: "#14857a",
          hover: "#0f6f66",
          soft: "#dcefec",
        },
        paper: "#eef2f1",
        surface: "#ffffff",
        ink: "#253138",
        muted: "#6d7c81",
        line: "#dbe3e2",
        hairline: "#dbe3e2",
        // Semantic status colors (separate from the accent).
        ok: { DEFAULT: "#2f9e6b", soft: "#e4f3ec" },
        warn: { DEFAULT: "#bd7d2a", soft: "#f7edda" },
        alert: { DEFAULT: "#d9534f", soft: "#f8e6e4" },
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Soft, calm elevation.
        card: "0 1px 2px rgba(37,49,56,0.05), 0 4px 12px rgba(37,49,56,0.05)",
        modal: "0 12px 32px rgba(37,49,56,0.16)",
      },
      borderWidth: {
        DEFAULT: "1px",
        2: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
