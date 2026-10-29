import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findShell } from '@/take/shell'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because a refusal reports
 * through `process.exitCode` and an in-process call would set it on the test
 * runner. Every case refuses before a frame is filmed, so none of them pays for
 * a take.
 */
async function runTake(
  args: string[],
  env: NodeJS.ProcessEnv = {},
): Promise<{ exitCode: number; record: Record<string, unknown> }> {
  const result = await execa(
    process.execPath,
    [CLI, 'take', ...args, '--json'],
    {
      cwd: REPO_ROOT,
      reject: false,
      timeout: RUN_TIMEOUT_MS,
      env,
    },
  )
  return {
    exitCode: result.exitCode ?? 1,
    record: JSON.parse(result.stdout.trim() || '{}') as Record<string, unknown>,
  }
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

function hasShell(): boolean {
  try {
    findShell()
    return true
  } catch {
    return false
  }
}

const ONE_BEAT = JSON.stringify({
  beats: [{ name: 'press go', steps: [{ kind: 'click', target: '#go' }] }],
})

describe('canon take', () => {
  let dir: string
  let plan: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-take-cmd-'))
    plan = join(dir, 'plan.json')
    writeFileSync(plan, ONE_BEAT)
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should refuse a plan path that holds nothing', async () => {
    const result = await runTake([
      'http://127.0.0.1:9/',
      join(dir, 'absent.json'),
      '--out',
      dir,
    ])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { reason: 'no-plan-file' },
    })
  })

  it('should refuse a plan step with the code the plan reader gave', async () => {
    const bad = join(dir, 'bad.json')
    writeFileSync(
      bad,
      JSON.stringify({ beats: [{ name: 'b', steps: [{ kind: 'click' }] }] }),
    )

    const result = await runTake(['http://127.0.0.1:9/', bad, '--out', dir])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { reason: 'bad-step' },
    })
  })

  it.each(['0', 'abc'])(
    'should refuse bad-max-seconds for --max-seconds %s before filming',
    async (value) => {
      const result = await runTake([
        'http://127.0.0.1:9/',
        plan,
        '--out',
        dir,
        '--max-seconds',
        value,
      ])

      expect(result).toMatchObject({
        exitCode: 1,
        record: { reason: 'bad-max-seconds' },
      })
    },
  )

  it('should refuse ffmpeg-missing when FFmpeg is not on the PATH', async () => {
    const result = await runTake(['http://127.0.0.1:9/', plan, '--out', dir], {
      PATH: join(dir, 'no-bin'),
    })

    expect(result).toMatchObject({
      exitCode: 1,
      record: { reason: 'ffmpeg-missing' },
    })
  })

  it.skipIf(!hasFfmpeg)(
    'should refuse browser-missing when the headless shell is not installed',
    async () => {
      const result = await runTake(
        ['http://127.0.0.1:9/', plan, '--out', dir],
        {
          PLAYWRIGHT_BROWSERS_PATH: join(dir, 'no-browsers'),
        },
      )

      expect(result).toMatchObject({
        exitCode: 1,
        record: { reason: 'browser-missing' },
      })
    },
  )

  it.skipIf(!hasFfmpeg || !hasShell())(
    'should refuse server-unreachable when nothing answers at the URL',
    async () => {
      // A port the kernel handed out and then released refuses the connection.
      const closed = Bun.serve({ port: 0, fetch: () => new Response('') })
      const port = Number(closed.port)
      closed.stop(true)

      const result = await runTake([
        `http://127.0.0.1:${port}/`,
        plan,
        '--out',
        dir,
      ])

      expect(result).toMatchObject({
        exitCode: 1,
        record: { reason: 'server-unreachable' },
      })
    },
  )

  it.skipIf(!hasFfmpeg || !hasShell())(
    'should refuse over-cap on the beat that crossed and film no later one',
    async () => {
      const served = Bun.serve({
        port: 0,
        fetch: () =>
          new Response('<button id="go">go</button>', {
            headers: { 'content-type': 'text/html' },
          }),
      })
      try {
        const twoBeats = join(dir, 'two-beats.json')
        writeFileSync(
          twoBeats,
          JSON.stringify({
            beats: [
              { name: 'press go', steps: [{ kind: 'click', target: '#go' }] },
              {
                name: 'press again',
                steps: [{ kind: 'click', target: '#go' }],
              },
            ],
          }),
        )
        const out = join(dir, 'capped-takes')

        // The beat's two 0.6 s holds alone pass a 0.5 s cap, so load on the
        // machine cannot move this case across it.
        const result = await runTake([
          `http://127.0.0.1:${served.port}/`,
          twoBeats,
          '--out',
          out,
          '--max-seconds',
          '0.5',
        ])

        expect(result).toMatchObject({
          exitCode: 1,
          record: { reason: 'over-cap', beat: 'press go' },
        })
        expect(existsSync(join(out, '02-press-again'))).toBe(false)
        expect(existsSync(join(out, 'take.json'))).toBe(false)
      } finally {
        served.stop(true)
      }
    },
    120_000,
  )

  it.skipIf(!hasFfmpeg || !hasShell())(
    'should film every beat when they stay under --max-seconds',
    async () => {
      const served = Bun.serve({
        port: 0,
        fetch: () =>
          new Response('<button id="go">go</button>', {
            headers: { 'content-type': 'text/html' },
          }),
      })
      try {
        const result = await runTake([
          `http://127.0.0.1:${served.port}/`,
          plan,
          '--out',
          join(dir, 'uncapped-takes'),
          '--max-seconds',
          '60',
        ])

        expect(result).toMatchObject({
          exitCode: 0,
          record: { beats: [{ name: 'press go' }] },
        })
      } finally {
        served.stop(true)
      }
    },
    120_000,
  )

  it.skipIf(!hasFfmpeg || !hasShell())(
    'should add the reel to the record when --reel is passed',
    async () => {
      const served = Bun.serve({
        port: 0,
        fetch: () =>
          new Response('<button id="go">go</button>', {
            headers: { 'content-type': 'text/html' },
          }),
      })
      try {
        const out = join(dir, 'reel-takes')
        const reel = join(dir, 'reel.webp')
        const result = await runTake([
          `http://127.0.0.1:${served.port}/`,
          plan,
          '--out',
          out,
          '--reel',
          reel,
        ])

        expect(result).toMatchObject({
          exitCode: 0,
          record: { reel: { file: reel, frames: expect.any(Number) } },
        })

        // A folder that does not exist leaves the encoder nowhere to write,
        // so the beats stand and the reel alone refuses.
        const missing = await runTake([
          `http://127.0.0.1:${served.port}/`,
          plan,
          '--out',
          out,
          '--reel',
          join(dir, 'absent', 'reel.webp'),
        ])
        expect(missing).toMatchObject({
          exitCode: 1,
          record: { reason: 'reel-failed', beats: [{ name: 'press go' }] },
        })
      } finally {
        served.stop(true)
      }
    },
    120_000,
  )
})
