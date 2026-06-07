import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api to the FastAPI backend so the frontend calls are same-origin
// (no CORS dance in the browser during dev).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // On Windows the launcher uses an 8.3 short path (the real path has
    // spaces, which breaks process spawning). That short path falls outside
    // Vite's default fs allow-list, so relax it for local dev.
    fs: { strict: false },
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
