import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from '@/project-root'

/**
 * The bash entry a scenario's hooks run through. Scenarios and the library they
 * call stay bash, so this contract is the whole of what the TypeScript harness
 * knows about one: which hooks it declares and what `use_config` exports.
 */
const HOOK_SCRIPT = join(PROJECT_ROOT, 'scripts', 'sandbox-hook.sh')

const ANCHOR_RECORD = '@anchor='

export interface Probe {
  readonly exports: Readonly<Record<string, string>>
  readonly isAnchor: boolean
}

export type ProbeResult =
  | ({ readonly ok: true } & Probe)
  | { readonly ok: false; readonly status: number }

/**
 * Reads the NUL-separated `NAME=value` pairs the probe prints. NUL rather than a
 * newline, since an exported value can hold one. The anchor record closes every
 * well-formed probe, so output missing it is a probe that did not finish.
 */
export function parseProbe(stdout: string): Probe {
  const { exports, anchor } = parsePairs(stdout)
  if (anchor === undefined)
    throw new Error('the probe printed no anchor record')

  return { exports, isAnchor: anchor === '1' }
}

function parsePairs(text: string): {
  exports: Record<string, string>
  anchor: string | undefined
} {
  const exports: Record<string, string> = {}
  let anchor: string | undefined

  for (const record of text.split('\0')) {
    if (record.startsWith(ANCHOR_RECORD)) {
      anchor = record.slice(ANCHOR_RECORD.length)
      continue
    }
    const split = record.indexOf('=')
    if (split > 0) exports[record.slice(0, split)] = record.slice(split + 1)
  }

  return { exports, anchor }
}

/**
 * Runs `use_config` and `use_anchor` in a child and returns what they exported.
 * Stderr is inherited by default, so a hook that fails narrates into the same
 * frame the harness writes. A non-zero status passes through rather than being
 * flattened, since the harness exits with it.
 */
export function probeScenario(
  file: string,
  env: NodeJS.ProcessEnv,
  stderr: 'inherit' | 'pipe' = 'inherit',
): ProbeResult {
  const result = spawnSync('bash', [HOOK_SCRIPT, 'probe', file], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', stderr],
  })
  const status = result.status ?? 1
  if (status !== 0) return { ok: false, status }

  return { ok: true, ...parseProbe(result.stdout) }
}

export interface StageResult {
  readonly status: number
  readonly exports: Readonly<Record<string, string>>
}

/**
 * Runs `stage_setup` inside the tree with every stream inherited, so a scenario
 * prompting through `select_or_route_scenario` still reaches a terminal and its
 * narration lands in order with the harness's own.
 *
 * The exports `stage_setup` changed come back through a file rather than a
 * pipe. Stdout belongs to the scenario, and a background process a scenario
 * starts would hold an extra pipe open past the child's exit.
 */
export function stageScenario(
  file: string,
  env: NodeJS.ProcessEnv,
  stdio: 'inherit' | 'ignore' = 'inherit',
): StageResult {
  const scratch = mkdtempSync(join(tmpdir(), 'canon-sandbox-hook-'))
  const report = join(scratch, 'exports')

  try {
    const result = spawnSync('bash', [HOOK_SCRIPT, 'stage', file, report], {
      env,
      stdio,
    })
    const status = result.status ?? 1
    const exports =
      status === 0 && existsSync(report)
        ? parsePairs(readFileSync(report, 'utf8')).exports
        : {}

    return { status, exports }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}
