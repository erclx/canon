import type { TestProject } from 'vitest/node'
import { HELD_LOCK_VARIABLE, locksHandSuite } from '@/gate/hand-suite'
import { STAGES } from '@/gate/stages'
import { acquireSuiteLock, machineLockPath } from '@/gate/suite-lock'

/**
 * Queues a full suite run by hand behind the machine lock the gate's Tests stage
 * holds. It runs in the main process before any worker, which keeps the lock on
 * the real state folder, since `vitest.setup.ts` redirects `CANON_STATE_DIR` per worker.
 */
export default async function setup(project: TestProject): Promise<() => void> {
  const queues = locksHandSuite({
    args: process.argv.slice(2),
    ci: process.env.CI === 'true',
    watch: project.config.watch,
    heldLock: process.env[HELD_LOCK_VARIABLE],
  })
  if (!queues) return () => {}

  const stage = STAGES.find((entry) => entry.id === 'tests')
  if (stage?.lock === undefined) {
    throw new Error('The gate has no locked Tests stage to queue behind.')
  }

  const held = await acquireSuiteLock({
    path: machineLockPath(stage.lock),
    root: project.config.root,
    onWait: (holder) => {
      process.stderr.write(
        `Waiting for the ${stage.label} suite another run holds, at ${holder.root}\n`,
      )
    },
  })
  return held.release
}
