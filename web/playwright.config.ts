import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI
const baseURL = `http://localhost:${4321 + (Number(process.env.WORKTREE_PORT_OFFSET) || 0)}`
// No web/package.json (plan Q1), so bun run walks up to the repository root
// to run web:build and web:preview, which pulls Playwright's own cwd-relative
// output defaults up with it. Anchor both to this file's own directory.
const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  testDir: 'e2e',
  outputDir: path.join(here, 'test-results'),
  forbidOnly: isCI,
  // Absorbs shared-runner noise on a fresh scaffold with no flake history, at the cost of hiding a real defect until someone reads the run summary.
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? 'list'
    : [['html', { outputFolder: path.join(here, 'playwright-report') }]],
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
    command: 'bun run web:build && bun run web:preview',
    url: baseURL,
    reuseExistingServer: false,
    env: { ASTRO_PREVIEW_BACKGROUND: '0' },
  },
})
