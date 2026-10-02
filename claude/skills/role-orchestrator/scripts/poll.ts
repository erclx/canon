// Reports pull request movement since the last run. Reads only.
//
// Run as `bun poll.ts`. The pure pieces are exported so a test drives the code
// a loop runs, and `main` runs only when this file is the entry point.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { baseBranch, baseRef, mainRoot, run } from './repo'

interface Comment {
  body?: null | string
  createdAt?: null | string
}

interface Review {
  body?: null | string
  commit?: { oid?: null | string } | null
  submittedAt?: null | string
}

export interface Payload {
  comments?: Comment[]
  headRefOid?: string
  reviews?: Review[]
}

/** Four fields describing the last review pass, in the order the line carries them. */
export interface Scope {
  age: number
  commit: string
  readAt: number
  state: string
}

export interface Row {
  age: number
  head: string
  heading: string
  merges: string
  number: string
  passAt: number
  prior: string
  replyAt: number
  resp: number
  ui: string
  unmatchedCount: number
  unmatchedHeading: string
}

/** One baseline line, kept as the strings it was written with. */
export interface Baseline {
  head: string
  merges: string
  number: string
  prior: string
  resp: string
  state: string
  ui: string
  unmatched: string
}

// An open pass this old has nobody on it. The cycle it has to clear is a review
// landing and a worker pushing a follow-up, measured between ten and thirty
// minutes across a day of runs on 2026-08-14, so two hours sits about four times
// past the slowest observed and still well inside a working session. A project
// whose workers run longer than that raises it here.
export const STALE_AFTER = 7200

// The heading strings are owned elsewhere and pinned here. `review-pr` writes
// the review pair, `review-address` the reply family, `canon pr evidence` the
// evidence heading, and `review-ui` the UI pair. All of these ship separately,
// so a heading added in one of them breaks a test here that no check reaches
// across. The review family reaches this file through `canon pr review-state`,
// so its two headings are pinned only for the fallback that answers a target
// whose CLI predates that verb.
const REVIEW_HEADINGS = ['## Review', '## Review closed']
const REPLY_HEADINGS = [
  '## Review response',
  '## Rebase',
  '## Post-review findings',
]
// An evidence comment answers no review, so it stays out of the reply family
// and is excluded from the unmatched filter on its own.
const KNOWN_HEADINGS = [...REVIEW_HEADINGS, ...REPLY_HEADINGS, '## Evidence']
const UI_HEADINGS = ['## UI review', '## UI review closed']
const UI_MARKER = /^<!-- review-ui: head=([0-9a-f]{7,40}) -->$/

const firstLine = (body: null | string | undefined): string =>
  (body ?? '').split('\n')[0].replace(/\r$/, '')

