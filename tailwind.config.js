/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode using a CSS class
  theme: {
    extend: {
      colors: {
        'primary': '#750014',
        'secondary': '#080c42',
        'light-secondary': '#202682',
        'light-cream': '#f7f8ef',
        'off-white': '#fefdf7',
        'dirty-white': '#f4eabf',
        'dark-bg': '#0f172a',
        'accent-burgundy': '#4a0009',
      },
    },
  },
  plugins: [],
}