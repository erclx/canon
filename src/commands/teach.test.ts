import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const FIXTURE_ROOT = join(REPO_ROOT, 'examples', 'teach')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because the printed line
 * depends on the process working directory and the list verb reports through
 * `process.exitCode`, both of which an in-process call would share with the
 * test runner.
 */
async function runTeach(
  args: string[],
  cwd: string = REPO_ROOT,
): Promise<{
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}> {
  const result = await execa(process.execPath, [CLI, 'teach', ...args], {
    cwd,
    reject: false,
    timeout: RUN_TIMEOUT_MS,
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

describe('canon teach', () => {
  it('should name canon serve in the parent help', async () => {
    const result = await runTeach(['--help'])

    expect(result.stdout).toContain(
      'canon serve .canon/teach --entry <nn>-<topic>/index.html',
    )
  })

  it('should print the serve line relative to the cwd for one workspace', async () => {
    const result = await runTeach([
      'list',
      '00-fixture',
      '--root',
      'examples/teach',
    ])

    expect(result.stderr).toContain(
      'canon serve examples/teach --entry 00-fixture/index.html',
    )
  })

  it('should print the absolute teach folder when it sits outside the cwd', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'teach-serve-'))

    const result = await runTeach(
      ['list', '00-fixture', '--root', FIXTURE_ROOT],
      outside,
    )

    expect(result.stderr).toContain(
      `canon serve ${FIXTURE_ROOT} --entry 00-fixture/index.html`,
    )
  })

  it('should leave the JSON record without a serve field', async () => {
    const result = await runTeach([
      'list',
      '--root',
      'examples/teach',
      '--json',
    ])

    const record = JSON.parse(result.stdout) as Record<string, unknown>
    expect(Object.keys(record).sort()).toEqual([
      'next',
      'ok',
      'root',
      'workspaces',
    ])
  })
})
