import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    // Flat / architectural: zero border-radius everywhere.
    borderRadius: {
      none: "0",
      DEFAULT: "0",
      sm: "0",
      md: "0",
      lg: "0",
      full: "0",
    },
    extend: {
      colors: {
        // Near-mono red accent on white / off-white.
        accent: {
          DEFAULT: "#ec3013",
          hover: "#c9270e",
          soft: "#fbe4e0",
        },
        paper: "#f3f2f2",
        ink: "#1a1a1a",
        muted: "#6b6b6b",
        line: "#1a1a1a",
      },
      fontFamily: {
        sans: ["Archivo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Only a subtle elevation for cards/modals; no dramatic drop shadows.
        card: "0 1px 2px rgba(26,26,26,0.06), 0 1px 1px rgba(26,26,26,0.04)",
        modal: "0 4px 16px rgba(26,26,26,0.12)",
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
