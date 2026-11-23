import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    cacheDir: 'node_modules/.vite-vitest',
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['{{appRoot}}/test/setup.ts'],
      passWithNoTests: true,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/.{idea,git,cache,output,temp}/**',
      ],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: ['node_modules/', '{{appRoot}}/test/setup.ts', 'e2e/'],
      },
    },
  }),
)
