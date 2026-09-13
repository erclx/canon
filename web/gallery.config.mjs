import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// Never read by web:build. srcDir keeps this config's page router off
// src/pages entirely, which is what excludes the gallery from the published
// build structurally rather than by a filename convention.
export default defineConfig({
  srcDir: './gallery-src',
  outDir: './gallery-dist',
  publicDir: './gallery-src/public',
  build: {
    assets: 'assets',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
