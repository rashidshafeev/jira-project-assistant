import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Forge Custom UI serves the built assets from a sandboxed iframe on an
  // Atlassian-controlled origin, so all asset URLs must be relative.
  base: './',
  build: {
    outDir: 'dist',
  },
})
