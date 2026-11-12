import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa, execaSync } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CLI, PROXY_GH, RUN_TIMEOUT_MS } from '@/commands/pr/fixture'

describe('canon pr drive-copy', () => {
  let tempDir: string
  let repoRoot: string

  function git(...args: string[]): string {
    return execaSync('git', ['-C', repoRoot, ...args], {
      env: {
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    }).stdout
  }

  function writeRepoFile(path: string, text: string): void {
    mkdirSync(dirname(join(repoRoot, path)), { recursive: true })
    writeFileSync(join(repoRoot, path), text)
  }

  function writePull(headRef: string): void {
    writeFileSync(
      join(tempDir, 'pull.json'),
      JSON.stringify({
        number: 7,
        head: { ref: headRef, sha: 'a'.repeat(40) },
      }),
    )
  }

  async function runDriveCopy(args: string[]): Promise<{
    readonly record: Record<string, unknown>
    readonly exit: number
  }> {
    const result = await execa(
      process.execPath,
      [CLI, 'pr', 'drive-copy', ...args, '--json', '--root', repoRoot],
      {
        cwd: repoRoot,
        reject: false,
        timeout: RUN_TIMEOUT_MS,
        env: {
          PATH: `${join(tempDir, 'bin')}:${process.env.PATH}`,
          FAKE_DIR: tempDir,
        },
      },
    )
    return { record: JSON.parse(result.stdout), exit: result.exitCode ?? -1 }
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'canon-pr-drive-copy-'))
    repoRoot = join(tempDir, 'repo')
    mkdirSync(repoRoot)
    mkdirSync(join(tempDir, 'bin'))
    writeFileSync(join(tempDir, 'bin', 'gh'), PROXY_GH, { mode: 0o755 })
    git('init', '-q', '-b', 'feat/x')
    writeRepoFile('.gitignore', '.canon/\n')
    writeRepoFile('board/frames.json', '{"x":0}')
    git('add', '.')
    git('commit', '-q', '-m', 'init')
    writePull('feat/x')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should report no-config and copy nothing when the project declares no preview', async () => {
    const outcome = await runDriveCopy(['7'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-config' }),
      exit: 0,
    })
    expect(existsSync(join(repoRoot, '.canon/tmp/pr/review-ui/x'))).toBe(false)
  })

  it('should copy the declared folders under the branch slug and name the variable', async () => {
    writeRepoFile('canon/config/preview.json', '{"writes":["board"]}')

    const outcome = await runDriveCopy(['7'])

    expect(outcome.record).toMatchObject({
      reason: 'copied',
      env: 'CANON_PREVIEW_ROOT',
      copyRoot: expect.stringMatching(/\.canon\/tmp\/pr\/review-ui\/x\/board$/),
    })
    expect(
      readFileSync(
        join(repoRoot, '.canon/tmp/pr/review-ui/x/board/board/frames.json'),
        'utf8',
      ),
    ).toBe('{"x":0}')
  })

  it('should keep a declared keep path and a root-level file through a --baseline rebuild', async () => {
    writeRepoFile(
      'canon/config/preview.json',
      '{"writes":["board"],"keep":["board/.run"]}',
    )
    const first = await runDriveCopy(['7', '--baseline'])
    const copyRoot = String(first.record.copyRoot)
    mkdirSync(join(copyRoot, 'board/.run'), { recursive: true })
    writeFileSync(join(copyRoot, 'board/.run/address.json'), '{"pid":1}')
    writeFileSync(join(copyRoot, 'server-state.json'), '{}')
    writeFileSync(join(copyRoot, 'board/dragged.json'), '{}')

    await runDriveCopy(['7', '--baseline'])

    expect(
      readFileSync(join(copyRoot, 'board/.run/address.json'), 'utf8'),
    ).toBe('{"pid":1}')
    expect(existsSync(join(copyRoot, 'server-state.json'))).toBe(true)
    expect(existsSync(join(copyRoot, 'board/dragged.json'))).toBe(false)
  })

  it('should land the worker, named by no number, on the copy the reviewer rebuilds', async () => {
    writeRepoFile('canon/config/preview.json', '{"writes":["board"]}')

    const worker = await runDriveCopy([])
    const reviewer = await runDriveCopy(['7'])

    expect(worker.record.copyRoot).toBe(reviewer.record.copyRoot)
  })

  it('should exit with the changed path when a drive wrote a tracked file after the baseline', async () => {
    await runDriveCopy(['7', '--baseline'])
    writeRepoFile('board/frames.json', '{"x":40}')

    const outcome = await runDriveCopy(['7', '--check'])

    expect(outcome).toEqual({
      record: expect.objectContaining({
        reason: 'changed',
        paths: ['board/frames.json'],
      }),
      exit: 1,
    })
  })

  it('should read clean when nothing changed since the baseline', async () => {
    writeRepoFile('board/frames.json', '{"worker":1}')
    await runDriveCopy(['7', '--baseline'])

    const outcome = await runDriveCopy(['7', '--check'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'clean' }),
      exit: 0,
    })
  })

  it('should refuse --check with no baseline recorded', async () => {
    const outcome = await runDriveCopy(['7', '--check'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-baseline' }),
      exit: 1,
    })
  })

  it('should refuse as no-worktree when no local worktree holds the branch', async () => {
    writePull('feat/cloud')

    const outcome = await runDriveCopy(['7', '--baseline'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-worktree' }),
      exit: 1,
    })
  })
})
