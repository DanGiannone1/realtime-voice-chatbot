/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: {
            primary: '#2D1810',
            secondary: '#3D2415',
            panel: '#4A2C1A',
          },
          accent: {
            primary: '#E88D3E',
            secondary: '#F4A261',
            bright: '#FFB347',
          },
          text: {
            primary: '#FFF8F0',
            secondary: '#E8D5C4',
            muted: '#B8997A',
          },
          border: '#5D4037',
          coral: '#FF7F6B',
          rose: '#E76F51',
          golden: '#FFD700',
        },
      },
    },
  },
  plugins: [],
}