const toEpoch = (stamp: null | string | undefined): null | number => {
  if (stamp === null || stamp === undefined) return null
  const ms = Date.parse(stamp)

  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

const ageOf = (at: number, now: number): number => (at === 0 ? 0 : now - at)

/**
 * The count alone answers whether a reply is new to this script, which is not
 * the same question as whether it is newer than the pass it answers, so the
 * newest reply's stamp comes out of the same selection.
 */
export const replyState = (
  comments: Comment[],
): { count: number; newestAt: number } => {
  const replies = comments.filter((comment) =>
    REPLY_HEADINGS.includes(firstLine(comment.body)),
  )
  const stamps = replies
    .map((reply) => toEpoch(reply.createdAt))
    .filter((stamp): stamp is number => stamp !== null)

  return { count: replies.length, newestAt: Math.max(0, ...stamps) }
}

/**
 * A comment matching no family is the gap this filter surfaces rather than
 * absorbs: a worker inventing a new heading would otherwise reach this script
 * as silence, indistinguishable from no comment at all.
 */
export const unmatchedState = (
  comments: Comment[],
): { count: number; heading: string } => {
  const unclassified = comments
    .map((comment) => firstLine(comment.body))
    .filter((line) => line.startsWith('## ') && !KNOWN_HEADINGS.includes(line))

  return { count: unclassified.length, heading: unclassified.at(-1) ?? 'none' }
}

/**
 * Reads the verb's record. `source` is what this branches on rather than an
 * exit status, since a shell profile can wrap canon in a function that flattens
 * every refusal to zero. A refusal record carries `reason` and no `source`, and
 * yields null here, which sends the read to the fallback.
 */
export const scopeFromVerb = (record: unknown, now: number): null | Scope => {
  if (typeof record !== 'object' || record === null) return null
  const fields = record as Record<string, unknown>
  if (typeof fields.source !== 'string' || fields.source === '') return null

  const submitted = fields.submittedAt
  const at =
    submitted === null || submitted === undefined
      ? 0
      : toEpoch(String(submitted))
  if (at === null) return null

  const read = fields.readAt
  const readAt =
    read === null || read === undefined ? at : toEpoch(String(read))
  if (readAt === null) return null

  return {
    age: ageOf(at, now),
    commit: typeof fields.commit === 'string' ? fields.commit : 'none',
    readAt,
    state: typeof fields.state === 'string' ? fields.state : 'none',
  }
}

/**
 * The fallback for a target whose CLI predates the verb. It reads the
 * submission stamps, so it carries the defect the verb closes: a push landing
 * between a pass's read and its post moves the stamp onto a commit that pass
 * never opened. It does not parse the marker, since a second reader of that
 * format here is the drift the verb exists to prevent.
 */
export const scopeFallback = (payload: Payload, now: number): Scope => {
  const last = (payload.reviews ?? [])
    .filter((review) => REVIEW_HEADINGS.includes(firstLine(review.body)))
    .at(-1)
  if (last === undefined) {
    return { age: 0, commit: 'none', readAt: 0, state: 'none' }
  }

  const at = toEpoch(last.submittedAt) ?? 0

  return {
    age: ageOf(at, now),
    commit: last.commit?.oid ?? 'none',
    readAt: at,
    state: firstLine(last.body) === '## Review' ? 'open' : 'closed',
  }
}

/**
 * The UI family is posted as a pull request review, so it is read off
 * `reviews`. The newest UI heading decides the state, and the head it covered
 * comes from the marker on the body's last line, since the submission stamp
 * moves onto a commit pushed while the pass drove. A marker may name a short
 * sha, so coverage is a prefix match.
 */
export const uiState = (payload: Payload, head: string): string => {
  const last = (payload.reviews ?? [])
    .filter((review) => UI_HEADINGS.includes(firstLine(review.body)))
    .at(-1)
  if (last === undefined) return 'none'

  const heading = firstLine(last.body) === '## UI review' ? 'open' : 'closed'
  const lastLine = (last.body ?? '')
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line !== '')
    .at(-1)
  const marked = lastLine === undefined ? null : UI_MARKER.exec(lastLine)
  const commit = marked?.[1] ?? last.commit?.oid ?? 'none'
  const covered = commit !== 'none' && head.startsWith(commit)

  return `${heading}-${covered ? 'head' : 'behind'}-${commit.slice(0, 7)}`
}

/** Takes the first eight fields and ignores the rest, so a short or padded line still reads. */
export const parseBaseline = (line: string): Baseline => {
  const fields = line.split(' ')

  return {
    head: fields[1] ?? '',
    merges: fields[4] ?? '',
    number: fields[0] ?? '',
    prior: fields[2] ?? '',
    resp: fields[3] ?? '',
    state: fields[5] ?? '',
    ui: fields[7] ?? '',
    unmatched: fields[6] ?? '',
  }
}

export const formatBaseline = (entry: Baseline): string =>
  [
    entry.number,
    entry.head,
    entry.prior,
    entry.resp,
    entry.merges,
    entry.state,
    entry.unmatched,
    entry.ui,
  ].join(' ')

const short = (head: string): string => head.slice(0, 7)

export interface Classification {
  baseline: Baseline
  isChanged: boolean
  lines: string[]
}

