export const SKIPPABLE_DOMAINS = ['wiki', 'governance', 'records'] as const

export type SkippableDomain = (typeof SKIPPABLE_DOMAINS)[number]

/**
 * The stack a caller gets without asking. Governance installs on every init so
 * a scaffolded project arrives with the rules that route it, and
 * `--skip governance` is the one spelling for declining.
 */
export const DEFAULT_STACK = 'base'

export interface SkipPlan {
  readonly skipped: ReadonlySet<SkippableDomain>
  /** Values that named nothing skippable. Warned about, never fatal. */
  readonly unknown: readonly string[]
}

export type PreviewLevel = 'info' | 'warn'

export interface PreviewLine {
  readonly level: PreviewLevel
  readonly text: string
}

export interface InitPlan {
  readonly preview: readonly PreviewLine[]
  readonly total: number
}

export interface InitFlags {
  readonly stack?: string
  readonly add?: string
  readonly skip: SkipPlan
}

/**
 * Resolves the stack the run will install. An empty `--stack` reads as absent
 * rather than as a way to decline, so the flag carries a real name or nothing
 * and `--skip governance` stays the only spelling for opting out.
 */
export function resolveStack(stack: string | undefined): string {
  return stack === undefined || stack === '' ? DEFAULT_STACK : stack
}

/**
 * Reads the `--skip` list. An unrecognized value is reported and dropped rather
 * than aborting, because the flag names optional domains and a typo should not
 * cost the operator the whole init.
 */
export function parseSkip(csv: string | undefined): SkipPlan {
  const skipped = new Set<SkippableDomain>()
  const unknown: string[] = []

  for (const raw of (csv ?? '').split(',')) {
    const item = raw.trim()
    if (item === '') continue

    if (isSkippable(item)) skipped.add(item)
    else unknown.push(item)
  }

  return { skipped, unknown }
}

/**
 * Builds the preview and the count from one pass, so the two cannot disagree.
 * Every `info` line is a domain that will run, which is what makes the count a
 * filter rather than a second tally kept in step by hand. A skipped domain
 * prints nothing at all and declined governance prints a warning, so neither
 * reaches the total.
 *
 * The skip drops `--add`, which names rules the caller asked for. Input
 * that goes nowhere is reported for the same reason `parseSkip` reports an
 * unrecognized value, so the warning names the flag rather than dropping it
 * without a word.
 */
export function planInit(flags: InitFlags): InitPlan {
  const preview: PreviewLine[] = [
    { level: 'info', text: 'base tooling (configs, seeds, deps, scripts)' },
    { level: 'info', text: 'claude (workflow docs, settings)' },
  ]

  const stack = resolveStack(flags.stack)

  if (flags.skip.skipped.has('governance')) {
    const detail =
      flags.add === undefined || flags.add === ''
        ? ''
        : `, --add ${flags.add} not installed`
    preview.push({ level: 'warn', text: `governance (skipped${detail})` })
  } else if (flags.add === undefined || flags.add === '') {
    preview.push({ level: 'info', text: `governance (stack: ${stack})` })
  } else {
    preview.push({
      level: 'info',
      text: `governance (stack: ${stack}, extras: ${flags.add})`,
    })
  }

  if (!flags.skip.skipped.has('wiki')) {
    preview.push({
      level: 'info',
      text: 'wiki (.claude/wiki/ with a stub index)',
    })
  }

  if (!flags.skip.skipped.has('records')) {
    preview.push({
      level: 'info',
      text: 'records (one-time backup setup notice)',
    })
  }

  const total = preview.filter((line) => line.level === 'info').length

  return { preview, total }
}

function isSkippable(value: string): value is SkippableDomain {
  return (SKIPPABLE_DOMAINS as readonly string[]).includes(value)
}
