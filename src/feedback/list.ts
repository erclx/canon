import {
  issueListFailureMessage,
  type IssueFailure,
  type IssueFailureReason,
  type IssueList,
} from '@/feedback/github-format'
import { isWithinOwnCheckout } from '@/roots/project'

/**
 * Where a caller's feedback goes. A session in the toolkit's own checkout files
 * on its board, and any other project files on the public queue.
 */
export type FeedbackRoute = 'board' | 'issues'

export function feedbackRoute(
  root: string,
  own: boolean = isWithinOwnCheckout(root),
): FeedbackRoute {
  return own ? 'board' : 'issues'
}

export interface ListRefusal {
  readonly ok: false
  readonly route: FeedbackRoute
  readonly reason: IssueFailureReason
  readonly message: string
}

export interface ListRead extends IssueList {
  readonly route: FeedbackRoute
}

export type ListRecord = ListRead | ListRefusal

/**
 * The record `session-retro` branches on. A refusal carries its reason, so the
 * caller says the match did not run rather than reading an empty queue.
 */
export function listRecord(
  result: IssueList | IssueFailure,
  route: FeedbackRoute,
): ListRecord {
  if (result.ok) return { ok: true, route, issues: result.issues }
  return {
    ok: false,
    route,
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
