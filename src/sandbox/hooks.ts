import { spawnSync } from 'node:child_process'
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
  const exports: Record<string, string> = {}
  let isAnchor: boolean | undefined

  for (const record of stdout.split('\0')) {
    if (record === '') continue
    if (record.startsWith(ANCHOR_RECORD)) {
      isAnchor = record.slice(ANCHOR_RECORD.length) === '1'
      continue
    }
    const split = record.indexOf('=')
    if (split > 0) exports[record.slice(0, split)] = record.slice(split + 1)
  }

  if (isAnchor === undefined)
    throw new Error('the probe printed no anchor record')

  return { exports, isAnchor }
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

/**
 * Runs `stage_setup` inside the tree with every stream inherited, so a scenario
 * prompting through `select_or_route_scenario` still reaches a terminal and its
 * narration lands in order with the harness's own.
 */
export function stageScenario(file: string, env: NodeJS.ProcessEnv): number {
  const result = spawnSync('bash', [HOOK_SCRIPT, 'stage', file], {
    env,
    stdio: 'inherit',
  })

  return result.status ?? 1
}
