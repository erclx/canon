/**
 * Films the take fixtures a branch touches with the branch's own engine into
 * one reel, so a pull request changing `canon take` carries evidence filmed by
 * the code under review rather than the published `canon` on PATH.
 *
 * Usage: bun src/take/fixtures/pr-reel.ts --base <ref> --out <dir> [--json]
 *
 * A changed `<stem>.html` films with the `<stem>.json` plan beside it. An
 * engine change that touches no planned fixture films `motion.json` on
 * `motion.html`, the plan `watch.ts` judges an engine change on. Each fixture
 * films into `<out>/<stem>/` and every beat joins `<out>/reel.webp`.
 */

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { type FilmedBeat, take } from '@/take/film'
import { serveFixture } from '@/take/fixtures/motion-server'
import { readTakePlan } from '@/take/plan'
import { renderReel } from '@/take/reel'

const ENGINE = 'src/take/'
const FIXTURES = `${ENGINE}fixtures/`
const FALLBACK = 'motion'

/** The most filmed seconds the beats of every fixture may sum to. */
export const REEL_CAP_SECONDS = 12

export type Selection =
  | { readonly kind: 'untouched' }
  | {
      readonly kind: 'film'
      readonly stems: readonly string[]
      /** True when no changed fixture carried a plan, so motion films instead. */
      readonly fallback: boolean
    }

/**
 * Which fixtures a diff films, from the paths it changed and the file names
 * the fixture folder holds. A test is not the engine, so a diff touching only
 * tests films nothing.
 */
export function selectFixtures(
  changed: readonly string[],
  fixtureFiles: readonly string[],
): Selection {
  const engine = changed.filter(
    (path) => path.startsWith(ENGINE) && !path.endsWith('.test.ts'),
  )
  if (engine.length === 0) return { kind: 'untouched' }

  const files = new Set(fixtureFiles)
  const stems = engine
    .filter((path) => path.startsWith(FIXTURES) && path.endsWith('.html'))
    .map((path) => path.slice(FIXTURES.length, -'.html'.length))
    .filter((stem) => !stem.includes('/') && files.has(`${stem}.json`))
  const unique = [...new Set(stems)].sort()
  if (unique.length > 0) return { kind: 'film', stems: unique, fallback: false }
  return { kind: 'film', stems: [FALLBACK], fallback: true }
}

/**
 * The beats kept in plan order while their sum stays within `cap`, and the
 * rest from the first beat that passes it. The fallback films a plan written
 * for judging an engine change rather than for a reel, so it is cut to fit
 * where a fixture's own plan refuses.
 */
export function fitBeats<T extends { readonly seconds: number }>(
  beats: readonly T[],
  cap: number,
): { readonly kept: readonly T[]; readonly dropped: readonly T[] } {
  let sum = 0
  const passed = beats.findIndex((beat) => {
    sum += beat.seconds
    return sum > cap
  })
  if (passed === -1) return { kept: [...beats], dropped: [] }
  return { kept: beats.slice(0, passed), dropped: beats.slice(passed) }
}

/** A beat filmed into `<stem>/` with its paths rebased onto the reel's folder. */
function rebased(stem: string, beat: FilmedBeat): FilmedBeat {
  return {
    ...beat,
    dir: join(stem, beat.dir),
    clip: join(stem, beat.clip),
    log: join(stem, beat.log),
    camera: join(stem, beat.camera),
    still: join(stem, beat.still),
  }
}

type ReelRecord =
  | { readonly status: 'untouched' }
  | {
      readonly status: 'filmed'
      readonly reel: string
      readonly seconds: number
      readonly bytes: number
      readonly fallback: boolean
      /** The fallback's beats past the cap, filmed and left out of the reel. */
      readonly dropped?: readonly string[]
      readonly beats: readonly {
        readonly fixture: string
        readonly name: string
        readonly still: string
      }[]
    }
  | {
      readonly status: 'failed'
      readonly reason: string
      readonly message: string
      readonly fixture?: string
      readonly beat?: string
      readonly still?: string
    }

