import { configDefaults, defineConfig } from 'vitest/config'
import base from './vitest.config'

// The suites `bun run test:e2e` runs. Each project sets its own `include` and
// takes nothing from the base by `extends`, since the merge concatenates arrays
// and would let every unit test back in.

// Suites whose assertion reads real-time pacing, which a busy machine skews past
// their limits: the drag's pixel bounds, the glide's landing, and the step file's
// stall limit. They run alone, after the parallel files.
const TIMED = [
  'src/take/film-drag.e2e.test.ts',
  'src/take/film-glide.e2e.test.ts',
  'src/take/film-step.e2e.test.ts',
]

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
    // Vitest's default would list every suite for a `package.json` change from
    // a path with no dot folder, and `FULL_SUITE_TRIGGERS` holds that list.
    forceRerunTriggers: [],
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
          // A project runs its own files in parallel, so the timed suites
          // would film beside each other without this.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
