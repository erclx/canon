/**
 * Checks, or with `--write` films, the reel the landing page's film section
 * plays: `canon take` over the built page's records section, once per theme,
 * as `web/film-plan.json` names the beats.
 *
 * Each reel carries a stamp beside it holding the plan's digest, the images'
 * digests, and each beat's seconds, which the section reads to step its beat
 * row in time. The check `web:build` runs refuses a reel whose stamp no longer
 * matches the plan or the image, so an edited plan cannot ship an old reel.
 *
 * The take encodes lossless, which runs to megabytes over a page this size,
 * so the reel is rendered again here under a cap that forces the lossy pass.
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
/** Far under the take's own cap, so the reel always takes the lossy pass. */
const REEL_BYTES = 1_000_000
const VIEWPORT = '1280x800'
const PORT = Number(process.env.FILM_PORT ?? 4537)

interface Theme {
  readonly name: 'dark' | 'light'
  readonly reel: string
  readonly still: string
  readonly stamp: string
}

const THEMES: readonly Theme[] = [
  {
    name: 'dark',
    reel: 'assets/loops/film.webp',
    still: 'assets/loops/film-still.webp',
    stamp: 'assets/loops/film.stamp',
  },
  {
    name: 'light',
    reel: 'assets/loops/film-light.webp',
    still: 'assets/loops/film-still-light.webp',
    stamp: 'assets/loops/film-light.stamp',
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
  fail(`the preview at ${url} never answered`)
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
  if (take.status !== 0) fail(`canon take exited ${take.status}`)
  const record = JSON.parse(take.stdout) as { beats: FilmedBeat[] }
  const reel = await renderReel(
    dir,
    record.beats,
    join(root, theme.reel),
    REEL_BYTES,
  )

  const last = record.beats.at(-1)
  if (!last) fail('the take filmed no beat')
  const still = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      join(dir, last.still),
      '-vf',
      'scale=960:-2',
      '-quality',
      '80',
      join(root, theme.still),
    ],
    { stdio: 'inherit' },
  )
  if (still.status !== 0) fail(`ffmpeg could not write ${theme.still}`)

  writeFileSync(
    join(root, theme.stamp),
    [
      `source: ${url}`,
      `plan-sha256: ${plan}`,
      `image-sha256: ${sha(theme.reel)}`,
      `still-sha256: ${sha(theme.still)}`,
      `reel-seconds: ${reel.seconds}`,
      `beats: ${record.beats.map((beat) => beat.seconds).join(' ')}`,
      '',
    ].join('\n'),
  )
  console.log(`regen-web-film: wrote ${theme.reel} and ${theme.still}`)
}

const plan = sha(PLAN)

if (!process.argv.includes('--write')) {
  const reasons = THEMES.flatMap((theme) => staleness(theme, plan))
  if (reasons.length)
    fail(
      `${reasons.join(', ')}. Build the page, then run bun run web:film -- --write to film it again.`,
    )
  console.log(`regen-web-film: both reels match ${PLAN}`)
} else {
  if (!existsSync(join(root, 'web/dist/index.html')))
    fail('web/dist holds no built page, so build it before filming')
  const server = spawn(
    'bunx',
    ['astro', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
    { cwd: join(root, 'web'), stdio: 'ignore' },
  )
  try {
    const base = `http://127.0.0.1:${PORT}/`
    await waitFor(base)
    for (const theme of THEMES) await film(theme, `${base}#records`, plan)
  } finally {
    server.kill()
  }
}
