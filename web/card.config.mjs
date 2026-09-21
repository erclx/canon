import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import path from 'path'

const portOffset = Number(process.env.WORKTREE_PORT_OFFSET) || 0

// Never read by `bun run build`. srcDir keeps this config's page router off
// src/pages entirely, which is what excludes the social card from the published
// build structurally rather than by a filename convention. A pageExtensions
// regex over a filename was the alternative, and it leaks the moment a route is
// renamed.
//
// The base port sits outside the band `astro.config.mjs` serves from, so a card
// server and a dev server of one worktree never contend, and two worktrees
// separate here the way they separate there.
//
// This copy departs from `tooling/astro/configs/card.config.mjs` in one line:
// the dev toolbar is off, since this server exists to be captured and the
// toolbar paints over the viewport the capture cuts the card from.
export default defineConfig({
  devToolbar: { enabled: false },
  srcDir: './card-src',
  outDir: './card-dist',
  publicDir: './public',
  integrations: [react()],
  server: {
    port: 4421 + portOffset,
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve('./src'),
      },
    },
    server: {
      strictPort: true,
    },
    preview: {
      strictPort: true,
    },
  },
})
