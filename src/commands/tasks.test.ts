import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because a refusal reports
 * through `process.exitCode` and an in-process call would set it on the test
 * runner.
 */
async function runCloses(
  root: string,
  args: string[],
): Promise<Record<string, unknown>> {
  const result = await execa(
    process.execPath,
    [CLI, 'tasks', 'closes', '--json', '--root', root, ...args],
    { cwd: root, reject: false, timeout: RUN_TIMEOUT_MS },
  )

  return JSON.parse(result.stdout || result.stderr) as Record<string, unknown>
}

describe('canon tasks closes with no task or plan named', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tasks-closes-'))
    mkdirSync(join(root, '.canon', 'tasks'), { recursive: true })
    writeFileSync(
      join(root, '.canon', 'tasks', 'v1-a.md'),
      [
        '# Task',
        '',
        'Plan: [feature-a-b](../plans/feature-a-b.md)',
        'Issue: #12',
        '',
        '## Outcomes',
        '',
        '- [x] shipped',
        '',
      ].join('\n'),
    )
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should read the task whose plan derives the branch', async () => {
    const record = await runCloses(root, ['--branch', 'feat/a-b'])

    expect(record).toMatchObject({ ok: true, task: 'v1-a', closing: true })
  })

  it('should report no-match on a branch nothing owns', async () => {
    const record = await runCloses(root, ['--branch', 'docs/other'])

    expect(record).toMatchObject({ ok: false, reason: 'no-match' })
  })

  it('should still refuse a task and a plan both named', async () => {
    const record = await runCloses(root, ['v1-a', '--plan', 'a-b'])

    expect(record).toMatchObject({ ok: false, reason: 'bad-input' })
  })
})
