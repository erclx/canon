import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findShell } from '@/take/shell'
// Spawns `canon take` through the CLI, so vitest selects this suite on a change
// to the command only through this import.
import '@/commands/take'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because a refusal reports
 * through `process.exitCode` and an in-process call would set it on the runner.
 * Each case here films real beats, so it skips without FFmpeg or a shell.
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

describe('canon take filming', () => {
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

        // The beat's two 0.6 s holds alone pass a 0.5 s cap, so machine load cannot move it.
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

        // A missing folder leaves the encoder nowhere to write, so only the reel refuses.
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
