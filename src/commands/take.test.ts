import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { findShell, shellPath } from '@/take/shell'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const CLI = join(REPO_ROOT, 'src', 'cli.ts')
const RUN_TIMEOUT_MS = 30_000

/**
 * Spawns the CLI rather than importing the action, because a refusal reports
 * through `process.exitCode` and an in-process call would set it on the runner.
 * Every case refuses before a frame is filmed, so none pays for a take.
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

  it.each(['1280', '2560x1440', '801x600'])(
    'should refuse bad-viewport for --viewport %s before filming',
    async (value) => {
      const result = await runTake([
        'http://127.0.0.1:9/',
        plan,
        '--out',
        dir,
        '--viewport',
        value,
      ])

      expect(result).toMatchObject({
        exitCode: 1,
        record: { reason: 'bad-viewport' },
      })
    },
  )

  it.each(['961', '318', '1922', 'abc'])(
    'should refuse bad-reel-width for --reel-width %s before filming',
    async (value) => {
      const result = await runTake([
        'http://127.0.0.1:9/',
        plan,
        '--out',
        dir,
        '--reel',
        join(dir, 'reel.webp'),
        '--reel-width',
        value,
      ])

      expect(result).toMatchObject({
        exitCode: 1,
        record: { reason: 'bad-reel-width' },
      })
    },
  )

  it('should refuse bad-reel-width past the narrowest window, not the first', async () => {
    const sizes = join(dir, 'sizes.json')
    const steps = [{ kind: 'wait', ms: 100 }]
    writeFileSync(
      sizes,
      JSON.stringify({
        beats: [
          { name: 'wide', steps },
          { name: 'small', viewport: { width: 800, height: 450 }, steps },
        ],
      }),
    )

    const result = await runTake([
      'http://127.0.0.1:9/',
      sizes,
      '--out',
      dir,
      '--reel',
      join(dir, 'reel.webp'),
      '--reel-width',
      '1000',
    ])

    expect(result).toMatchObject({
      exitCode: 1,
      record: {
        reason: 'bad-reel-width',
        message: expect.stringContaining('800'),
      },
    })
  })

  it('should refuse bad-reel-width with no --reel rather than ignore it', async () => {
    const result = await runTake([
      'http://127.0.0.1:9/',
      plan,
      '--out',
      dir,
      '--reel-width',
      '640',
    ])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { reason: 'bad-reel-width' },
    })
  })

  it('should refuse reel-shape before filming beats of two aspect ratios', async () => {
    const shapes = join(dir, 'shapes.json')
    const steps = [{ kind: 'wait', ms: 100 }]
    writeFileSync(
      shapes,
      JSON.stringify({
        beats: [
          { name: 'wide', steps },
          { name: 'square', viewport: { width: 800, height: 600 }, steps },
        ],
      }),
    )

    const result = await runTake([
      'http://127.0.0.1:9/',
      shapes,
      '--out',
      dir,
      '--reel',
      join(dir, 'reel.webp'),
    ])

    expect(result).toMatchObject({
      exitCode: 1,
      record: {
        reason: 'reel-shape',
        message: expect.stringContaining('square'),
      },
    })
  })

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

  it.skipIf(!hasFfmpeg)(
    'should refuse sandbox-blocked naming the shell when it finds no sandbox',
    async () => {
      // A fake shell where Playwright keeps the real one, dying on Chromium's signal.
      const browsers = join(dir, 'blocked-browsers')
      const shell = shellPath({ PLAYWRIGHT_BROWSERS_PATH: browsers })
      mkdirSync(dirname(shell), { recursive: true })
      writeFileSync(
        shell,
        "#!/bin/sh\necho '[1:FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox!' >&2\nkill -TRAP $$\n",
      )
      chmodSync(shell, 0o755)
      const served = Bun.serve({ port: 0, fetch: () => new Response('') })
      try {
        const result = await runTake(
          [`http://127.0.0.1:${served.port}/`, plan, '--out', dir],
          { PLAYWRIGHT_BROWSERS_PATH: browsers },
        )

        expect(result).toMatchObject({
          exitCode: 1,
          record: {
            reason: 'sandbox-blocked',
            beat: 'press go',
            message: expect.stringContaining(shell),
          },
        })
      } finally {
        served.stop(true)
      }
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

/** A stepped beat's log, whose glide lands 300 ms before its click. */
function steppedLog(glideMs = 600): string {
  return JSON.stringify({
    version: 1,
    viewport: { width: 1920, height: 1080 },
    fps: 60,
    route: 'step',
    frames: 120,
    events: [
      {
        t: 600,
        kind: 'move',
        from: { x: 960, y: 540 },
        to: { x: 500, y: 300 },
        ms: glideMs,
      },
      { t: 1500, kind: 'click', at: { x: 500, y: 300 } },
    ],
  })
}

