import { logInfo, logStep, logWarn } from '@/cli/ui'

/**
 * A domain either runs or announces why it did not. Governance under
 * `--skip governance` is the second kind: it reports in sequence so the
 * timeline still accounts for every core domain, without counting as a failure.
 */
export type DomainStep =
  | { readonly kind: 'run'; readonly label: string; run(): Promise<boolean> }
  | { readonly kind: 'skip'; readonly label: string; readonly notice: string }

/**
 * Runs each step in order and returns the labels that failed.
 *
 * Partial failure is a first-class outcome rather than an error path. An init
 * that aborts on the first failing domain would look tidier and leave the
 * operator with no idea which of the remaining domains would have worked, so
 * the run continues and the caller reports the failures at the end.
 *
 * The sequence is deliberate. Base tooling seeds the files the later domains
 * install alongside, so these are not independent operations to batch.
 */
export async function runDomains(
  steps: readonly DomainStep[],
): Promise<string[]> {
  const failed: string[] = []

  for (const step of steps) {
    logStep(step.label)

    if (step.kind === 'skip') {
      logWarn(step.notice)
      continue
    }

    if (await step.run()) {
      logInfo('Done')
      continue
    }

    logWarn('Failed, run manually')
    failed.push(step.label)
  }

  return failed
}
