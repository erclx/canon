import { join } from 'node:path'
import { execa } from 'execa'

export interface CliRunOptions {
  /** Sets `CANON_NON_INTERACTIVE=1` for the child. Defaults to false. */
  readonly nonInteractive?: boolean
  /** Defaults to `inherit`, so a child prompt still reaches the operator. */
  readonly stdin?: 'ignore' | 'inherit'
}

export function cliPath(root: string): string {
  return join(root, 'src', 'cli.ts')
}

/**
 * Spawns a `canon` subcommand as its own process, by path rather than through
 * the global binary, so a linked worktree exercises its own code.
 *
 * Both callers want a separately failable child rather than an in-process call:
 * `canon init` reports each domain's outcome independently, and `canon sync`
 * relies on each domain opening its own frame. Returns whether the child
 * succeeded rather than throwing, because a failed domain is a reportable
 * outcome and not an abort.
 */
export function cliRun(
  path: string,
  args: readonly string[],
  options: CliRunOptions = {},
): () => Promise<boolean> {
  return async () => {
    const env = options.nonInteractive
      ? { ...process.env, CANON_NON_INTERACTIVE: '1' }
      : process.env

    const result = await execa('bun', [path, ...args], {
      stdio: [options.stdin ?? 'inherit', 'inherit', 'inherit'],
      env,
      reject: false,
    })

    return result.exitCode === 0
  }
}