/** A track holding the whole page, so no zoom rule can fire. */
const WIDE_TRACK = JSON.stringify({
  version: 1,
  viewport: { width: 1920, height: 1080 },
  fps: 60,
  frames: [0, 1, 2].map((index) => ({
    ms: index * (1000 / 60),
    scale: 1,
    x: 0,
    y: 0,
    cursor: { x: 960, y: 540 },
    ring: null,
  })),
})

function writeBeat(
  takes: string,
  dir: string,
  files: { log?: string; track?: string; clip?: boolean },
): void {
  mkdirSync(join(takes, dir), { recursive: true })
  if (files.log) writeFileSync(join(takes, dir, 'log.json'), files.log)
  if (files.track) writeFileSync(join(takes, dir, 'camera.json'), files.track)
  if (files.clip) writeFileSync(join(takes, dir, 'clip.mp4'), '')
}

describe('canon take check', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-take-check-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should refuse a folder with no take.json as no-takes', async () => {
    const takes = join(dir, 'empty')
    writeBeat(takes, '01-open', { log: steppedLog(), track: WIDE_TRACK })

    const result = await runTake(['check', takes])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { ok: false, reason: 'no-takes' },
    })
  })

  it('should refuse a beat with no camera.json as no-track, naming it', async () => {
    const takes = join(dir, 'lost-track')
    writeBeat(takes, '01-open', { log: steppedLog() })
    writeFileSync(
      join(takes, 'take.json'),
      JSON.stringify({ beats: [{ name: 'open', dir: '01-open' }] }),
    )

    const result = await runTake(['check', takes])

    expect(result).toMatchObject({
      exitCode: 1,
      record: { ok: false, reason: 'no-track', beat: '01-open' },
    })
  })

  it('should check a harness folder take.json does not list after the listed beats', async () => {
    const takes = join(dir, 'with-harness')
    writeBeat(takes, '02-listed', { log: steppedLog(), track: WIDE_TRACK })
    writeBeat(takes, '01-harness', {
      log: steppedLog(),
      track: WIDE_TRACK,
      clip: true,
    })
    writeFileSync(
      join(takes, 'take.json'),
      JSON.stringify({ beats: [{ name: 'listed', dir: '02-listed' }] }),
    )

    const result = await runTake(['check', takes])

    expect(result).toMatchObject({
      exitCode: 0,
      record: {
        ok: true,
        beats: [
          { dir: '02-listed', breaches: [] },
          { dir: '01-harness', breaches: [] },
        ],
      },
    })
  })

  it('should fail a beat breaking a rule with exit 2 and reason breach', async () => {
    const takes = join(dir, 'fast-glide')
    writeBeat(takes, '01-open', { log: steppedLog(300), track: WIDE_TRACK })
    writeFileSync(
      join(takes, 'take.json'),
      JSON.stringify({ beats: [{ name: 'open', dir: '01-open' }] }),
    )

    const result = await runTake(['check', takes])

    expect(result).toMatchObject({
      exitCode: 2,
      record: {
        ok: false,
        reason: 'breach',
        beats: [
          {
            dir: '01-open',
            breaches: [{ rule: 'glide-fast', t: 600, measured: 300 }],
          },
        ],
      },
    })
  })
})
