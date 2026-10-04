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
  /** What the pull request writes, null when its diff could not be read. */
  paths: null | string[]
  resp: number
  stale: Staleness
  staleFiles: string[]
  ui: string
  unmatchedCount: number
  unmatchedHeading: string
}

/**
 * Whether the base moved under a path the pull request writes since the commit
 * it branched from. `unknown` is a written set this run could not read, which
 * must never pass for `fresh`.
 */
export type Staleness = 'fresh' | 'stale' | 'unknown'

/** One baseline line, kept as the strings it was written with. */
export interface Baseline {
  head: string
  merges: string
  number: string
  /** Open pull requests this one conflicts with, comma-separated, or `none`. */
  overlaps: string
  prior: string
  resp: string
  stale: string
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

/** Takes the first ten fields and ignores the rest, so a short or padded line still reads. */
export const parseBaseline = (line: string): Baseline => {
  const fields = line.split(' ')

  return {
    head: fields[1] ?? '',
    merges: fields[4] ?? '',
    number: fields[0] ?? '',
    overlaps: fields[9] ?? '',
    prior: fields[2] ?? '',
    resp: fields[3] ?? '',
    stale: fields[8] ?? '',
    state: fields[5] ?? '',
    ui: fields[7] ?? '',
    unmatched: fields[6] ?? '',
  }
}

/**
 * New fields append at the end, so every positional read of an older line still
 * lands. A field an older line never carried stays empty and is not written
 * back as a trailing space.
 */
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
    entry.stale,
    entry.overlaps,
  ]
    .join(' ')
    .trimEnd()

const short = (head: string): string => head.slice(0, 7)

const listFiles = (files: string[]): string =>
  files.length > 3
    ? `${files.slice(0, 3).join(', ')}, +${files.length - 3} more`
    : files.join(', ')

/**
 * A conflict already sends the branch to its owner for a rebase, so a pull
 * request reading both reports the conflict alone and earns one handback.
 */
const staleLine = (row: Row, base: string): string[] =>
  row.stale === 'stale' && row.merges !== 'conflict'
    ? [
        `STALE     #${row.number} ${base} changed ${row.staleFiles.length} file(s) it writes since its base: ${listFiles(row.staleFiles)}`,
      ]
    : []

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
    overlaps: 'none',
    prior: row.prior,
    resp: String(row.resp),
    stale: row.stale,
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

  return {
    baseline,
    isChanged: true,
    lines: [line, ...staleLine(row, context.base)],
  }
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

  // Staleness arrives the same way, and reports on its transition so a branch
  // left behind across several runs earns one handback rather than one a run.
  if (old.stale !== 'stale') lines.push(...staleLine(row, context.base))

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
    overlaps: old.overlaps,
    prior: row.prior,
    resp: String(row.resp),
    stale: row.stale,
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

/**
 * One JSON object per line, which is what `.[] | <projection> | @json` prints
 * across every page. The projection keeps stdout to the fields the mappers
 * read, since a whole REST row carries user objects and links and a long thread
 * could overrun the spawn buffer and read as unreadable. A failed read and a
 * line that does not parse both return null, so neither reads as a thread with
 * nothing on it.
 */
const readRows = (
  path: string,
  fields: string,
): null | Record<string, unknown>[] => {
  const read = run('gh', [
    'api',
    '--paginate',
    `repos/{owner}/{repo}/${path}`,
    '--jq',
    `.[] | {${fields}} | @json`,
  ])
  if (!read.isOk) return null

  const rows: Record<string, unknown>[] = []
  for (const line of read.stdout.split('\n')) {
    if (line.trim() === '') continue
    const row = parseJson(line)
    if (typeof row !== 'object' || row === null) return null
    rows.push(row as Record<string, unknown>)
  }

  return rows
}

const text = (value: unknown): null | string =>
  typeof value === 'string' ? value : null

/**
 * The REST rows carry snake_case names, mapped onto the camelCase shape the
 * classifiers read. `commit_id` becomes `commit.oid`. A pending review has no
 * `submitted_at`, which maps to null.
 */
