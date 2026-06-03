import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Dev-only mock layer lives at the repo root, outside the app's src.
      '@mock': fileURLToPath(new URL('../mock', import.meta.url)),
      // Shared bridge types, also defined/imported by the backend. Types only,
      // so they erase at build time. `@types` = raw Jira wire shapes
      // (`src/types.ts`); `@result` = the resolver result/error envelope
      // (`src/result.ts`).
      '@types': fileURLToPath(new URL('../src/types.ts', import.meta.url)),
      '@result': fileURLToPath(new URL('../src/result.ts', import.meta.url)),
    },
  },
  server: {
    // Allow the dev server to read the mock layer one level above frontend/.
    fs: { allow: [repoRoot] },
  },
  // Forge Custom UI serves the built assets from a sandboxed iframe on an
  // Atlassian-controlled origin, so all asset URLs must be relative.
  base: './',
  build: {
    outDir: 'dist',
  },
})
