/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#C8993A',
        'gold-light': '#E8B84D',
        'gold-muted': '#8A6A28',
        'deep-blue': '#0A0E1A',
        'midnight': '#0D1225',
        'surface': '#131929',
        'card': '#1A2338',
        'border-blue': '#252D45',
        'text-primary': '#F0E6CC',
        'text-secondary': '#9BA3BC',
        'text-muted': '#5C6582',
        'accent': '#2D6A6A',
        'accent-light': '#3D8A8A',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        arabic: ['Amiri', 'serif'],
      },
    },
  },
  plugins: [],
}
