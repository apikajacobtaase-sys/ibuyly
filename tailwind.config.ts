// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ibuy: {
          orange: "#F7931E",       // Primary brand
          "orange-hover": "#E78012", // Primary hover
          bg: "#F5F6F8",           // Main background
          card: "#FFFFFF",         // Card background
          text: "#202124",         // Main text
          "text-secondary": "#6B7280", // Secondary text
          border: "#E5E7EB",       // Border
          success: "#16803D",      // Success
          error: "#DC2626",        // Error
          intelligence: "#5B4BDB", // Intelligence accent
        },
      },
    },
    // ... rest of your config
  },
  plugins: [],
};
export default config;