/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Sofascore-style near-black palette
        // bg = #0d0d0d, surface = #161616, elevated = #1e1e1e
        // All navy/* replaced — components reference these via inline hex now
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
