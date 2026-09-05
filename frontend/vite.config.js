import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Mirrors nginx.conf's /api/ location: strips the /api prefix before
      // forwarding, so the frontend's relative fetch('/api/...') calls work
      // identically whether running via `npm run dev` (proxied here) or the
      // full docker-compose stack (proxied by nginx).
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
