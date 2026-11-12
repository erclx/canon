import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLI, RUN_TIMEOUT_MS } from '@/commands/pr/fixture'

describe('canon pr close', () => {
  const REASON =
    'Closing unmerged. Base should stay stack-neutral, so each project adds rows for its own stack.'

  interface CloseRun {
    readonly record: {
      readonly reason?: string
      readonly branch?: string
      readonly commentUrl?: string
    }
    readonly exit: number
    readonly calls: string[]
  }

  let root: string
  let logFile: string

  async function runClose(
    args: string[],
    fake: { readonly head?: string } = {},
  ): Promise<CloseRun> {
    const bin = join(root, 'bin')
    mkdirSync(bin, { recursive: true })
    writeFileSync(
      join(bin, 'gh'),
      readFileSync(new URL('../fixtures/gh-close.sh', import.meta.url), 'utf8'),
      { mode: 0o755 },
    )
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'close', '7', '--json', '--root', root, ...args],
      {
        cwd: root,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          FAKE_LOG: logFile,
          FAKE_HEAD: fake.head ?? 'feat/x',
        },
      },
    )
    const calls = existsSync(logFile)
      ? readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
      : []
    return {
      record: JSON.parse(result.stdout),
      exit: result.exitCode ?? -1,
      calls,
    }
  }

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'canon-pr-close-'))
    logFile = join(root, 'gh.log')
    execaSync('git', ['-C', root, 'init', '-q', '--initial-branch=feat/x'])
    writeFileSync(join(root, 'reason.md'), `${REASON}\n`)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('should post the reason, close, and delete the branch', async () => {
    const run = await runClose(['--reason-file', 'reason.md'])

    expect(run.record).toMatchObject({ reason: 'closed', branch: 'deleted' })
    expect(run.exit).toBe(0)
    const writes = run.calls.filter((call) => call.includes(' -X '))
    expect(writes.map((call) => /-X (\w+)/.exec(call)?.[1])).toEqual([
      'POST',
      'PATCH',
      'DELETE',
    ])
  })

  it('should refuse without a reason file and call nothing', async () => {
    const run = await runClose([])

    expect(run.record.reason).toBe('no-reason')
    expect(run.exit).toBe(1)
    expect(run.calls).toEqual([])
  })

  it('should refuse a reason file that does not exist', async () => {
    const run = await runClose(['--reason-file', 'missing.md'])

    expect(run.record.reason).toBe('reason-unreadable')
    expect(run.exit).toBe(1)
    expect(run.calls).toEqual([])
  })

  it('should refuse a pull request whose head is not the current branch', async () => {
    const run = await runClose(['--reason-file', 'reason.md'], {
      head: 'feat/other',
    })

    expect(run.record.reason).toBe('head-mismatch')
    expect(run.calls.some((call) => call.includes(' -X '))).toBe(false)
  })

  it('should close another branch named through --head', async () => {
    const run = await runClose(
      ['--reason-file', 'reason.md', '--head', 'feat/other'],
      { head: 'feat/other' },
    )

    expect(run.record.reason).toBe('closed')
  })

  it('should keep the branch under --keep-branch', async () => {
    const run = await runClose(['--reason-file', 'reason.md', '--keep-branch'])

    expect(run.record.branch).toBe('kept')
    expect(run.calls.some((call) => call.includes('-X DELETE'))).toBe(false)
  })

  it('should refuse an overloaded reason before any call', async () => {
    writeFileSync(join(root, 'reason.md'), 'One.\n\nTwo.\n\nThree.\n')

    const run = await runClose(['--reason-file', 'reason.md'])

    expect(run.record.reason).toBe('reason-unpublishable')
    expect(run.calls).toEqual([])
  })
})