export const toReview = (row: Record<string, unknown>): Review => ({
  body: text(row.body),
  commit: { oid: text(row.commit_id) },
  submittedAt: text(row.submitted_at),
})

export const toComment = (row: Record<string, unknown>): Comment => ({
  body: text(row.body),
  createdAt: text(row.created_at),
})

/**
 * Two reads feed one payload, so either failing makes the pull request
 * unreadable rather than a thread missing half its rows.
 */
const readPayload = (number: string): null | Payload => {
  const reviews = readRows(
    `pulls/${number}/reviews?per_page=100`,
    'body, commit_id, submitted_at',
  )
  const comments = readRows(
    `issues/${number}/comments?per_page=100`,
    'body, created_at',
  )
  if (reviews === null || comments === null) return null

  return { comments: comments.map(toComment), reviews: reviews.map(toReview) }
}

type Snapshot = { baseline: Baseline } | { row: Row }

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

const readHead = (number: string): string => {
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

  if (typeof tip === 'string' && tip !== '') return tip

  const pull = run('gh', [
    'api',
    `repos/{owner}/{repo}/pulls/${number}`,
    '--jq',
    '.head.sha',
  ])

  return pull.isOk ? pull.stdout.trim() : ''
}

/**
 * The pull read's `mergeable_state` reports unknown until GitHub finishes
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

interface Written {
  forkPoint: string
  paths: string[]
}

const nonEmptyLines = (output: string): string[] =>
  output.split('\n').filter((line) => line !== '')

/**
 * The paths a pull request writes, read from its own diff against the commit it
 * branched from. `--no-renames` lists both sides of a rename, since a change on
 * the base to either one is a change under the branch. A head or base that does
 * not resolve, which a fork or a deleted head leaves, reads as null.
 */
const readWritten = (head: string, ref: string): null | Written => {
  const forkPoint = run('git', ['merge-base', ref, head])
  if (!forkPoint.isOk) return null
  const point = forkPoint.stdout.trim()
  const diff = run('git', ['diff', '--name-only', '--no-renames', point, head])
  if (!diff.isOk) return null

  return { forkPoint: point, paths: nonEmptyLines(diff.stdout) }
}

/**
 * Re-testing after every merge to the base is a merge queue's cost without its
 * batching, so only a change to a path the branch writes makes it stale. The
 * net diff rather than the log is read, so a change the base made and then
 * reverted moves nothing.
 */
const readStale = (
  written: null | Written,
  ref: string,
): { files: string[]; stale: Staleness } => {
  if (written === null) return { files: [], stale: 'unknown' }
  if (written.paths.length === 0) return { files: [], stale: 'fresh' }

  const moved = run('git', [
    '--literal-pathspecs',
    'diff',
    '--name-only',
    '--no-renames',
    written.forkPoint,
    ref,
    '--',
    ...written.paths,
  ])
  if (!moved.isOk) return { files: [], stale: 'unknown' }

  const files = nonEmptyLines(moved.stdout)

  return { files, stale: files.length > 0 ? 'stale' : 'fresh' }
}

export interface Overlap {
  files: string[]
  pair: readonly [string, string]
}

/**
 * Pairwise merge-tree grows with the square of open pull requests, so only a
 * pair sharing a written path is tested. Each pair comes lower number first,
 * which fixes the order its line and its baseline entry are read in.
 */
export const sharedPairs = (rows: Row[]): [Row, Row][] => {
  const readable = rows
    .filter((row) => row.paths !== null && row.paths.length > 0)
    .toSorted((a, b) => Number(a.number) - Number(b.number))
  const pairs: [Row, Row][] = []
  for (const [index, first] of readable.entries()) {
    const written = new Set(first.paths)
    for (const second of readable.slice(index + 1)) {
      if ((second.paths ?? []).some((path) => written.has(path))) {
        pairs.push([first, second])
      }
    }
  }

  return pairs
}

