import type { MainPull } from '@/git/worktree'
import { advisoryOf, type BaseReading, type ChecksGate } from '@/pr/lift'
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
  | 'standing-stale'
  | 'standing-conflict'
  | 'standing-unknown'
  | 'head-moved'
  | 'not-mergeable'
  | 'gh-failed'
  | 'no-pull'

export interface MergePull {
  readonly isOpen: boolean
  readonly isDraft: boolean
  readonly title: string
  readonly body: string
  /** The head the merge is pinned to, so a push after the read refuses. */
  readonly head: string
  /** The head branch name, which a bot pull request is recognized by. */
  readonly branch: string
  /** The base branch name, which the standing is read against. */
  readonly base: string
  /** Whether the author is a bot account, which a release pull request's is not. */
  readonly isBotAuthor: boolean
  /** The number GitHub answered for, which the squash subject carries. */
  readonly number: number
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
  /** `absent` when GitHub answered 404, which no retry changes. */
  readPull(): Promise<MergePull | 'absent' | undefined>
  readChecks(head: string): Promise<ChecksGate | undefined>
  /** The lift's own standing read, so the two verbs never disagree about one head. */
  readStanding(head: string, base: string): Promise<BaseReading>
  putMerge(request: MergeRequest): Promise<MergeOutcome>
  /** Runs only after a merge landed, so its outcome never decides the merge's. */
  pullMain(): Promise<MainPull>
}

export interface MergeOptions {
  readonly number: number
  readonly isDryRun: boolean
  /** Defaults to true, so a merge leaves the main worktree current. */
  readonly isPull?: boolean
}

/** What happened to the local main worktree after a merge. */
export type MergePullRecord =
  | MainPull
  | { readonly outcome: 'skipped'; readonly reason: 'no-pull' }

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
  /** The written or stamped paths the base changed since the fork point, present only on `standing-stale`. */
  readonly moved?: readonly string[]
  /** The bot a stale pull request comes from, so the refusal can name who refreshes the branch. Present only on `standing-stale`. */
  readonly bot?: BotKind
  /** The fast-forward of the main worktree, present only on a merge. */
  readonly pull?: MergePullRecord
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
  message: {
    title?: string
    description?: string
    moved?: readonly string[]
    bot?: BotKind
  } = {},
): MergeRecord {
  return { reason, isOk: false, number, ...message }
}

/**
 * Squash-merges one ready pull request with a message carrying only the change.
 * Every refusal is read before the one write, which pins `sha` to the head it read. It re-reads the lift's standing
 * after the checks, since a sibling merged after the lift can leave the head stale, and failing CI makes no fetch.
 */
export async function merge(
  api: MergeApi,
  opts: MergeOptions,
): Promise<MergeRecord> {
  const { number } = opts

  const pull = await api.readPull()
  // A read answering for another number would put that number in the subject.
  if (pull === 'absent') return refused('no-pull', number)
  if (pull === undefined || pull.number !== number) {
    return refused('gh-failed', number)
  }
  if (!pull.isOpen) return refused('pull-closed', number)
  if (pull.isDraft) return refused('pull-draft', number)

  const title = mergeTitle(pull.title, pull.number)
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

  const base = await api.readStanding(pull.head, pull.base)
  if (base.standing !== 'fresh') {
    return refused(`standing-${base.standing}`, number, {
      ...message,
      ...(base.moved === undefined ? {} : { moved: base.moved }),
      ...(base.standing === 'stale' && bot !== undefined ? { bot } : {}),
    })
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
    const pull: MergePullRecord =
      opts.isPull === false
        ? { outcome: 'skipped', reason: 'no-pull' }
        : await api.pullMain()
    return {
      reason: 'merged',
      isOk: true,
      number,
      ...message,
      sha: outcome.sha,
      ...advisoryOf(checks),
      pull,
    }
  }
  return refused(
    outcome.kind === 'failed' ? 'gh-failed' : outcome.kind,
    number,
    message,
  )
}