function changedPaths(base: string): string[] | string {
  const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })
  if (diff.status !== 0) return diff.stderr.trim() || `git diff ${base} failed`
  return diff.stdout.split('\n').filter((line) => line.length > 0)
}

async function film(base: string, outDir: string): Promise<ReelRecord> {
  const changed = changedPaths(base)
  if (typeof changed === 'string') {
    return { status: 'failed', reason: 'diff-unreadable', message: changed }
  }
  const folder = new URL('./', import.meta.url)
  const selection = selectFixtures(changed, readdirSync(folder))
  if (selection.kind === 'untouched') return { status: 'untouched' }

  const out = resolve(outDir)
  const joined: FilmedBeat[] = []
  const filmed: { fixture: string; name: string; still: string }[] = []
  let seconds = 0
  let dropped: readonly string[] = []
  for (const stem of selection.stems) {
    const read = readTakePlan(
      readFileSync(new URL(`${stem}.json`, folder), 'utf8'),
    )
    if (read.kind !== 'read') {
      return {
        status: 'failed',
        reason: 'plan-unreadable',
        message: `${stem}.json: ${read.detail}`,
        fixture: stem,
      }
    }
    const server = serveFixture(new URL(`${stem}.html`, folder))
    try {
      const result = await take({
        url: server.url,
        plan: read.plan,
        out: join(out, stem),
        ...(!selection.fallback && {
          maxSeconds: REEL_CAP_SECONDS - seconds,
        }),
      })
      if (result.status !== 'filmed') {
        return {
          status: 'failed',
          reason: result.reason,
          message:
            result.reason === 'over-cap'
              ? `${stem}: the beats through ${result.beat} take the reel past ${REEL_CAP_SECONDS} s in sum`
              : result.message,
          fixture: stem,
          ...(result.beat !== undefined && { beat: result.beat }),
          ...(result.still !== undefined && {
            still: join(out, stem, result.still),
          }),
        }
      }
      const fit = selection.fallback
        ? fitBeats(result.beats, REEL_CAP_SECONDS)
        : { kept: result.beats, dropped: [] }
      dropped = fit.dropped.map((beat) => beat.name)
      for (const beat of fit.kept) {
        seconds += beat.seconds
        joined.push(rebased(stem, beat))
        filmed.push({
          fixture: stem,
          name: beat.name,
          still: join(out, stem, beat.still),
        })
      }
    } finally {
      server.stop()
    }
  }

  const file = join(out, 'reel.webp')
  try {
    const reel = await renderReel(out, joined, file)
    return {
      status: 'filmed',
      reel: file,
      seconds: reel.seconds,
      bytes: reel.bytes,
      fallback: selection.fallback,
      ...(dropped.length > 0 && { dropped }),
      beats: filmed,
    }
  } catch (error) {
    return {
      status: 'failed',
      reason: 'reel-failed',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

function report(record: ReelRecord, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(record)}\n`)
    return
  }
  if (record.status === 'untouched') {
    process.stdout.write(
      'No engine path changed, so there is nothing to film.\n',
    )
  } else if (record.status === 'filmed') {
    process.stdout.write(`${record.reel}\n`)
    for (const beat of record.beats) process.stdout.write(`${beat.still}\n`)
  } else {
    process.stderr.write(`${record.reason}: ${record.message}\n`)
  }
}

async function main(argv: readonly string[]): Promise<number> {
  const usage =
    'Usage: bun src/take/fixtures/pr-reel.ts --base <ref> --out <dir> [--json]\n'
  let values: { base?: string; out?: string; json?: boolean }
  try {
    values = parseArgs({
      args: [...argv],
      options: {
        base: { type: 'string' },
        out: { type: 'string' },
        json: { type: 'boolean' },
      },
    }).values
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : error}\n${usage}`,
    )
    return 2
  }
  if (values.base === undefined || values.out === undefined) {
    process.stderr.write(usage)
    return 2
  }
  const record = await film(values.base, values.out)
  report(record, values.json ?? false)
  return record.status === 'failed' ? 1 : 0
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
