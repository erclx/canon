import type { ChecksGate } from '@/pr/lift'
import { readSection } from '@/pr/paths'
import { UI_PASS_MARKER } from '@/pr/tick'

/** Why the verb did not merge, in the order the refusals are read. */
export type MergeRefusal =
  | 'pull-closed'
  | 'pull-draft'
  | 'missing-summary'
  | 'missing-key-changes'
  | 'ci-failing'
  | 'ci-conflicted'
  | 'ci-pending'
  | 'head-moved'
  | 'not-mergeable'
  | 'gh-failed'

export interface MergePull {
  readonly isOpen: boolean
  readonly isDraft: boolean
  readonly title: string
  readonly body: string
  /** The head the merge is pinned to, so a push after the read refuses. */
  readonly head: string
}

export interface MergeRequest {
  readonly title: string
  readonly description: string
  readonly sha: string
}

/** What the merge endpoint answered, with 409 and 405 told apart from a merge. */
export type MergeOutcome =
  | { readonly kind: 'merged'; readonly sha: string }
  | { readonly kind: 'head-moved' }
  | { readonly kind: 'not-mergeable' }
  | { readonly kind: 'failed' }

/**
 * Everything the verb reads or writes, injected so every refusal runs without
 * a network. A read that failed returns undefined, and the verb refuses
 * `gh-failed` rather than reading absence as a pass.
 */
export interface MergeApi {
  readPull(): Promise<MergePull | undefined>
  readChecks(head: string): Promise<ChecksGate | undefined>
  putMerge(request: MergeRequest): Promise<MergeOutcome>
}

export interface MergeOptions {
  readonly number: number
  readonly isDryRun: boolean
}

export interface MergeRecord {
  readonly reason: 'merged' | 'dry-run' | MergeRefusal
  readonly isOk: boolean
  readonly number: number
  readonly title?: string
  readonly description?: string
  /** The squash commit, present only on a merge. */
  readonly sha?: string
}

export type Composed =
  | { readonly kind: 'composed'; readonly description: string }
  | {
      readonly kind: 'refused'
      readonly reason: 'missing-summary' | 'missing-key-changes'
    }

/** A section's text with the UI pass line dropped, or undefined when nothing is left. */
function keptSection(body: string, title: string): string | undefined {
  const text = readSection(body, title)
    ?.split('\n')
    .filter((line) => !line.includes(UI_PASS_MARKER))
    .join('\n')
    .trim()
  return text === undefined || text === ''
    ? undefined
    : `## ${title}\n\n${text}`
}

/**
 * The squash description: Summary, Key changes, and Technical context, in that
 * order, under their headings. Testing, the reviewer requests, and the UI pass
 * line describe the review rather than the change, so none reaches the trunk.
 * Technical context is optional, and an empty one leaves no bare heading.
 */
export function composeDescription(body: string): Composed {
  const summary = keptSection(body, 'Summary')
  if (summary === undefined)
    return { kind: 'refused', reason: 'missing-summary' }
  const keyChanges = keptSection(body, 'Key changes')
  if (keyChanges === undefined) {
    return { kind: 'refused', reason: 'missing-key-changes' }
  }
  const context = keptSection(body, 'Technical context')
  return {
    kind: 'composed',
    description: [summary, keyChanges, context]
      .filter((block) => block !== undefined)
      .join('\n\n'),
  }
}

/** The suffix the web merge adds and the trunk log carries. */
export function mergeTitle(title: string, number: number): string {
  return `${title} (#${number})`
}

function refused(
  reason: MergeRefusal,
  number: number,
  message: { title?: string; description?: string } = {},
): MergeRecord {
  return { reason, isOk: false, number, ...message }
}

/**
 * Squash-merges one ready pull request with a message carrying only the
 * change. Every refusal is read before the one write, and the write sends the
 * head it read as `sha`, so GitHub refuses rather than merging a commit pushed
 * after the checks were read. The verb reads the draft flag and not the review
 * comments, since a ready pull request already passed the lift's gates.
 */
export async function merge(
  api: MergeApi,
  opts: MergeOptions,
): Promise<MergeRecord> {
  const { number } = opts

  const pull = await api.readPull()
  if (pull === undefined) return refused('gh-failed', number)
  if (!pull.isOpen) return refused('pull-closed', number)
  if (pull.isDraft) return refused('pull-draft', number)

  const title = mergeTitle(pull.title, number)
  const composed = composeDescription(pull.body)
  if (composed.kind === 'refused') {
    return refused(composed.reason, number, { title })
  }
  const message = { title, description: composed.description }

  const checks = await api.readChecks(pull.head)
  if (checks === undefined) return refused('gh-failed', number, message)
  if (checks.state === 'failing') return refused('ci-failing', number, message)
  if (checks.state !== 'passing') {
    return refused(
      checks.isConflicted ? 'ci-conflicted' : 'ci-pending',
      number,
      message,
    )
  }

  if (opts.isDryRun)
    return { reason: 'dry-run', isOk: true, number, ...message }

  const outcome = await api.putMerge({ ...message, sha: pull.head })
  if (outcome.kind === 'merged') {
    return {
      reason: 'merged',
      isOk: true,
      number,
      ...message,
      sha: outcome.sha,
    }
  }
  return refused(
    outcome.kind === 'failed' ? 'gh-failed' : outcome.kind,
    number,
    message,
  )
}
