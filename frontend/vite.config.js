import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxies /api -> Flask backend so we don't have to worry about CORS in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
})
