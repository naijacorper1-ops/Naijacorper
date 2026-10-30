import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api/v1 calls to the live backend. The browser then only talks to
    // localhost, so the refresh cookie is treated as first-party and is kept.
    proxy: {
      '/api/v1': {
        target: 'https://api.naijacorper.com',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})
