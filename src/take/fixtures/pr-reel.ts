/**
 * Films the take fixtures a branch touches with the branch's own engine into
 * one reel, so a pull request changing `canon take` carries evidence filmed by
 * the code under review rather than the published `canon` on PATH.
 *
 * Usage: bun src/take/fixtures/pr-reel.ts --base <ref> --out <dir>
 *   [--plan <file> [--fixture <stem>]] [--json]
 *
 * A changed `<stem>.html` films with the `<stem>.json` plan beside it. A diff
 * whose take change reaches no planned fixture refuses as `unplanned`, naming
 * the paths, rather than filming a stock board that shows none of it. Each
 * fixture films into `<out>/<stem>/` and every beat joins `<out>/reel.webp`.
 *
 * `--plan` films a plan written for the change on `--fixture`, `motion` by
 * default, in place of the selection, under the same cap a fixture plan meets.
 */

import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { type FilmedBeat, take } from '@/take/film'
import { serveFixture } from '@/take/fixtures/motion-server'
import { readTakePlan } from '@/take/plan'
import { renderReel } from '@/take/reel'

const ENGINE = 'src/take/'
const DEFAULT_FIXTURE = 'motion'
const FIXTURES = `${ENGINE}fixtures/`

/** The most filmed seconds the beats of every fixture may sum to. */
export const REEL_CAP_SECONDS = 15

export type Selection =
  | { readonly kind: 'untouched' }
  | { readonly kind: 'film'; readonly stems: readonly string[] }
  /** The take paths changed with no plan to film them, being every engine path. */
  | { readonly kind: 'unplanned'; readonly paths: readonly string[] }

/**
 * Which fixtures a diff films, from the paths it changed and the file names
 * the fixture folder holds. A test is not the engine, so a diff touching only
 * tests films nothing. A changed page or plan films its fixture when both
 * exist, and a diff reaching no such fixture is `unplanned`, since nothing on
 * the shelf was written to show it.
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
    .filter((path) => path.startsWith(FIXTURES))
    .map((path) => path.slice(FIXTURES.length).replace(/\.(html|json)$/, ''))
    .filter(
      (stem) =>
        !stem.includes('/') &&
        files.has(`${stem}.html`) &&
        files.has(`${stem}.json`),
    )
  const unique = [...new Set(stems)].sort()
  if (unique.length > 0) return { kind: 'film', stems: unique }
  return { kind: 'unplanned', paths: engine }
}

const USAGE =
  'Usage: bun src/take/fixtures/pr-reel.ts --base <ref> --out <dir> [--plan <file> [--fixture <stem>]] [--json]'

/** A plan written for the change and the fixture page it films on. */
export interface AuthoredPlan {
  readonly plan: string
  readonly fixture: string
}

export type ReelArgs =
  | { readonly kind: 'usage'; readonly message: string }
  | {
      readonly kind: 'run'
      readonly base: string
      readonly out: string
      readonly json: boolean
      readonly authored?: AuthoredPlan
    }

/**
 * The run the command line asks for, refusing a `--fixture` with no `--plan`
 * to film on it and a fixture the folder holds no page for.
 */
export function readReelArgs(
  argv: readonly string[],
  fixtureFiles: readonly string[],
): ReelArgs {
  let values: {
    base?: string
    out?: string
    plan?: string
    fixture?: string
    json?: boolean
  }
  try {
    values = parseArgs({
      args: [...argv],
      options: {
        base: { type: 'string' },
        out: { type: 'string' },
        plan: { type: 'string' },
        fixture: { type: 'string' },
        json: { type: 'boolean' },
      },
    }).values
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { kind: 'usage', message: `${message}\n${USAGE}` }
  }
  if (values.base === undefined || values.out === undefined) {
    return { kind: 'usage', message: USAGE }
  }
  const run = {
    kind: 'run' as const,
    base: values.base,
    out: values.out,
    json: values.json ?? false,
  }
  if (values.plan === undefined) {
    if (values.fixture === undefined) return run
    return {
      kind: 'usage',
      message: `--fixture names the page a --plan films on, so it needs one\n${USAGE}`,
    }
  }
  const fixture = values.fixture ?? DEFAULT_FIXTURE
  if (fixture.includes('/') || !fixtureFiles.includes(`${fixture}.html`)) {
    return {
      kind: 'usage',
      message: `no fixture page ${fixture}.html in src/take/fixtures/\n${USAGE}`,
    }
  }
  return { ...run, authored: { plan: values.plan, fixture } }
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
      /** On `unplanned`, the take paths no plan films. */
      readonly paths?: readonly string[]
    }

function changedPaths(base: string): string[] | string {
  const diff = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf8',
  })
  if (diff.status !== 0) return diff.stderr.trim() || `git diff ${base} failed`
  return diff.stdout.split('\n').filter((line) => line.length > 0)
}

async function film(
  base: string,
  outDir: string,
  authored: AuthoredPlan | undefined,
): Promise<ReelRecord> {
  const changed = changedPaths(base)
  if (typeof changed === 'string') {
    return { status: 'failed', reason: 'diff-unreadable', message: changed }
  }
  const folder = new URL('./', import.meta.url)
  const selection = selectFixtures(changed, readdirSync(folder))
  if (selection.kind === 'untouched') return { status: 'untouched' }
  if (selection.kind === 'unplanned' && authored === undefined) {
    return {
      status: 'failed',
      reason: 'unplanned',
      message: `no changed fixture carries a plan, so nothing films ${selection.paths.join(', ')}`,
      paths: selection.paths,
    }
  }

  const out = resolve(outDir)
  const joined: FilmedBeat[] = []
  const filmed: { fixture: string; name: string; still: string }[] = []
  let seconds = 0
  const targets =
    authored !== undefined
      ? [{ stem: authored.fixture, plan: resolve(authored.plan) }]
      : selection.kind === 'film'
        ? selection.stems.map((stem) => ({
            stem,
            plan: fileURLToPath(new URL(`${stem}.json`, folder)),
          }))
        : []
  for (const { stem, plan } of targets) {
    let text: string
    try {
      text = readFileSync(plan, 'utf8')
    } catch (error) {
      return {
        status: 'failed',
        reason: 'plan-unreadable',
        message: `${plan}: ${error instanceof Error ? error.message : error}`,
        fixture: stem,
      }
    }
    const read = readTakePlan(text)
    if (read.kind !== 'read') {
      return {
        status: 'failed',
        reason: 'plan-unreadable',
        message: `${plan}: ${read.detail}`,
        fixture: stem,
      }
    }
    const server = serveFixture(new URL(`${stem}.html`, folder))
    try {
      const result = await take({
        url: server.url,
        plan: read.plan,
        out: join(out, stem),
        maxSeconds: REEL_CAP_SECONDS - seconds,
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
      for (const beat of result.beats) {
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
  const args = readReelArgs(
    argv,
    readdirSync(new URL('./', import.meta.url), 'utf8'),
  )
  if (args.kind === 'usage') {
    process.stderr.write(`${args.message}\n`)
    return 2
  }
  const record = await film(args.base, args.out, args.authored)
  report(record, args.json)
  return record.status === 'failed' ? 1 : 0
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2))
