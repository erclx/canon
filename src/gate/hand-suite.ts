/**
 * Names the machine lock a gate holds while a stage's commands run, so the
 * suite it spawns knows not to wait on its own parent.
 */
export const HELD_LOCK_VARIABLE = 'CANON_HELD_LOCK'

/**
 * The vitest invocation a hand-run lock decision reads.
 */
export interface VitestRun {
  /** The CLI arguments after the vitest entry, as `process.argv.slice(2)`. */
  readonly args: readonly string[]
  readonly ci: boolean
  readonly watch: boolean
  /**
   * The lock a parent gate already holds for this run, from `HELD_LOCK_VARIABLE`.
   * A gate's own suite waiting on that lock would wait on its parent forever.
   */
  readonly heldLock: string | undefined
}

/**
 * The filter `bun run test:e2e` hands vitest and every end-to-end suite's name
 * carries. A run naming it films in a real browser, so it queues like a full
 * suite however it is scoped.
 */
export const E2E_FILTER = '.e2e.test'

/**
 * The config `bun run test:e2e` hands vitest, whose `include` holds only the
 * end-to-end suites so a path argument narrows the run rather than widening it.
 * A run naming it queues like one naming `E2E_FILTER`.
 */
export const E2E_CONFIG = 'vitest.e2e.config.ts'

const CONFIG_FLAGS = new Set(['--config', '-c'])

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

/** Whether a config path, spelled bare or with a directory, names `E2E_CONFIG`. */
function isE2eConfig(path: string): boolean {
  return path === E2E_CONFIG || path.endsWith(`/${E2E_CONFIG}`)
}

/** Whether the run loads `E2E_CONFIG`, as `--config <path>` or `--config=<path>`. */
function loadsE2eConfig(args: readonly string[]): boolean {
  return args.some((arg, index) => {
    if (CONFIG_FLAGS.has(args[index - 1] ?? '')) return isE2eConfig(arg)
    const [flag, value] = arg.split('=', 2)
    return (
      CONFIG_FLAGS.has(flag ?? '') && value !== undefined && isE2eConfig(value)
    )
  })
}

/**
 * Whether the run selects the end-to-end suites, by loading `E2E_CONFIG` or by
 * naming `E2E_FILTER` as something to run. The value of `--exclude` names what
 * to leave out, as in the gate's own scoped command, so it never counts.
 */
function selectsE2e(args: readonly string[]): boolean {
  if (loadsE2eConfig(args)) return true
  return args.some(
    (arg, index) =>
      arg.includes(E2E_FILTER) &&
      !arg.startsWith('--exclude=') &&
      args[index - 1] !== '--exclude',
  )
}

/**
 * Whether a hand-run vitest invocation runs the whole suite and so queues on
 * the machine lock the gate's Tests stage holds.
 *
 * A run loading `E2E_CONFIG` or naming `E2E_FILTER` queues too, since the suites it selects film in a
 * real browser and two of them at once contend for CPU. Any other scoped run
 * is seconds of work, and queueing it behind a full suite costs more than any
 * collision it causes. Vitest exposes no setup-time API naming
 * the CLI filters, so any bare argument other than the subcommand reads as a
 * file filter. That includes the value of a flag spelled `--flag value`, which
 * misreads such a run as scoped. The misread skips a lock rather than queueing
 * a scoped run, which is the side to err on.
 */
export function locksHandSuite(run: VitestRun): boolean {
  if (run.ci || run.watch || run.heldLock !== undefined) return false

  const args = SUBCOMMANDS.has(run.args[0] ?? '') ? run.args.slice(1) : run.args
  if (selectsE2e(args)) return true
  return !args.some((arg) => isNameFilter(arg) || !arg.startsWith('-'))
}
