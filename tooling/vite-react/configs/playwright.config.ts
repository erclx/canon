import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const baseURL = `http://localhost:${5173 + (Number(process.env.WORKTREE_PORT_OFFSET) || 0)}`

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  // Absorbs shared-runner noise on a fresh scaffold with no flake history, at the cost of hiding a real defect until someone reads the run summary.
  retries: isCI ? 2 : 0,
  // No override here: Playwright's own CPU-derived default suits every CI runner
  reporter: isCI ? 'list' : 'html',
  use: {
    trace: 'on-first-retry',
    baseURL,
    // Nothing to wait out unless a test asserts motion. Opt back in per test with page.emulateMedia({ reducedMotion: 'no-preference' }).
    // It is a context option rather than a top-level one, so written beside
    // `baseURL` it type-checks nowhere and reaches no page.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: false,
  },
})
