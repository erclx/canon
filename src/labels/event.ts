import { readFileSync } from 'node:fs'

/** Why `resolveScanInput` had no title and body to hand `scanPhaseLabels`. */
export type ScanInputRefusal =
  | 'no-input'
  | 'unreadable-event'
  | 'not-a-pull-request'
  | 'unreadable-review'
  | 'conflicting-body-input'
  | 'unreadable-body-file'

export type ResolvedScanInput =
  | {
      readonly kind: 'resolved'
      readonly title: string
      readonly body: string
      readonly headRefName: string
      /** Which text was scanned, for the caller's own reporting. */
      readonly source: 'pull-request' | 'review'
    }
  | {
      readonly kind: 'refused'
      readonly reason: ScanInputRefusal
      readonly message: string
    }

export interface ScanInputOptions {
  readonly event?: string
  readonly title?: string
  readonly body?: string
  readonly bodyFile?: string
  readonly head?: string
}

/**
 * Reads a title, a body, and a head branch from explicit flags first and the
 * named event payload second, so a caller testing the wiring by hand never
 * needs a real GitHub event file on disk.
 *
 * A `pull_request_review` payload carries no title of its own, and the text a
 * reviewer wrote lives at `review.body` rather than at `pull_request.body`.
 * `payload.review` is read ahead of `payload.pull_request` so a payload
 * carrying both, which a real review event does, is never read off the
 * pull request's own title and body once a review resolved.
 */
export function resolveScanInput(opts: ScanInputOptions): ResolvedScanInput {
  let title = opts.title
  let body = opts.body
  let headRefName = opts.head
  let source: 'pull-request' | 'review' = 'pull-request'

  if (opts.bodyFile !== undefined) {
    if (body !== undefined) {
      return {
        kind: 'refused',
        reason: 'conflicting-body-input',
        message:
          '--body and --body-file cannot both be given, since only one text can be scanned.',
      }
    }

    try {
      body = readFileSync(opts.bodyFile, 'utf8')
    } catch {
      return {
        kind: 'refused',
        reason: 'unreadable-body-file',
        message: `${opts.bodyFile} could not be read, so no body was there to scan.`,
      }
    }
  }

  if (opts.event !== undefined) {
    let raw: string
    try {
      raw = readFileSync(opts.event, 'utf8')
    } catch {
      return {
        kind: 'refused',
        reason: 'unreadable-event',
        message: `${opts.event} could not be read, so no payload was there to scan.`,
      }
    }

    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      return {
        kind: 'refused',
        reason: 'unreadable-event',
        message: `${opts.event} is not valid JSON, so no payload was there to scan.`,
      }
    }

    const envelope =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : undefined
    const review = envelope?.review
    const pullRequest = envelope?.pull_request

    if (typeof review === 'object' && review !== null) {
      const reviewRecord = review as Record<string, unknown>

      if (body === undefined) {
        const rawBody = reviewRecord.body
        if (rawBody === null || rawBody === undefined) {
          body = ''
          source = 'review'
        } else if (typeof rawBody === 'string') {
          body = rawBody
          source = 'review'
        } else {
          return {
            kind: 'refused',
            reason: 'unreadable-review',
            message: `${opts.event} carries a review.body that is neither a string nor null, so no text was there to scan.`,
          }
        }
      }

      title ??= ''

      // Defense in depth for `isReleasePullRequest`. A review carries no head ref
      // of its own, so this reaches for the pull request's.
      if (typeof pullRequest === 'object' && pullRequest !== null) {
        const head = (pullRequest as Record<string, unknown>).head
        headRefName ??=
          typeof head === 'object' &&
          head !== null &&
          typeof (head as Record<string, unknown>).ref === 'string'
            ? ((head as Record<string, unknown>).ref as string)
            : undefined
      }
    } else if (typeof pullRequest === 'object' && pullRequest !== null) {
      const record = pullRequest as Record<string, unknown>
      const head = record.head
      title ??= typeof record.title === 'string' ? record.title : undefined
      body ??= typeof record.body === 'string' ? record.body : undefined
      headRefName ??=
        typeof head === 'object' &&
        head !== null &&
        typeof (head as Record<string, unknown>).ref === 'string'
          ? ((head as Record<string, unknown>).ref as string)
          : undefined
    } else {
      return {
        kind: 'refused',
        reason: 'not-a-pull-request',
        message: `${opts.event} carries no pull_request or review, so no title or body exists to scan.`,
      }
    }
  }

  // Refused only with no title and no body, so `--body` alone exercises the
  // review-style path a real review scans by hand.
  if (title === undefined && body === undefined) {
    return {
      kind: 'refused',
      reason: 'no-input',
      message:
        'No --event, --title, or --body given, so there is nothing to scan.',
    }
  }

  return {
    kind: 'resolved',
    title: title ?? '',
    body: body ?? '',
    headRefName: headRefName ?? '',
    source,
  }
}
