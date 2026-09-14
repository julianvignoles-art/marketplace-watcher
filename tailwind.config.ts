import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#EAE2CC",
          deep: "#DCD0AC",
          card: "#F1EBDA",
        },
        ink: {
          950: "#201C15",
          800: "#3A3426",
          600: "#5B5340",
          400: "#87795C",
        },
        pin: {
          DEFAULT: "#AF3A2A",
          soft: "#C9573F",
        },
        brass: {
          DEFAULT: "#93701F",
          soft: "#B08B33",
        },
        rule: "#BBAD84",
      },
      fontFamily: {
        display: ["var(--font-display)", "Courier New", "monospace"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "0.375rem",
      },
      boxShadow: {
        pin: "0 1px 0 rgba(32,28,21,0.08), 0 6px 14px -6px rgba(32,28,21,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
