import { configDefaults, defineConfig } from 'vitest/config'
import base from './vitest.config'

// The suites `bun run test:e2e` runs. Each project below sets its own `include`
// and takes nothing from the base by `extends`, since the merge concatenates
// arrays and would let every unit test back in. Vitest ANDs a path argument
// with `include`, so `bun run test:e2e src/take` runs only the end-to-end
// suites under that path.

// Suites whose assertion reads real-time screencast pacing, which a busy
// machine skews past its limit. They run alone, after the parallel files.
const TIMED = ['src/take/film-drag.e2e.test.ts']

const shared = {
  resolve: base.resolve,
  test: { setupFiles: base.test?.setupFiles },
}

// The lock in `globalSetup` and the worker cap stay on the root, since a
// project that carried the lock would queue behind its own sibling.
export default defineConfig({
  resolve: base.resolve,
  test: {
    globalSetup: base.test?.globalSetup,
    maxWorkers: base.test?.maxWorkers,
    // Projects with the same `groupOrder` run together and groups run from the
    // lowest up, so the timed group starts once the parallel one has finished.
    projects: [
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'parallel',
          include: ['src/**/*.e2e.test.ts'],
          exclude: [...configDefaults.exclude, ...TIMED],
          sequence: { groupOrder: 0 },
        },
      },
      {
        ...shared,
        test: {
          ...shared.test,
          name: 'timed',
          include: TIMED,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
