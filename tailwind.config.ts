import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--color-canvas) / <alpha-value>)",
        surface: {
          DEFAULT: "hsl(var(--color-surface) / <alpha-value>)",
          elevated: "hsl(var(--color-surface-elevated) / <alpha-value>)",
          muted: "hsl(var(--color-surface-muted) / <alpha-value>)",
        },
        content: {
          DEFAULT: "hsl(var(--color-content) / <alpha-value>)",
          muted: "hsl(var(--color-content-muted) / <alpha-value>)",
          subtle: "hsl(var(--color-content-subtle) / <alpha-value>)",
          inverse: "hsl(var(--color-content-inverse) / <alpha-value>)",
        },
        border: {
          DEFAULT: "hsl(var(--color-border) / <alpha-value>)",
          strong: "hsl(var(--color-border-strong) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--color-primary) / <alpha-value>)",
          hover: "hsl(var(--color-primary-hover) / <alpha-value>)",
          foreground: "hsl(var(--color-primary-foreground) / <alpha-value>)",
          subtle: "hsl(var(--color-primary-subtle) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--color-accent) / <alpha-value>)",
          hover: "hsl(var(--color-accent-hover) / <alpha-value>)",
          foreground: "hsl(var(--color-accent-foreground) / <alpha-value>)",
          subtle: "hsl(var(--color-accent-subtle) / <alpha-value>)",
        },
        focus: "hsl(var(--color-focus) / <alpha-value>)",
        chord: "hsl(var(--color-chord) / <alpha-value>)",
        leaf: {
          50: "#f1f8f3",
          100: "#dcefe0",
          500: "#3f8f55",
          700: "#2d6b3e",
          900: "#183c24",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
