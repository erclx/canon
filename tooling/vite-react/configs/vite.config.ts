import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

const portOffset = Number(process.env.WORKTREE_PORT_OFFSET) || 0

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  base: process.env.VITE_BASE_URL ?? '/',
  server: {
    port: 5173 + portOffset,
    strictPort: true,
  },
  preview: {
    port: 4173 + portOffset,
    strictPort: true,
  },
})
