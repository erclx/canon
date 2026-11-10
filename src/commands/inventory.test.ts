import { join } from 'node:path'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const FRAME = join(
  REPO_ROOT,
  'src',
  'inventory',
  'fixtures',
  'frames',
  '01-hero',
  'arm-1.html',
)
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because a refusal reports
 * through `process.exitCode` and an in-process call would set it on the test
 * runner. Each case refuses before any browser launches, so none needs one.
 */
async function runInventory(args: string[]) {
  const result = await execa(
    process.execPath,
    [CLI, 'inventory', 'run', '--json', ...args],
    { cwd: REPO_ROOT, reject: false, timeout: RUN_TIMEOUT_MS },
  )
  return {
    exitCode: result.exitCode,
    record: JSON.parse(result.stdout) as { reason?: string },
  }
}

describe('canon inventory run --frames', () => {
  it('should refuse focus, whose query only a project config declares', async () => {
    const result = await runInventory(['focus', '--frames', FRAME])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { reason: 'frames-need-value-subject' },
    })
  })

  it('should refuse a frame path that names no file', async () => {
    const result = await runInventory([
      'color',
      '--frames',
      join(REPO_ROOT, 'no-such-frame.html'),
    ])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { reason: 'frames-missing' },
    })
  })
})
