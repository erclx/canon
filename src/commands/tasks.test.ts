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

describe('canon tasks validate --live', () => {
  let root: string

  /** An empty PATH reaches neither `gh` nor `git`, which is the offline run. */
  async function runValidate(args: string[]) {
    const result = await execa(
      process.execPath,
      [CLI, 'tasks', 'validate', '--json', '--root', root, ...args],
      {
        cwd: root,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: { PATH: join(root, 'no-such-bin'), HOME: root },
        extendEnv: false,
      },
    )

    return {
      exitCode: result.exitCode,
      stderr: result.stderr,
      record: JSON.parse(result.stdout) as Record<string, unknown>,
    }
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tasks-validate-'))
    mkdirSync(join(root, '.canon', 'tasks'), { recursive: true })
    writeFileSync(join(root, '.canon', 'tasks', 'priority.md'), '## Run now\n')
  })

  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('should carry an unread source on the record and warn, exiting 0', async () => {
    const { exitCode, record, stderr } = await runValidate(['--live'])

    expect(exitCode).toBe(0)
    expect(record.live).toEqual({ sessions: 'unread', pulls: 'unread' })
    expect(stderr).toContain('could not be read')
  })

  it('should read neither source and warn about neither without the flag', async () => {
    const { exitCode, record, stderr } = await runValidate([])

    expect(exitCode).toBe(0)
    expect(record.live).toEqual({ sessions: 'not-asked', pulls: 'not-asked' })
    expect(stderr).not.toContain('could not be read')
  })
})

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

  it('should read the checked-out branch when --branch is absent', async () => {
    await execa('git', ['init', '-b', 'feat/a-b'], { cwd: root })

    const record = await runCloses(root, [])

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