export interface ClassifyContext {
  base: string
  /** Commits between the prior pass and the head, zero when the range does not resolve. */
  countSince: (prior: string, head: string) => number
}

/**
 * A pull request first seen here may already carry a pass, when it opened and
 * was reviewed between two runs, so it reports SEEN rather than a new pull
 * request that invites a first pass the thread already has.
 */
const classifyFirstSighting = (
  row: Row,
  context: ClassifyContext,
): Classification => {
  const baseline: Baseline = {
    head: row.head,
    merges: row.merges,
    number: row.number,
    prior: row.prior,
    resp: String(row.resp),
    state: row.heading,
    ui: row.ui,
    unmatched: String(row.unmatchedCount),
  }
  const at = short(row.head)
  let line = `OPENED    #${row.number} at ${at}, ${row.merges} against ${context.base}`
  if (row.prior === row.head) {
    line = `SEEN      #${row.number} at ${at}, first sighting, already covered by a pass`
  } else if (row.merges === 'unknown') {
    line = `OPENED    #${row.number} at ${at}`
  }

  return { baseline, isChanged: true, lines: [line] }
}

const classifyUi = (row: Row, old: Baseline): string[] => {
  if (row.ui === '' || row.ui === 'none' || row.ui === old.ui) return []

  const heading = row.ui.split('-')[0]
  const commit = row.ui.split('-').at(-1)
  if (row.ui.startsWith('open-head-')) {
    return [`UI-OPEN   #${row.number} open at ${commit}`]
  }
  if (row.ui.startsWith('closed-head-')) {
    return [`UI-CLOSED #${row.number} closed at ${commit}`]
  }

  return [
    `UI-STALE  #${row.number} ${heading} at ${commit}, behind ${short(row.head)}`,
  ]
}

/** The heading field is the one column a classification rewrites. */
export const classify = (
  row: Row,
  old: Baseline | undefined,
  context: ClassifyContext,
): Classification => {
  if (old === undefined) return classifyFirstSighting(row, context)

  const lines: string[] = []
  let state = row.heading

  // A conflict arrives from the base moving, not from the branch, so it is
  // reported on the transition rather than only when the head changes.
  if (row.merges === 'conflict' && old.merges !== 'conflict') {
    lines.push(`CONFLICT  #${row.number} no longer merges into ${context.base}`)
  }

  // A rising count is what is new here. It fires on a tracked pull request
  // only: a first sighting takes whatever already sits on the thread as its
  // baseline rather than flagging history retroactively.
  if (row.unmatchedCount > (Number.parseInt(old.unmatched, 10) || 0)) {
    lines.push(
      `UNMATCHED #${row.number} posted under '${row.unmatchedHeading}'`,
    )
  }

  // The UI pass reports on its transition, since its state moves on a post or
  // on a push and either is the moment it is owed an action.
  lines.push(...classifyUi(row, old))

  const oldResp = Number.parseInt(old.resp, 10)
  if (row.head !== old.head) {
    if (row.prior === 'none') {
      lines.push(
        `MOVED     #${row.number} -> ${short(row.head)}, never reviewed`,
      )
    } else if (row.prior === row.head) {
      // An out-of-band pass reviewed this head before the poll saw it move, so
      // the range is empty because it is covered rather than because it broke.
      lines.push(
        `SEEN      #${row.number} -> ${short(row.head)}, already covered by the last pass`,
      )
    } else {
      const since = context.countSince(row.prior, row.head)
      lines.push(
        since > 0
          ? `MOVED     #${row.number} -> ${short(row.head)}, ${since} commit(s) since your last pass`
          : `MOVED     #${row.number} -> ${short(row.head)}, range unresolved, likely force-pushed`,
      )
    }
  } else if (
    row.resp > oldResp &&
    (row.passAt === 0 || row.replyAt > row.passAt)
  ) {
    // The count says the reply is new to this script and the stamp says it is
    // newer than the pass, and both are needed. A worker answers a finding and
    // the reviewing session closes out seconds later, so the count alone
    // reports an answered thread on the next run. A pull request with no pass
    // reads as stamp zero and reports. The gate sits in the condition so a
    // suppressed reply falls through to STALLED below.
    lines.push(`RESPONSE  #${row.number} answered with no new commit`)
  } else if (
    row.heading === 'open' &&
    old.state !== 'reported' &&
    row.prior === row.head &&
    row.age >= STALE_AFTER
  ) {
    // The last pass is open, it covers the head so no commit followed it, and
    // no reply came either. Any two of these describe an ordinary review
    // waiting on a worker, so the age carries the third. STALLED reports a
    // standing condition, so the written marker keeps it from firing on every
    // later run.
    lines.push(
      `STALLED   #${row.number} open at ${short(row.head)}, no commit or reply in ${Math.floor(row.age / 3600)}h`,
    )
    state = 'reported'
  } else if (row.heading === 'open' && old.state === 'reported') {
    // Carry the marker rather than the freshly derived heading, or the state
    // re-enters next run and STALLED oscillates instead of reporting once.
    state = 'reported'
  }

  const baseline: Baseline = {
    head: row.head,
    merges: row.merges,
    number: row.number,
    prior: row.prior,
    resp: String(row.resp),
    state,
    ui: row.ui === '' ? old.ui : row.ui,
    unmatched: String(row.unmatchedCount),
  }

  return { baseline, isChanged: lines.length > 0, lines }
}

