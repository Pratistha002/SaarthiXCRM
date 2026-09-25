/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: '#0f172a',
        brand: '#1d74e8',
      },
    },
  },
  plugins: [],
};
