/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // White + navy theme
        navy: {
          DEFAULT: "#14274e",
          dark: "#0f1d3a",
          accent: "#2b4a8b",
        },
        ink: "#1a2338",
        muted: "#5b6577",
        panel: "#f5f7fa",
        line: "#e2e8f0",
        ok: "#1f7a4d",
        alert: "#c0392b",
        warn: "#c08a2e",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
