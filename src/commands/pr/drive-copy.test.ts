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
import { PASS_OFFSET_SHIFT, stopPassPreview } from '@/pr/drive-copy'

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

  describe('with a seed', () => {
    function writeSeed(script: string): void {
      writeRepoFile(
        'canon/config/preview.json',
        JSON.stringify({
          writes: ['board'],
          seed: [process.execPath, '-e', script],
        }),
      )
      git('add', '.')
      git('commit', '-q', '-m', 'seed')
    }

    it('should run the seed into the copy and report it on the record', async () => {
      writeSeed(
        "console.log('seeding'); require('fs').writeFileSync(process.env.CANON_PREVIEW_ROOT + '/board/seeded.json', '{}')",
      )

      const outcome = await runDriveCopy(['7'])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'copied',
          seed: { ran: true, exit: 0 },
        }),
        exit: 0,
      })
      expect(
        existsSync(join(String(outcome.record.copyRoot), 'board/seeded.json')),
      ).toBe(true)
    })

    it('should carry no seed key when the project declares none', async () => {
      writeRepoFile('canon/config/preview.json', '{"writes":["board"]}')

      const outcome = await runDriveCopy(['7'])

      expect(outcome.record).not.toHaveProperty('seed')
    })

    it('should refuse as seed-failed when the seed exits non-zero', async () => {
      writeSeed("console.error('no fixtures'); process.exit(2)")

      const outcome = await runDriveCopy(['7'])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'seed-failed',
          seed: {
            ran: true,
            exit: 2,
            timedOut: false,
            stderr: ['no fixtures'],
          },
        }),
        exit: 1,
      })
    })

    it('should refuse as seed-failed with the cause and ran false when the seed command does not exist', async () => {
      writeRepoFile(
        'canon/config/preview.json',
        '{"writes":["board"],"seed":["canon-no-such-seed-command"]}',
      )

      const outcome = await runDriveCopy(['7'])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'seed-failed',
          message: expect.stringContaining('could not start'),
          seed: expect.objectContaining({
            ran: false,
            exit: null,
            error: expect.stringContaining('canon-no-such-seed-command'),
          }),
        }),
        exit: 1,
      })
    })

    it('should refuse as seed-wrote-worktree, naming the path, when the seed edits a tracked file', async () => {
      writeSeed("require('fs').writeFileSync('board/frames.json', '{}')")

      const outcome = await runDriveCopy(['7', '--baseline'])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'seed-wrote-worktree',
          paths: ['board/frames.json'],
        }),
        exit: 1,
      })
    })

    it('should run no seed under --check', async () => {
      writeSeed(
        "require('fs').appendFileSync(process.env.FAKE_DIR + '/seed-runs', 'x')",
      )
      await runDriveCopy(['7', '--baseline'])

      await runDriveCopy(['7', '--check'])

      expect(readFileSync(join(tempDir, 'seed-runs'), 'utf8')).toBe('x')
    })
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
    writePull('feat/elsewhere')

    const outcome = await runDriveCopy(['7', '--baseline'])

    expect(outcome).toEqual({
      record: expect.objectContaining({ reason: 'no-worktree' }),
      exit: 1,
    })
  })

  describe('with a pass server', () => {
    const base = 20_000 + Math.floor(Math.random() * 20_000)
    const passPort = base + PASS_OFFSET_SHIFT

    function writeServe(status = 200, extra: Record<string, unknown> = {}) {
      writeRepoFile(
        'canon/config/preview.json',
        JSON.stringify({
          writes: ['board'],
          port: base,
          serve: [
            process.execPath,
            '-e',
            `Bun.serve({ port: ${base} + Number(process.env.WORKTREE_PORT_OFFSET), fetch: () => new Response('<p>', { status: ${status}, headers: { 'content-type': 'text/html' } }) })`,
          ],
          ...extra,
        }),
      )
    }

    async function answers(port: number): Promise<boolean> {
      try {
        const response = await fetch(`http://localhost:${port}/`)
        await response.body?.cancel()
        return true
      } catch {
        return false
      }
    }

    afterEach(async () => {
      await stopPassPreview(join(repoRoot, '.canon/tmp/pr/review-ui/x/board'))
    })

    it('should start a server on the rebuilt copy under --serve and end it under --stop', async () => {
      writeServe()

      const served = await runDriveCopy(['7', '--baseline', '--serve'])
      const stopped = await runDriveCopy(['7', '--stop'])

      expect(served).toEqual({
        record: expect.objectContaining({
          reason: 'copied',
          url: `http://localhost:${passPort}`,
          port: passPort,
          pid: expect.any(Number),
        }),
        exit: 0,
      })
      expect(stopped).toEqual({
        record: expect.objectContaining({
          reason: 'stopped',
          pid: served.record.pid,
        }),
        exit: 0,
      })
      expect(await answers(passPort)).toBe(false)
    })

    it('should drive as before with no url when the project declares no serve', async () => {
      writeRepoFile('canon/config/preview.json', '{"writes":["board"]}')

      const outcome = await runDriveCopy(['7', '--baseline', '--serve'])

      expect(outcome).toEqual({
        record: expect.objectContaining({ reason: 'copied' }),
        exit: 0,
      })
      expect(outcome.record).not.toHaveProperty('url')
    })

    it('should stop the last pass server before starting the next one', async () => {
      writeServe()
      const first = await runDriveCopy(['7', '--serve'])

      const second = await runDriveCopy(['7', '--serve'])

      expect(second.record).toMatchObject({ reason: 'copied', port: passPort })
      expect(second.record.pid).not.toBe(first.record.pid)
      expect(() => process.kill(-Number(first.record.pid), 0)).toThrow()
    })

    it('should refuse as serve-failed with the output tail when the serve command exits early', async () => {
      writeServe(200, {
        serve: [
          process.execPath,
          '-e',
          "console.error('missing dev dependency'); process.exit(4)",
        ],
      })

      const outcome = await runDriveCopy(['7', '--serve'])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'serve-failed',
          serve: expect.objectContaining({
            cause: 'exited',
            exit: 4,
            output: ['missing dev dependency'],
          }),
        }),
        exit: 1,
      })
    })

    it('should refuse as preview-stale and stop the server when the page answers 500', async () => {
      writeServe(500)

      const outcome = await runDriveCopy(['7', '--serve'])

      expect(outcome).toEqual({
        record: expect.objectContaining({
          reason: 'preview-stale',
          path: '/',
          status: 500,
          stopped: true,
        }),
        exit: 1,
      })
      expect(await answers(passPort)).toBe(false)
    })

    it('should stop the server once no worktree holds the branch any more', async () => {
      writeServe()
      const served = await runDriveCopy(['7', '--serve'])
      git('checkout', '-q', '-b', 'chore/elsewhere')

      const stopped = await runDriveCopy(['7', '--stop'])

      expect(stopped).toEqual({
        record: expect.objectContaining({
          reason: 'stopped',
          pid: served.record.pid,
        }),
        exit: 0,
      })
      expect(await answers(passPort)).toBe(false)
    })

    it('should read as not-running on a --stop with no server started', async () => {
      const outcome = await runDriveCopy(['7', '--stop'])

      expect(outcome).toEqual({
        record: expect.objectContaining({ reason: 'not-running' }),
        exit: 0,
      })
    })

    it.each([['--check'], ['--baseline']])(
      'should refuse --stop combined with %s',
      async (flag) => {
        const outcome = await runDriveCopy(['7', '--stop', flag])

        expect(outcome.record).toMatchObject({ reason: 'bad-flags' })
      },
    )

    it('should refuse --serve combined with --check', async () => {
      const outcome = await runDriveCopy(['7', '--serve', '--check'])

      expect(outcome.record).toMatchObject({ reason: 'bad-flags' })
    })
  })
})
