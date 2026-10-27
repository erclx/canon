export interface CreateIssueOptions {
  title: string
  body: string
  labels?: string[]
}

/**
 * Why a `gh issue create` call produced no URL. The two reasons reach the
 * operator as different repairs, which is the whole reason the helper returns a
 * discriminated result rather than a nullable string: an absent binary is
 * something to install, and a failed call is something the stderr explains.
 */
export type IssueFailureReason = 'missing-binary' | 'command-failed'

export interface IssueFailure {
  readonly ok: false
  readonly reason: IssueFailureReason
  readonly detail?: string
}

export interface IssueSuccess {
  readonly ok: true
  readonly url: string
}

export type CreateIssueResult = IssueSuccess | IssueFailure

const REPO = 'erclx/canon'
const ISSUE_URL = `https://github.com/${REPO}/issues/new`

export function buildIssueArgs(opts: CreateIssueOptions): string[] {
  const args = ['issue', 'create', '--title', opts.title, '--body', opts.body]
  for (const label of opts.labels ?? []) {
    args.push('--label', label)
  }
  args.push('--repo', REPO)
  return args
}

export function buildCommentArgs(issue: number, body: string): string[] {
  return ['issue', 'comment', String(issue), '--body', body, '--repo', REPO]
}

export function buildIssueReadArgs(issue: number): string[] {
  return [
    'issue',
    'view',
    String(issue),
    '--json',
    'state,labels',
    '--repo',
    REPO,
  ]
}

export interface IssueRead {
  readonly ok: true
  readonly state: string
  readonly labels: readonly string[]
}

/**
 * Reads the `gh issue view --json state,labels` record. A record of any other
 * shape is a failed read rather than an issue with no labels, since the caller
 * refuses on a missing label and that refusal would then name the wrong cause.
 */
export function parseIssueRead(stdout: string): IssueRead | IssueFailure {
  let record: unknown
  try {
    record = JSON.parse(stdout)
  } catch {
    return {
      ok: false,
      reason: 'command-failed',
      detail: 'gh printed no JSON issue record',
    }
  }
  const { state, labels } = (record ?? {}) as {
    state?: unknown
    labels?: unknown
  }
  if (typeof state !== 'string' || !Array.isArray(labels)) {
    return {
      ok: false,
      reason: 'command-failed',
      detail: 'gh printed an issue record with no state or labels',
    }
  }
  const names = labels
    .map((label: unknown) => (label as { name?: unknown } | null)?.name)
    .filter((name): name is string => typeof name === 'string')
  return { ok: true, state, labels: names }
}

/**
 * Collapses to one line. Both callers write the detail inside a framed error or
 * a colored warning, and a newline in the middle of either breaks the frame and
 * leaves the color reset stranded after the last line. `gh` writes multi-line
 * diagnostics routinely, so this is the ordinary case rather than the edge.
 */
function oneLine(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/**
 * Pulls the operator-readable half out of whatever the spawn threw. `gh` writes
 * its own diagnosis to stderr, so that is preferred over the wrapper's message,
 * which names the exit status and nothing about the cause.
 */
export function failureDetail(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const stderr = (error as { stderr?: unknown }).stderr
    if (typeof stderr === 'string' && stderr.trim()) return oneLine(stderr)
    const short = (error as { shortMessage?: unknown }).shortMessage
    if (typeof short === 'string' && short.trim()) return oneLine(short)
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return oneLine(message)
  }
  return 'gh failed with no diagnostic on stderr'
}

/**
 * The sentence the operator reads. It sits beside the argument builder so both
 * reasons are asserted without spawning `gh`, which is the distinction the
 * nullable return left untestable.
 */
export function issueFailureMessage(failure: IssueFailure): string {
  if (failure.reason === 'missing-binary') {
    return `gh is not installed, so no issue was filed. Install gh, or file it at ${ISSUE_URL}`
  }
  return `gh could not file the issue: ${failure.detail ?? 'no diagnostic on stderr'}. File it manually at ${ISSUE_URL} instead.`
}

export function commentFailureMessage(
  failure: IssueFailure,
  issue: number,
): string {
  const target = `https://github.com/${REPO}/issues/${issue}`
  if (failure.reason === 'missing-binary') {
    return `gh is not installed, so no follow-up was posted. Install gh, or comment at ${target}`
  }
  return `gh could not post the follow-up: ${failure.detail ?? 'no diagnostic on stderr'}. Comment manually at ${target} instead.`
}
