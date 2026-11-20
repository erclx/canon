/**
 * Checks, or with `--write` films per theme, the reel of the records section `web/film-plan.json` names the beats of, with one still per beat for the evidence section's filmstrip.
 * The check `web:build` runs refuses a reel whose stamp no longer matches the plan, the image, or a still, so an edited plan cannot ship an old reel.
 */
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { FilmedBeat } from '../../src/take/film'
import { renderReel } from '../../src/take/reel'

const root = new URL('../..', import.meta.url).pathname
const PLAN = 'web/film-plan.json'
/** Far under the take's own cap, so a lossless reel of megabytes always takes the lossy pass. */
const REEL_BYTES = 1_000_000
const VIEWPORT = '1280x800'
const PORT = Number(process.env.FILM_PORT ?? 4537)

interface Theme {
  readonly name: 'dark' | 'light'
  readonly reel: string
  readonly still: string
  readonly stamp: string
  /** Where the still closing beat `n`, counted from 1, lands. */
  readonly beat: (n: number) => string
}

const THEMES: readonly Theme[] = [
  {
    name: 'dark',
    reel: 'assets/loops/film.webp',
    still: 'assets/loops/film-still.webp',
    stamp: 'assets/loops/film.stamp',
    beat: (n) => `assets/loops/film-beat-${n}.webp`,
  },
  {
    name: 'light',
    reel: 'assets/loops/film-light.webp',
    still: 'assets/loops/film-still-light.webp',
    stamp: 'assets/loops/film-light.stamp',
    beat: (n) => `assets/loops/film-beat-${n}-light.webp`,
  },
]

const sha = (path: string) =>
  createHash('sha256')
    .update(readFileSync(join(root, path)))
    .digest('hex')

function fail(message: string): never {
  console.error(`regen-web-film: ${message}`)
  process.exit(1)
}

/** The reasons a theme's committed reel no longer matches the plan, empty when it does. */
function staleness(theme: Theme, plan: string): string[] {
  const missing = [theme.reel, theme.still, theme.stamp].filter(
    (path) => !existsSync(join(root, path)),
  )
  if (missing.length) return missing.map((path) => `${path} is missing`)
  const stamp = readStamp(theme.stamp)
  const reasons: string[] = []
  if (stamp['plan-sha256'] !== plan)
    reasons.push(`${theme.stamp} was filmed from another ${PLAN}`)
  if (stamp['image-sha256'] !== sha(theme.reel))
    reasons.push(`${theme.reel} differs from the image its stamp names`)
  if (stamp['still-sha256'] !== sha(theme.still))
    reasons.push(`${theme.still} differs from the still its stamp names`)
  const beats = (stamp['beat-stills-sha256'] ?? '').split(' ').filter(Boolean)
  if (beats.length === 0) reasons.push(`${theme.stamp} names no beat still`)
  beats.forEach((digest, index) => {
    const path = theme.beat(index + 1)
    if (!existsSync(join(root, path))) reasons.push(`${path} is missing`)
    else if (digest !== sha(path))
      reasons.push(`${path} differs from the still its stamp names`)
  })
  return reasons
}

function readStamp(path: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(root, path), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const at = line.indexOf(': ')
        return [line.slice(0, at), line.slice(at + 2)]
      }),
  )
}

/** The plan with the theme toggle pressed ahead of every beat, which a fresh load opens in light. */
function planFor(theme: Theme, dir: string): string {
  const plan = JSON.parse(readFileSync(join(root, PLAN), 'utf8')) as {
    beats: { setup?: unknown[] }[]
  }
  if (theme.name === 'dark')
    for (const beat of plan.beats)
      beat.setup = [
        { kind: 'click', target: '.theme-toggle' },
        ...(beat.setup ?? []),
      ]
  const path = join(dir, 'plan.json')
  writeFileSync(path, JSON.stringify(plan))
  return path
}

async function waitFor(url: string) {
  for (let tries = 0; tries < 60; tries += 1) {
    const ok = await fetch(url).then(
      (response) => response.ok,
      () => false,
    )
    if (ok) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`the preview at ${url} never answered`)
}

/** Scales a filmed frame down to `width` and writes it as WebP at `path` under the root. */
function writeStill(frame: string, path: string, width: number) {
  const still = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      frame,
      '-vf',
      `scale=${width}:-2`,
      '-quality',
      '80',
      join(root, path),
    ],
    { stdio: 'inherit' },
  )
  if (still.status !== 0) throw new Error(`ffmpeg could not write ${path}`)
}

async function film(theme: Theme, url: string, plan: string) {
  const dir = mkdtempSync(join(tmpdir(), `canon-film-${theme.name}-`))
  const take = spawnSync(
    'bun',
    [
      join(root, 'src/cli.ts'),
      'take',
      url,
      planFor(theme, dir),
      '--out',
      dir,
      '--viewport',
      VIEWPORT,
      '--json',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  )
  if (take.status !== 0) throw new Error(`canon take exited ${take.status}`)
  const record = JSON.parse(take.stdout) as { beats: FilmedBeat[] }
  const reel = await renderReel(
    dir,
    record.beats,
    join(root, theme.reel),
    REEL_BYTES,
  )

  const last = record.beats.at(-1)
  if (!last) throw new Error('the take filmed no beat')
  writeStill(join(dir, last.still), theme.still, 960)
  const beats = record.beats.map((beat, index) => {
    const path = theme.beat(index + 1)
    writeStill(join(dir, beat.still), path, 640)
    return path
  })

  writeFileSync(
    join(root, theme.stamp),
    [
      `source: ${url}`,
      `plan-sha256: ${plan}`,
      `image-sha256: ${sha(theme.reel)}`,
      `still-sha256: ${sha(theme.still)}`,
      `beat-stills-sha256: ${beats.map(sha).join(' ')}`,
      `reel-seconds: ${reel.seconds}`,
      `beats: ${record.beats.map((beat) => beat.seconds).join(' ')}`,
      '',
    ].join('\n'),
  )
  console.log(
    `regen-web-film: wrote ${theme.reel}, ${theme.still}, and ${beats.length} beat stills`,
  )
}

const plan = sha(PLAN)

if (!process.argv.includes('--write')) {
  const reasons = THEMES.flatMap((theme) => staleness(theme, plan))
  if (reasons.length)
    fail(
      `${reasons.join(', ')}. Run bun run web:film -- --write, which builds the page and films it again.`,
    )
  console.log(`regen-web-film: both reels match ${PLAN}`)
} else {
  // `web:build` runs the check above first, so it cannot build the page this films.
  const build = spawnSync('bunx', ['astro', 'build'], {
    cwd: join(root, 'web'),
    stdio: 'inherit',
  })
  if (build.status !== 0) fail(`astro build exited ${build.status}`)
  const server = spawn(
    'bunx',
    ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: join(root, 'web'), stdio: 'ignore' },
  )
  try {
    const base = `http://127.0.0.1:${PORT}/`
    await waitFor(base)
    for (const theme of THEMES) await film(theme, `${base}#records`, plan)
  } catch (error) {
    console.error(
      `regen-web-film: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  } finally {
    server.kill()
  }
}
