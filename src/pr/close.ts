import { scanPhaseLabels } from '@/labels/phase'
import { BAN_SETS } from '@/markdown/bans'
import { type DensityFinding, densityFindings } from '@/markdown/density'
import { bodyLines, scanBans } from '@/markdown/scan'

/** Why the verb did not close, in the order the refusals are read. */
export type CloseRefusal =
  | 'no-reason'
  | 'reason-unpublishable'
  | 'gh-failed'
  | 'pull-closed'
  | 'head-mismatch'
  | 'comment-failed'
  | 'close-failed'

export interface ClosePull {
  readonly isOpen: boolean
  /** The head branch name, which the caller's expected head is checked against. */
  readonly branch: string
  /** Whether the head lives in another repository, whose branch this one cannot delete. */
  readonly isFork: boolean
}

/**
 * Everything the verb reads or writes, injected so every refusal runs without
 * a network. A read or write that failed returns undefined or false, never a
 * guess.
 */
export interface CloseApi {
  readPull(): Promise<ClosePull | undefined>
  /** Posts the reason and answers the comment's URL. */
  postComment(body: string): Promise<string | undefined>
  patchClosed(): Promise<boolean>
  deleteBranch(branch: string): Promise<boolean>
}

export interface CloseOptions {
  readonly number: number
  readonly reason: string
  /** The head branch the caller means, so a mistyped number closes nothing. */
  readonly head: string
  readonly isKeepBranch: boolean
}

/** What the reason carries that a reader on the remote cannot use. */
export interface ReasonFindings {
  readonly isClean: boolean
  readonly bannedCharacters: readonly string[]
  readonly phaseLabels: readonly string[]
  readonly boardReferences: readonly string[]
  readonly sessionLinks: readonly string[]
  readonly density: readonly DensityFinding[]
}

/** What happened to the head branch once the pull request closed. */
export type BranchOutcome = 'deleted' | 'kept' | 'fork' | 'delete-failed'

export interface CloseRecord {
  readonly reason: 'closed' | CloseRefusal
  readonly isOk: boolean
  readonly number: number
  readonly commentUrl?: string
  readonly branch?: BranchOutcome
  readonly findings?: ReasonFindings
}

/**
 * Runs the checks `canon labels scan` runs on a pull request body, plus
 * density measured on the reason itself.
 *
 * The scan's own post density reads a body only when it opens on a known
 * post heading, and a closing comment carries none, so an overloaded reason
 * would pass it unmeasured.
 */
export function checkReason(reason: string): ReasonFindings {
  const lines = bodyLines(reason)
  const bannedCharacters = scanBans(lines, BAN_SETS).map(
    (finding) => finding.term,
  )
  const { phaseLabels, boardReferences, sessionLinks } = scanPhaseLabels({
    title: '',
    body: reason,
    headRefName: '',
  })
  const density = densityFindings(lines)

  return {
    isClean:
      bannedCharacters.length === 0 &&
      phaseLabels.length === 0 &&
      boardReferences.length === 0 &&
      sessionLinks.length === 0 &&
      density.length === 0,
    bannedCharacters,
    phaseLabels,
    boardReferences,
    sessionLinks,
    density,
  }
}

function refused(
  reason: CloseRefusal,
  number: number,
  extra: Partial<CloseRecord> = {},
): CloseRecord {
  return { reason, isOk: false, number, ...extra }
}

/**
 * Closes one pull request unmerged with its reason posted first.
 *
 * The comment lands before the close, so a failure between the two leaves a
 * comment on an open pull request rather than a closed one carrying no
 * reason, which is the defect this verb exists to remove. The branch delete
 * runs last and never fails the close, since the pull request is already
 * closed with its reason by then.
 */
export async function close(
  api: CloseApi,
  opts: CloseOptions,
): Promise<CloseRecord> {
  const { number } = opts
  const reason = opts.reason.trim()

  if (reason === '') return refused('no-reason', number)
  const findings = checkReason(reason)
  if (!findings.isClean) {
    return refused('reason-unpublishable', number, { findings })
  }

  const pull = await api.readPull()
  if (pull === undefined) return refused('gh-failed', number)
  if (!pull.isOpen) return refused('pull-closed', number)
  if (pull.branch !== opts.head) return refused('head-mismatch', number)

  const commentUrl = await api.postComment(reason)
  if (commentUrl === undefined) return refused('comment-failed', number)

  if (!(await api.patchClosed())) {
    return refused('close-failed', number, { commentUrl })
  }

  let branch: BranchOutcome
  if (opts.isKeepBranch) branch = 'kept'
  else if (pull.isFork) branch = 'fork'
  else {
    branch = (await api.deleteBranch(pull.branch)) ? 'deleted' : 'delete-failed'
  }

  return { reason: 'closed', isOk: true, number, commentUrl, branch }
}
