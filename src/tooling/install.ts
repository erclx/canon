import { execa } from 'execa'

export const INSTALL_TIMEOUT_MS = 120_000
const TAIL_LINES = 20

export type InstallResult =
  | { ok: true }
  | {
      ok: false
      reason: 'install-timeout' | 'install-failed'
      message: string
    }

/**
 * Runs `bun add -D` for the specs and bounds it, since a registry that accepts
 * a connection and never answers would otherwise hang the caller for good. A
 * stall or a failure comes back as a refusal naming the packages and the tail
 * of the output, never as a thrown error.
 */
export async function installDevDependencies(
  specs: readonly string[],
  cwd: string,
  timeoutMs: number = INSTALL_TIMEOUT_MS,
): Promise<InstallResult> {
  const tried = specs.join(', ')
  const result = await execa('bun', ['add', '-D', ...specs], {
    cwd,
    all: true,
    reject: false,
    stdin: 'ignore',
    timeout: timeoutMs,
  })

  if (!result.failed) return { ok: true }

  if (result.timedOut) {
    return {
      ok: false,
      reason: 'install-timeout',
      message: `Install timed out after ${Math.round(timeoutMs / 1000)}s. Tried: ${tried}`,
    }
  }

  const detail = tail(result.all) || String(result.shortMessage ?? '')
  return {
    ok: false,
    reason: 'install-failed',
    message: `Install failed. Tried: ${tried}${detail === '' ? '' : `\n${detail}`}`,
  }
}

function tail(output: unknown): string {
  if (typeof output !== 'string') return ''
  return output.replace(/\n$/, '').split('\n').slice(-TAIL_LINES).join('\n')
}
