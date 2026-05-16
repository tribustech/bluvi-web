import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          1: "#F0F3FD",
          2: "#E0E7FF",
          4: "#A5B4FC",
          5: "#6366F1",
          7: "#4338CA",
        },
        green: {
          2: "#E5F6F3",
          3: "#6BBAA3",
          5: "#4CB944",
          7: "#15803D",
        },
        red: {
          1: "#FEE4E2",
          5: "#F43F5E",
          6: "#E11D48",
        },
        gray: {
          1: "#F2F2F2",
          2: "#E5E5E5",
          5: "#737373",
          6: "#A3A3A3",
          7: "#404040",
        },
        cyan: { 6: "#0891B2" },
        yellow: {
          1: "#FEF9C3",
          5: "#EAB308",
          6: "#CA8A04",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        card: "10px",
        button: "10px",
        sheet: "16px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        nunito: ["var(--font-nunito)", "sans-serif"],
      },
      boxShadow: {
        card: "0 16px 30px rgba(67, 56, 202, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
