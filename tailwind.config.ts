import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07060B",
          900: "#0E0C16",
          800: "#171323",
          700: "#221C36",
          600: "#2E2748",
          500: "#3C3460",
        },
        bone: {
          50: "#FBF7EE",
          100: "#F2EADA",
          200: "#E4D7BC",
        },
        lemon: {
          DEFAULT: "#FFE21F",
          dark: "#E2C400",
        },
        magenta: {
          DEFAULT: "#FF3D8A",
          dark: "#D31E69",
        },
        cyan: {
          DEFAULT: "#3DEEFF",
          dark: "#19BCD0",
        },
        lime: {
          DEFAULT: "#B8FF3D",
          dark: "#8FD315",
        },
        coral: {
          DEFAULT: "#FF8A3D",
          dark: "#D9651D",
        },
        blue: {
          DEFAULT: "#3D7BFF",
          dark: "#1E5FE2",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        pop: "6px 6px 0 0 #000",
        "pop-lg": "10px 10px 0 0 #000",
        "pop-sm": "3px 3px 0 0 #000",
        "pop-inset": "inset 4px 4px 0 0 rgba(0,0,0,0.25)",
        glow: "0 0 30px rgba(255, 226, 31, 0.35)",
      },
      borderRadius: {
        chunk: "1.25rem",
      },
      keyframes: {
        "wobble-in": {
          "0%": { transform: "translateY(20px) rotate(-3deg)", opacity: "0" },
          "60%": { transform: "translateY(-6px) rotate(2deg)", opacity: "1" },
          "100%": { transform: "translateY(0) rotate(0)", opacity: "1" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-3px) rotate(-1deg)" },
          "75%": { transform: "translateX(3px) rotate(1deg)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
      },
      animation: {
        "wobble-in": "wobble-in 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "shake": "shake 0.4s ease-in-out",
        "float": "float 3.5s ease-in-out infinite",
        "spin-slow": "spin-slow 18s linear infinite",
        "marquee": "marquee 28s linear infinite",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.215, 0.61, 0.355, 1) infinite",
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
