import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // host: true exposes the dev server on your computer's LAN IP (not just
  // localhost), so you can open it from your phone on the same WiFi.
  server: {
    host: true,
  },
  plugins: [
    react(),
  ],
})
