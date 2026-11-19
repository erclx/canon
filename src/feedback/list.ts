import {
  issueListFailureMessage,
  type IssueFailure,
  type IssueFailureReason,
  type IssueList,
} from '@/feedback/github-format'

export interface ListRefusal {
  readonly ok: false
  readonly reason: IssueFailureReason
  readonly message: string
}

export type ListRecord = IssueList | ListRefusal

/**
 * The record `session-retro` branches on. A refusal carries its reason, so the
 * caller says the match did not run rather than reading an empty queue.
 */
export function listRecord(result: IssueList | IssueFailure): ListRecord {
  if (result.ok) return { ok: true, issues: result.issues }
  return {
    ok: false,
    reason: result.reason,
    message: issueListFailureMessage(result),
  }
}

export interface ListFlags {
  readonly on?: string
  readonly list?: boolean
  readonly json?: boolean
}

export function listFlagProblem(flags: ListFlags): string | undefined {
  if (flags.list && flags.on !== undefined) {
    return '--list reads the queue and --on posts to it. Pass one.'
  }
  if (flags.json && !flags.list) {
    return '--json shapes the --list read only. Add --list.'
  }
  return undefined
}
