/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6f1", 100: "#d5eadd", 200: "#abd5bb", 500: "#1f7a4d", 600: "#17633e", 700: "#124f32", 800: "#0e3d27", 900: "#0a2e1d" },
        gov: { red: "#c8102e", gold: "#b8860b" },
      },
      fontFamily: {
        sans: ['"Noto Sans Bengali"', '"Kalpurush"', '"Nirmala UI"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
