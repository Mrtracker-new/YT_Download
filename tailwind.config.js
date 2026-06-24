/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sketch: {
          bg: '#fdfbf7',
          darkBg: '#1e1e24',
          text: '#2d2d2d',
          darkText: '#fdfbf7',
          accent: '#ff4d4d',
          blue: '#2d5da1',
          muted: '#e5e0d8',
          darkMuted: '#3f3f46',
        }
      },
      fontFamily: {
        sans: ['Patrick Hand', 'sans-serif'],
        kalam: ['Kalam', 'cursive'],
      },
    },
  },
  plugins: [],
}
