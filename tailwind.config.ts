import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "cat-orange": "#ff8c00",
        "cat-dark": "#0a0a1a",
        "neon-green": "#00ff41",
      },
      animation: {
        "cat-pounce": "catPounce 0.6s ease-in forwards",
        "float": "float 3s ease-in-out infinite",
        "tail-wag": "tailWag 0.8s ease-in-out infinite",
        "blink": "blink 3s step-end infinite",
      },
      keyframes: {
        catPounce: {
          "0%": { transform: "translateX(0) rotate(0deg) scale(1)" },
          "25%": { transform: "translateX(-10px) rotate(-10deg) scale(0.95)" },
          "60%": { transform: "translateX(60px) rotate(15deg) scale(1.15) translateY(-15px)" },
          "100%": { transform: "translateX(90px) rotate(0deg) scale(1) translateY(0px)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        tailWag: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "50%": { transform: "rotate(15deg)" },
        },
        blink: {
          "0%, 95%, 100%": { transform: "scaleY(1)" },
          "97%": { transform: "scaleY(0.1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
