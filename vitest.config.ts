import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'web/src/**/*.test.ts', '*.test.ts'],
    // The end-to-end suites read real-time pacing, so they run only through
    // `vitest.e2e.config.ts`, whose timed project films them alone. Collected
    // here they would join this parallel pool on every full-suite run.
    exclude: [...configDefaults.exclude, '**/*.e2e.test.ts'],
    globalSetup: ['./vitest.global-setup.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // One suite's spawn tests need headroom the machine lock cannot provide.
    // The lock stops two suites running at once and cannot see ambient load,
    // and vitest's default fills a 32-core box on its own once each worker
    // spawns a child. CI runs one suite per runner, so it keeps the default.
    // CI is read as the gate reads it, so the cap and the lock agree.
    maxWorkers: process.env.CI === 'true' ? undefined : '50%',
  },
})