/**
 * A pull request this run could not read keeps the line it had, so the GONE
 * sweep does not read the gap as a merge. Its heading is blanked to a value no
 * branch matches unless it already reads `reported`, since echoing it intact
 * would classify a pull request this run never reached.
 */
export const carryForward = (old: Baseline): Baseline => ({
  ...old,
  state: old.state === 'reported' ? 'reported' : 'carried',
})

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

type Snapshot = { baseline: Baseline } | { row: Row }

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const readHead = (number: string, payload: Payload): string => {
  // The tip is the authority for the head, not the pull request object, which
  // lags the ref by up to a minute after a push. The object's head is the
  // fallback for a target on an older binary with no `pr head` verb.
  const record = parseJson(
    run('canon', ['pr', 'head', number, '--json']).stdout,
  )
  const tip =
    typeof record === 'object' && record !== null
      ? (record as Record<string, unknown>).tip
      : undefined

  return typeof tip === 'string' && tip !== ''
    ? tip
    : (payload.headRefOid ?? '')
}

/**
 * `gh pr view --json mergeable` reports UNKNOWN until GitHub finishes
 * computing it, which is exactly when a poll asks. merge-tree answers locally
 * against the base this machine has. It exits non-zero on a ref it cannot
 * resolve as well as on a real conflict, so both sides are checked first.
 */
const readMerges = (number: string, head: string, ref: string): string => {
  run('git', ['fetch', '-q', 'origin', `pull/${number}/head`])
  if (
    !run('git', ['cat-file', '-e', `${head}^{commit}`]).isOk ||
    !run('git', ['rev-parse', '--verify', '-q', ref]).isOk
  ) {
    return 'unknown'
  }

  return run('git', ['merge-tree', '--write-tree', ref, head]).isOk
    ? 'clean'
    : 'conflict'
}

const buildRow = (
  number: string,
  payload: Payload,
  head: string,
  ref: string,
): Row => {
  const now = nowSeconds()
  const replies = replyState(payload.comments ?? [])
  const unmatched = unmatchedState(payload.comments ?? [])
  const record = parseJson(
    run('canon', ['pr', 'review-state', number, '--json']).stdout,
  )
  const scope = scopeFromVerb(record, now) ?? scopeFallback(payload, now)

  return {
    age: scope.age,
    head,
    heading: scope.state,
    merges: readMerges(number, head, ref),
    number,
    passAt: scope.readAt,
    prior: scope.commit,
    replyAt: replies.newestAt,
    resp: replies.count,
    ui: uiState(payload, head),
    unmatchedCount: unmatched.count,
    unmatchedHeading: unmatched.heading,
  }
}

