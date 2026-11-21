import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/roots/project'
import { stateDir } from '@/targets/registry'

const CLI = join(PROJECT_ROOT, 'src/cli.ts')

/** No case has ever needed longer, and a blocked verb should fail fast. */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * A spawn that reaches `bun add` fails at once against this unreachable
 * address, so an unseeded install is a loud defect rather than a test that
 * passes or fails with the network. `options.env` still wins.
 */
const DEAD_REGISTRY = 'http://127.0.0.1:9'

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
 * machine's real toolkit state, which `stateDir()` in `src/targets/registry.ts` holds.
 * A case inheriting the real `HOME` writes into it, and only this check says so.
 */
export class ContainmentViolation extends Error {}

/**
 * Compares two snapshots of this machine's real toolkit state directory and reports
 * whether a spawn changed it. Pure over the two reads, so it tests without a disk.
 */
export function detectStateLeak(
  before: string | undefined,
  after: string | undefined,
): boolean {
  return before !== after
}

/**
 * A sorted `path:size` listing of every file under this machine's real `stateDir()`,
 * walked recursively, so a write nested in an existing folder shows up as a new
 * top-level entry would.
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
 * Spawns the real entry point rather than calling an action in-process, so a case
 * proves the verb is registered and emits a `--json` record that parses off stdout.
 * Every spawn drops `GIT_` variables and points the state dirs under the case's `cwd`.
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
      CANON_STATE_DIR: join(options.cwd, '.canon-state'),
      CANON_SANDBOX_DIR: join(options.cwd, '.canon-state', 'sandbox'),
      BUN_CONFIG_REGISTRY: DEAD_REGISTRY,
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
 * Data goes to stdout and framing to stderr. A command that emits no JSON, or fails
 * first, leaves the field `undefined` rather than throwing.
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
