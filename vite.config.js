import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // Where `npm run dev` forwards API and socket traffic. Defaults to the live
  // backend; set DEV_PROXY_TARGET=http://localhost:4000 in .env.local to use a
  // backend running on your machine.
  const target = env.DEV_PROXY_TARGET || 'https://api.naijacorper.com'

  return {
    plugins: [react()],
    server: {
      // The browser only talks to localhost, so the refresh cookie is treated
      // as first-party and is kept.
      proxy: {
        '/api/v1': {
          target,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
        // Socket.IO for real-time messaging (/messaging namespace). `ws: true`
        // lets the WebSocket upgrade through; the HTTP long-polling requests
        // Socket.IO starts with use the same path.
        '/socket.io': {
          target,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
