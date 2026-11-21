import { join } from 'node:path'
import { execa } from 'execa'

export interface CliRunOptions {
  /** Closes the child's stdin, which makes it headless. Defaults to false. */
  readonly nonInteractive?: boolean
  /** Defaults to `inherit`, so a child prompt still reaches the operator. */
  readonly stdin?: 'ignore' | 'inherit'
}

export function cliPath(root: string): string {
  return join(root, 'src', 'cli.ts')
}

/**
 * Spawns a `canon` subcommand as its own process, by path rather than the
 * global binary, so a linked worktree runs its own code. Returns whether the
 * child succeeded rather than throwing, since a failed domain is an outcome.
 */
export function cliRun(
  path: string,
  args: readonly string[],
  options: CliRunOptions = {},
): () => Promise<boolean> {
  return async () => {
    const stdin = options.nonInteractive
      ? 'ignore'
      : (options.stdin ?? 'inherit')

    const result = await execa('bun', [path, ...args], {
      stdio: [stdin, 'inherit', 'inherit'],
      reject: false,
    })

    return result.exitCode === 0
  }
}