const partnersOf = (entry: Baseline | undefined): string[] =>
  entry === undefined || entry.overlaps === '' || entry.overlaps === 'none'
    ? []
    : entry.overlaps.split(',')

/**
 * A partner this run could not read keeps its place, so a pull request that
 * drops out of one run and returns does not report the same pair twice.
 */
export const overlapPartners = (
  number: string,
  overlaps: Overlap[],
  old: Baseline | undefined,
  carried: Set<string>,
): string => {
  const partners = new Set(
    overlaps.flatMap(({ pair: [first, second] }) =>
      first === number ? [second] : second === number ? [first] : [],
    ),
  )
  for (const partner of partnersOf(old)) {
    if (carried.has(partner)) partners.add(partner)
  }
  const sorted = [...partners].toSorted((a, b) => Number(a) - Number(b))

  return sorted.length === 0 ? 'none' : sorted.join(',')
}

/** A pair reports once, read off the lower-numbered side's baseline entry. */
export const overlapLines = (
  overlaps: Overlap[],
  known: Map<string, Baseline>,
): string[] =>
  overlaps
    .filter(
      ({ pair: [first, second] }) =>
        !partnersOf(known.get(first)).includes(second),
    )
    .map(
      ({ files, pair: [first, second] }) =>
        `OVERLAP   #${first} #${second} conflict on ${listFiles(files)}`,
    )

/**
 * Two pull request heads merged against each other, which is the merge the
 * second to land will have to make. merge-tree exits 1 on a conflict and
 * prints the tree then one conflicted path a line. Any other failure prints no
 * tree, and reads as null beside a clean merge, since neither names a file.
 */
const readOverlap = (first: string, second: string): null | string[] => {
  const merged = run('git', [
    'merge-tree',
    '--write-tree',
    '--name-only',
    '--no-messages',
    first,
    second,
  ])
  if (merged.isOk) return null
  const lines = nonEmptyLines(merged.stdout)
  if (lines.length < 2) return null

  return [...new Set(lines.slice(1))]
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
  const merges = readMerges(number, head, ref)
  const written = merges === 'unknown' ? null : readWritten(head, ref)
  const stale = readStale(written, ref)

  return {
    age: scope.age,
    head,
    heading: scope.state,
    merges,
    number,
    passAt: scope.readAt,
    paths: written?.paths ?? null,
    prior: scope.commit,
    replyAt: replies.newestAt,
    resp: replies.count,
    stale: stale.stale,
    staleFiles: stale.files,
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
    'api',
    '--paginate',
    'repos/{owner}/{repo}/pulls?state=open&per_page=100',
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
    // A read that failed and a pull request with no reviews both arrive as an
    // empty result, so each read returns null on failure and the payload gives
    // the failure a single place to surface.
    const payload = readPayload(number)
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

    if (payload === null) {
      unreadable('could not be read')
      continue
    }

    const head = readHead(number)
    if (head === '') {
      unreadable('returned no head')
      continue
    }

    snapshots.push({ row: buildRow(number, payload, head, ref) })
  }

  const rows = snapshots.flatMap((snapshot) =>
    'row' in snapshot ? [snapshot.row] : [],
  )
  const carried = new Set(
    snapshots.flatMap((snapshot) =>
      'baseline' in snapshot ? [snapshot.baseline.number] : [],
    ),
  )
  const overlaps = sharedPairs(rows).flatMap(([first, second]) => {
    const files = readOverlap(first.head, second.head)

    return files === null
      ? []
      : [{ files, pair: [first.number, second.number] as const }]
  })

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
    const old = known.get(row.number)
    const result = classify(row, old, {
      base,
      countSince: countSince(row.number),
    })
    for (const line of result.lines) console.log(line)
    if (result.isChanged) isChanged = true
    final.push(
      formatBaseline({
        ...result.baseline,
        overlaps: overlapPartners(row.number, overlaps, old, carried),
      }),
    )
  }

  for (const line of overlapLines(overlaps, known)) {
    console.log(line)
    isChanged = true
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
