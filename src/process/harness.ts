import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'
import { stateDir } from '@/targets/registry'

const CLI = join(PROJECT_ROOT, 'src/cli.ts')

/** No case has ever needed longer, and a blocked verb should fail fast. */
const DEFAULT_TIMEOUT_MS = 10_000

export interface ProcessRun {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly json: unknown
}

export interface RunCliOptions {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
  readonly timeoutMs?: number
}

/**
 * Thrown when a case reaches past its declared temporary directory into this
 * machine's real toolkit state. `stateDir()` in `src/targets/registry.ts`
 * holds both the target registry `gov install` and `gov sync` record into and
 * the sandbox tree `canon sandbox` provisions into, so a case that inherits the
 * real `HOME` unmodified writes into whichever of the two a verb touches, and
 * nothing but this check would ever say so.
 */
export class ContainmentViolation extends Error {}

/**
 * Compares two snapshots of this machine's real toolkit state directory and
 * reports whether a spawn changed it. A pure comparison over the two reads
 * rather than the read itself, so the detection logic is testable without
 * touching the filesystem or spawning anything.
 */
export function detectStateLeak(
  before: string | undefined,
  after: string | undefined,
): boolean {
  return before !== after
}

/**
 * A sorted `path:size` listing of every file under this machine's real
 * `stateDir()`, walked recursively rather than read one level deep, so a
 * write nested inside an existing folder, such as a file the sandbox tree
 * already holds, shows up the same as a new top-level entry. Reading a single
 * known file, such as the target registry alone, would miss every sibling
 * `stateDir()` grows, which is what left the sandbox tree unwatched.
 */
export function snapshotStateDir(): string {
  const root = stateDir()
  const rows: string[] = []

  function walk(dir: string): void {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      return
    }

    for (const name of names.sort()) {
      const full = join(dir, name)
      let info: ReturnType<typeof statSync>
      try {
        info = statSync(full)
      } catch {
        continue
      }
      if (info.isDirectory()) walk(full)
      else rows.push(`${full}:${info.size}`)
    }
  }

  walk(root)
  return rows.join('\n')
}

/**
 * Spawns the real entry point rather than calling a command's action function
 * in-process, so a case answers whether a verb is registered, whether it
 * exits the way its own contract states, and whether its `--json` record
 * parses off stdout alone, none of which an in-process call can misreport.
 *
 * A git hook exports `GIT_DIR`, which would resolve a fixture's git-aware
 * reads against this checkout instead of the temporary directory a case
 * builds, so every spawn drops the `GIT_` prefix before adding the headless
 * flag every case needs to avoid a picker blocking on stdin.
 *
 * `CANON_STATE_DIR` and `CANON_SANDBOX_DIR` get the same treatment as `GIT_DIR`,
 * each pointed at a folder under the case's own `cwd` rather than dropped,
 * since dropping either alone would still resolve through the inherited
 * `HOME` to this machine's real `~/.local/state/canon`. `stateDir()` and
 * `sandboxTree()` resolve the same three ways and share that parent, so both
 * overrides move together. A case explicitly passing its own value through
 * `options.env` still wins, matching `CANON_NON_INTERACTIVE` below.
 *
 * The `stateDir()` snapshot before and after the spawn is what actually
 * catches an escape past that redirection, since a default can be wrong in a
 * way a case never asserts on its own, and it is what `CANON_SANDBOX_DIR`
 * rides for free: the sandbox tree already sits under `stateDir()`, so
 * walking the whole directory catches a leak there with no override of its
 * own to add. `ContainmentViolation` fails loud rather than leaving a dead
 * row for a reviewer to find on a real machine.
 */
export function runCli(
  args: readonly string[],
  options: RunCliOptions,
): ProcessRun {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  )

  const before = snapshotStateDir()

  const result = spawnSync('bun', [CLI, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    env: {
      ...inherited,
      CANON_NON_INTERACTIVE: '1',
      CANON_STATE_DIR: join(options.cwd, '.canon-state'),
      CANON_SANDBOX_DIR: join(options.cwd, '.canon-state', 'sandbox'),
      ...options.env,
    },
  })

  const after = snapshotStateDir()
  if (detectStateLeak(before, after)) {
    throw new ContainmentViolation(
      `A case wrote into this machine's real toolkit state at ${stateDir()}. ` +
        'Every process-tier case must stay inside the directory it declared.',
    )
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    json: parseJson(result.stdout),
  }
}

/**
 * Data goes to stdout and framing to stderr, so a harness reading `--json`
 * off the merged output would assert against a record no verb ever wrote. A
 * command that emits no JSON, or fails before it gets there, leaves the
 * field `undefined` rather than throwing, so a case asserting the exit code
 * of a refusal is not also forced to guard a parse.
 */
function parseJson(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (trimmed === '') return undefined

  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}
