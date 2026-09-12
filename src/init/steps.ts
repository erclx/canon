import { type InitFlags, resolveStack } from '@/init/plan'
import type { DomainStep } from '@/init/run'

/** Builds the child-process invocation for one domain. */
export type RunFactory = (args: readonly string[]) => () => Promise<boolean>

/**
 * States the same fact as `docs/target-projects.md`'s backup section in its
 * own words. Keep the two in step by hand; nothing compares them.
 */
const RECORDS_SETUP_NOTICE =
  "No private repository to push to yet. Run 'canon records push' once one exists to print the one-time setup command, or --skip records to silence this."

/**
 * Orders the domains an init installs. Base tooling seeds the files the later
 * domains install alongside, so the sequence is part of the contract rather
 * than an arbitrary listing.
 *
 * The caller supplies the run factory so the list can be read for its labels
 * and kinds without spawning anything.
 */
export function buildSteps(
  target: string,
  resolved: string,
  flags: InitFlags,
  child: RunFactory,
): DomainStep[] {
  const steps: DomainStep[] = [
    {
      kind: 'run',
      label: 'Base tooling',
      run: child(['tooling', 'sync', 'base', resolved, '--write']),
    },
    {
      kind: 'run',
      label: 'Claude workflow',
      run: child(['claude', 'init', resolved]),
    },
  ]

  const stack = resolveStack(flags.stack)

  if (flags.skip.skipped.has('governance')) {
    const recovery = govArgs(stack, flags.add, target).join(' ')
    steps.push({
      kind: 'skip',
      label: 'Governance',
      notice: `Skipped: --skip governance. Run 'canon ${recovery}' to install rules.`,
    })
  } else {
    steps.push({
      kind: 'run',
      label: 'Governance',
      run: child(govArgs(stack, flags.add, resolved)),
    })
  }

  if (!flags.skip.skipped.has('wiki')) {
    steps.push({
      kind: 'run',
      label: 'Wiki',
      run: child(['wiki', 'init', resolved]),
    })
  }

  if (!flags.skip.skipped.has('records')) {
    // `skip` here means there is nothing to run non-interactively, not that
    // the caller opted out, unlike every other push of this kind above.
    steps.push({
      kind: 'skip',
      label: 'Records backup',
      notice: RECORDS_SETUP_NOTICE,
    })
  }

  return steps
}

/**
 * Builds the `gov install` argv. The run and the recovery command a skip prints
 * come from here both, so the command a caller is told to paste installs what
 * the run would have.
 */
function govArgs(
  stack: string,
  add: string | undefined,
  path: string,
): string[] {
  const args = ['gov', 'install', stack]
  if (add !== undefined && add !== '') args.push('--add', add)
  args.push(path)

  return args
}