const countSince =
  (number: string) =>
  (prior: string, head: string): number => {
    // The range needs both commits local, and a force-push leaves the prior one
    // unreachable, so a range that does not resolve counts as zero.
    run('git', ['fetch', '-q', 'origin', `pull/${number}/head`])
    const log = run('git', ['log', '--oneline', `${prior}..${head}`])

    return log.isOk ? log.stdout.split('\n').filter((l) => l !== '').length : 0
  }

const main = (): number => {
  const root = mainRoot()
  if (root === null) {
    console.error('poll: not a git repository, so nothing is classified')

    return 1
  }

  // The baseline is per-machine mutable state, so it stays in gitignored
  // scratch even though the script is tracked.
  const stateDir = join(root, '.canon', 'tmp', 'pr', 'poll')
  mkdirSync(stateDir, { recursive: true })
  const statePath = join(stateDir, 'baseline.txt')
  appendFileSync(statePath, '')

  const ref = baseRef()
  const base = baseBranch(ref)
  const known = new Map<string, Baseline>()
  const previous = readFileSync(statePath, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map(parseBaseline)
  for (const entry of previous) {
    if (!known.has(entry.number)) known.set(entry.number, entry)
  }

  run('git', ['fetch', '-q', 'origin', base])

  // A failed list reads as no open pull requests, which reports every tracked
  // one as GONE. That is a louder wrong answer than the one this script was
  // fixed for, so the run aborts rather than classify on it.
  const listed = run('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'number',
    '--jq',
    '.[].number',
  ])
  if (!listed.isOk) {
    console.error('poll: the open pull request list could not be read')
    console.error(
      'poll: nothing is classified this run and the baseline is unchanged',
    )

    return 1
  }

  const snapshots: Snapshot[] = []
  for (const number of listed.stdout.split(/\s+/).filter((n) => n !== '')) {
    // A query that failed and a pull request with no reviews both arrive as
    // an empty result, so one query per pull request gives the failure a
    // single place to surface.
    const view = run('gh', [
      'pr',
      'view',
      number,
      '--json',
      'headRefOid,reviews,comments',
    ])
    const payload = view.isOk
      ? (parseJson(view.stdout) as Payload | null)
      : null
    const old = known.get(number)
    const unreadable = (reason: string): void => {
      if (old === undefined) {
        console.error(
          `poll: #${number} ${reason}, and it has no last known state, so it goes unclassified`,
        )

        return
      }
      console.error(
        `poll: #${number} ${reason}, so it keeps its last known state and goes unclassified`,
      )
      snapshots.push({ baseline: carryForward(old) })
    }

    if (payload === null || typeof payload !== 'object') {
      unreadable('could not be read')
      continue
    }

    const head = readHead(number, payload)
    if (head === '') {
      unreadable('returned no head')
      continue
    }

    snapshots.push({ row: buildRow(number, payload, head, ref) })
  }

  let isChanged = false
  const final: string[] = []
  const seen = new Set<string>()
  for (const snapshot of snapshots) {
    if ('baseline' in snapshot) {
      seen.add(snapshot.baseline.number)
      final.push(formatBaseline(snapshot.baseline))
      continue
    }

    const { row } = snapshot
    seen.add(row.number)
    const result = classify(row, known.get(row.number), {
      base,
      countSince: countSince(row.number),
    })
    for (const line of result.lines) console.log(line)
    if (result.isChanged) isChanged = true
    final.push(formatBaseline(result.baseline))
  }

  for (const entry of previous) {
    if (seen.has(entry.number)) continue
    console.log(`GONE      #${entry.number} merged or closed`)
    isChanged = true
  }

  if (!isChanged) console.log('No movement.')
  writeFileSync(statePath, final.map((line) => `${line}\n`).join(''))

  return 0
}

if (import.meta.main) process.exitCode = main()
