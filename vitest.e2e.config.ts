import { defineConfig } from 'vitest/config'
import base from './vitest.config'

// The suites `bun run test:e2e` runs. `include` replaces the base list rather
// than merging with it, since `mergeConfig` concatenates arrays and would let
// every unit test back in. Vitest ANDs a path argument with `include`, so
// `bun run test:e2e src/take` runs only the end-to-end suites under that path.
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['src/**/*.e2e.test.ts'] },
})
