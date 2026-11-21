import { advisoryOf, type ChecksGate } from '@/pr/lift'
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
  | 'ci-stalled'
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
  /** The head branch name, which a bot pull request is recognized by. */
  readonly branch: string
  /** Whether the author is a bot account, which a release pull request's is not. */
  readonly isBotAuthor: boolean
}

export type BotKind = 'release-please' | 'dependabot'

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
  /** Failing checks the base does not require, which the merge went past. */
  readonly advisory?: readonly string[]
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
 * order. Testing, the reviewer requests, and the UI pass line describe the
 * review, so none reaches the trunk. An empty Technical context leaves no heading.
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

const RELEASE_BRANCH = 'release-please--branches--'
const RELEASE_OPENING = ':robot: I have created a release'
const RELEASE_FOOTER = 'This PR was generated with'
const DEPENDABOT_BRANCH = 'dependabot/'

/**
 * The bot a pull request comes from. The release pull request's author is the
 * operator's own account, so the head branch carries it, and a second condition
 * keeps a human pull request borrowing the branch prefix on the human path.
 */
export function botKind(
  pull: Pick<MergePull, 'branch' | 'body' | 'isBotAuthor'>,
): BotKind | undefined {
  if (
    pull.branch.startsWith(RELEASE_BRANCH) &&
    pull.body.trimStart().startsWith(RELEASE_OPENING)
  ) {
    return 'release-please'
  }
  if (pull.branch.startsWith(DEPENDABOT_BRANCH) && pull.isBotAuthor) {
    return 'dependabot'
  }
  return undefined
}

/**
 * Where a Dependabot body stops: a group body runs a table and then one
 * `Updates ` line per package, and a single-package body goes from `Bumps` to a
 * `<details>` block, so either line ends the kept text, not the commands footer.
 */
function dependabotCut(lines: readonly string[]): number {
  const cut = lines.findIndex(
    (line) =>
      line.startsWith('Updates ') || line.trim().startsWith('<details>'),
  )
  return cut >= 0 ? cut : lines.length
}

/**
 * The squash description of a bot pull request, from the bot's own body. A
 * release keeps its changelog without the robot line, dividers, and footer, and
 * Dependabot its lead and package table. A body left empty refuses `missing-summary`.
 */
export function composeBotDescription(kind: BotKind, body: string): Composed {
  const lines = body.replaceAll('\r\n', '\n').split('\n')
  const kept =
    kind === 'release-please'
      ? lines.filter((line) => {
          const text = line.trim()
          return (
            text !== '---' &&
            !text.startsWith(RELEASE_OPENING) &&
            !text.startsWith(RELEASE_FOOTER)
          )
        })
      : lines.slice(0, dependabotCut(lines))
  const description = kept.join('\n').trim()
  return description === ''
    ? { kind: 'refused', reason: 'missing-summary' }
    : { kind: 'composed', description }
}

/** The suffix the web merge adds and the trunk log carries. */
export function mergeTitle(title: string, number: number): string {
  return `${title} (#${number})`
}

/** Why a reading that is neither passing nor failing holds the merge. */
function pendingReason(checks: ChecksGate): MergeRefusal {
  if (checks.isConflicted) return 'ci-conflicted'
  if (checks.stalled !== undefined && checks.stalled.length > 0) {
    return 'ci-stalled'
  }
  return 'ci-pending'
}

function refused(
  reason: MergeRefusal,
  number: number,
  message: { title?: string; description?: string } = {},
): MergeRecord {
  return { reason, isOk: false, number, ...message }
}

/**
 * Squash-merges one ready pull request with a message carrying only the change.
 * Every refusal is read before the one write, which sends the head it read as `sha`, so GitHub
 * refuses a later push. It reads the draft flag, not review comments, since a ready pull request passed the lift's gates.
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
  const bot = botKind(pull)
  const composed =
    bot === undefined
      ? composeDescription(pull.body)
      : composeBotDescription(bot, pull.body)
  if (composed.kind === 'refused') {
    return refused(composed.reason, number, { title })
  }
  const message = { title, description: composed.description }

  const checks = await api.readChecks(pull.head)
  if (checks === undefined) return refused('gh-failed', number, message)
  if (checks.state === 'failing') return refused('ci-failing', number, message)
  if (checks.state !== 'passing') {
    return refused(pendingReason(checks), number, message)
  }

  if (opts.isDryRun) {
    return {
      reason: 'dry-run',
      isOk: true,
      number,
      ...message,
      ...advisoryOf(checks),
    }
  }

  const outcome = await api.putMerge({ ...message, sha: pull.head })
  if (outcome.kind === 'merged') {
    return {
      reason: 'merged',
      isOk: true,
      number,
      ...message,
      sha: outcome.sha,
      ...advisoryOf(checks),
    }
  }
  return refused(
    outcome.kind === 'failed' ? 'gh-failed' : outcome.kind,
    number,
    message,
  )
}
