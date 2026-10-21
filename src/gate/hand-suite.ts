/**
 * The vitest invocation a hand-run lock decision reads.
 */
export interface VitestRun {
  /** The CLI arguments after the vitest entry, as `process.argv.slice(2)`. */
  readonly args: readonly string[]
  readonly ci: boolean
  readonly watch: boolean
  /**
   * The lock a parent gate already holds for this run, from `CANON_HELD_LOCK`.
   * A gate's own suite waiting on that lock would wait on its parent forever.
   */
  readonly heldLock: string | undefined
}

const SUBCOMMANDS = new Set(['run'])

/** `-t` and its long forms filter by test name, which scopes the run. */
function isNameFilter(arg: string): boolean {
  return (
    arg === '-t' ||
    arg.startsWith('-t=') ||
    arg === '--testNamePattern' ||
    arg.startsWith('--testNamePattern=') ||
    arg === '--test-name-pattern' ||
    arg.startsWith('--test-name-pattern=')
  )
}

/**
 * Whether a hand-run vitest invocation runs the whole suite and so queues on
 * the machine lock the gate's Tests stage holds.
 *
 * A scoped run is seconds of work, and queueing it behind a full suite costs
 * more than any collision it causes. Vitest exposes no setup-time API naming
 * the CLI filters, so any bare argument other than the subcommand reads as a
 * file filter. That includes the value of a flag spelled `--flag value`, which
 * misreads such a run as scoped. The misread skips a lock rather than queueing
 * a scoped run, which is the side to err on.
 */
export function locksHandSuite(run: VitestRun): boolean {
  if (run.ci || run.watch || run.heldLock !== undefined) return false

  const args = SUBCOMMANDS.has(run.args[0] ?? '') ? run.args.slice(1) : run.args
  return !args.some((arg) => isNameFilter(arg) || !arg.startsWith('-'))
}
