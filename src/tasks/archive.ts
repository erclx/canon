import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { regenOne } from '@/indexes/regen'
import { isUnder } from '@/paths'
import { recordDir, recordDirs } from '@/record-root'

const TASKS = 'tasks'
const PLANS = 'plans'
const READY = 'ready'
const ARCHIVE = 'archive'
const DECLINED = 'declined'
const BACKLOG = 'backlog.md'

/**
 * Siblings that sit on the board without being tasks: the generated index, the
 * hand-maintained ordering, the unordered backlog beside it, and a handoff a
 * session wrote before the file took one name per session. `validate` reads the
 * same list, so neither verb can count a sibling as a task the other does not.
 */
export const RESERVED_STEMS = [
  'index',
  'priority',
  'backlog',
  'session',
] as const

/** The pre-compaction handoff takes one file per session, so its stems vary. */
const SESSION_MAP_PREFIX = 'session-'

export function isReservedStem(stem: string): boolean {
  const reserved: readonly string[] = RESERVED_STEMS

  return reserved.includes(stem) || stem.startsWith(SESSION_MAP_PREFIX)
}

/**
 * `bad-input` describes the command line rather than the board, which is the
 * split `record.ts` draws for the same reason. A caller naming two selectors
 * answered as `ambiguous` sends a session to repair a task citation that is
 * fine, so the three task verbs answer one mistake one way.
 */
export const ARCHIVE_REFUSALS = [
  'no-board',
  'no-match',
  'ambiguous',
  'no-outcomes',
  'open-outcomes',
  'earlier-slice',
  'pending-branch',
  'bad-input',
] as const

export type ArchiveRefusal = (typeof ARCHIVE_REFUSALS)[number]

/**
 * Kept apart from `ARCHIVE_REFUSALS` on purpose. `archive` and `decline`
 * answer different questions, shipped versus decided-against, and a shared
 * refusal set would let one archive a task that cannot yet ship or decline
 * one that already has.
 */
export const DECLINE_REFUSALS = [
  'no-board',
  'no-match',
  'ambiguous',
  'bad-input',
] as const

export type DeclineRefusal = (typeof DECLINE_REFUSALS)[number]

export type TaskSelector =
  | { readonly kind: 'stem'; readonly stem: string }
  | { readonly kind: 'pull-request'; readonly number: number }

/** A plan carried into the archive alongside the task that was its last citation. */
export interface PlanMove {
  readonly from: string
  readonly to: string
}

/** A ready folder carried into the archive alongside the plan that is its verbatim source. */
export interface ReadyMove {
  readonly from: string
  readonly to: string
}

export interface ArchiveSuccess {
  readonly ok: true
  readonly stem: string
  readonly from: string
  readonly to: string
  readonly priorityRowRemoved: boolean
  readonly indexRegenerated: boolean
  /** Every live plan the task cited that no other live task still holds, in line order. */
  readonly plans: readonly PlanMove[]
  /** Undefined when no plan moves, or when no ready folder resolves and can move. */
  readonly ready: ReadyMove | undefined
  readonly closed: number
  readonly cut: number
}

export interface ArchiveRefused {
  readonly ok: false
  readonly reason: ArchiveRefusal
  readonly message: string
  readonly detail: readonly string[]
}

export type ArchiveOutcome = ArchiveSuccess | ArchiveRefused

export interface DeclineSuccess {
  readonly ok: true
  readonly stem: string
  readonly from: string
  readonly to: string
  readonly priorityRowRemoved: boolean
  readonly backlogRowRemoved: boolean
  readonly indexRegenerated: boolean
  /** Every live plan the task cited that no other live task still holds, in line order. */
  readonly plans: readonly PlanMove[]
}

export interface DeclineRefused {
  readonly ok: false
  readonly reason: DeclineRefusal
  readonly message: string
  readonly detail: readonly string[]
}

export type DeclineOutcome = DeclineSuccess | DeclineRefused

export interface TaskOutcomes {
  readonly open: readonly string[]
  readonly closed: readonly string[]
  readonly cut: readonly string[]
}

export function tasksDir(root: string): string {
  return recordDir(root, TASKS)
}

export function archiveDir(root: string): string {
  return recordDir(root, TASKS, ARCHIVE)
}

export function declinedDir(root: string): string {
  return recordDir(root, TASKS, DECLINED)
}

export const OUTCOME_PATTERN = /^- \[([ xX])\] ?(.*)$/

/**
 * A bullet with an optional checkbox, wider than `OUTCOME_PATTERN` so a cut
 * line missing its checkbox still parses. `record.ts` positions outcomes off
 * the narrower pattern and stays that way, so a cut line with no checkbox
 * stays invisible to `canon tasks outcome` by design rather than by oversight.
 *
 * Unlike `OUTCOME_PATTERN`, this reaches a struck bullet under any heading,
 * not only `## Outcomes`, since a checkbox is what confined the narrower
 * pattern there and a cut line may carry none. No struck bullet sits outside
 * `## Outcomes` across the live board or the archive as of this change, so
 * the wider reach is not live, and a heading test is one to add if that stops
 * holding.
 */
const BULLET_PATTERN = /^- (?:\[([ xX])\] ?)?(.*)$/

/**
 * A struck outcome body, whatever its checkbox holds. The test only checks
 * the body's start, since the canonical form trails the struck text with why
 * it was cut: `- ~~<outcome>~~ <why>` leaves `<why>` outside the `~~` pair.
 */
const STRUCK_BODY_PATTERN = /^~~.+~~/

/**
 * Marks the lines sitting inside a fenced block, the fence delimiters included.
 * A checkbox in a sample a task displays is not an outcome the task claims, and
 * counting one shifts every position after it. Every reader of the outcome list
 * shares this so none of them can disagree about what the list holds.
 */
export function fenceMask(lines: readonly string[]): boolean[] {
  let inside = false

  return lines.map((line) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inside = !inside
      return true
    }
    return inside
  })
}

/**
 * Splits a task's outcome list by checkbox state, cut outcomes pulled out
 * ahead of it. The board format puts every outcome at the top level of
 * `## Outcomes`, so an anchored match is enough and no heading tracking is
 * needed.
 *
 * A struck body reads as cut whatever its checkbox holds, since a dropped box
 * and a retained one both appear in the tree and neither is the abandoned
 * work's fault: `- ~~a thing~~` carries no box and would otherwise vanish
 * from both arrays, `- [ ] ~~a thing~~` would otherwise read as open, and
 * `- [x] ~~a thing~~` would otherwise read as shipped. Testing the body
 * before the checkbox is what catches all three under one rule.
 */
export function readOutcomes(text: string): TaskOutcomes {
  const open: string[] = []
  const closed: string[] = []
  const cut: string[] = []
  const lines = text.split('\n')
  const fenced = fenceMask(lines)

  for (const [index, line] of lines.entries()) {
    if (fenced[index]) continue

    const bullet = BULLET_PATTERN.exec(line)
    if (!bullet) continue

    const [, box, rawBody] = bullet
    const body = rawBody.trim()

    if (STRUCK_BODY_PATTERN.test(body)) {
      cut.push(body)
      continue
    }

    if (box === undefined) continue

    if (box === ' ') {
      open.push(body)
    } else {
      closed.push(body)
    }
  }

  return { open, closed, cut }
}

/**
 * Reads the `Pull request:` line `git-pr` writes when a pull request opens.
 * Each number is a bare `#NNN` the way `Issue:` is, since neither is a path and
 * a full URL would write the remote into a gitignored file. A task shipped in
 * slices lists one per slice, oldest first, so the line reads as a list. A line
 * carrying anything besides that list reads as naming none, rather than as the
 * numbers that happened to parse.
 */
export function readPullRequest(text: string): readonly number[] {
  const match = /^Pull request:[ \t]*(#\d+(?:[ \t]*,[ \t]*#\d+)*)[ \t]*$/m.exec(
    text,
  )
  if (!match) return []

  return match[1].split(',').map((entry) => Number(entry.trim().slice(1)))
}

/**
 * Reads the `Pending branch:` line `canon tasks outcome` writes when a branch
 * ticks an outcome ahead of its own pull request number reaching the task.
 * `canon tasks pull-request` clears each branch as it records, so a name left
 * here is a slice whose number the `Pull request:` line cannot list yet.
 */
export function readPendingBranches(text: string): readonly string[] {
  const match = /^Pending branch:(.*)$/m.exec(text)
  if (!match) return []

  return match[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/** A markdown link on a `Plan:` line, its target captured. */
const PLAN_LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g

/**
 * Finds the first `Plan:` line outside a fenced sample. Every reader and both
 * writers locate the line through this, so none of them can act on a sample a
 * task displays while another reads the real line below it.
 */
export function planLineIndex(lines: readonly string[]): number {
  const fenced = fenceMask(lines)

  return lines.findIndex(
    (line, index) => !fenced[index] && line.startsWith('Plan:'),
  )
}

interface PlanToken {
  readonly target: string
  readonly start: number
  readonly end: number
}

/**
 * The targets a located `Plan:` line carries, each with its span on the line.
 * Links win over the bare form. A bare remainder yields its leading run of
 * tokens reading as a path, one carrying `/` or ending in `.md`, and stops at
 * the first that does not, so a path inside trailing prose never reads as a
 * second plan. It falls back to the first token when that one is not a path.
 */
function planTokens(line: string): readonly PlanToken[] {
  const links = [...line.matchAll(PLAN_LINK_PATTERN)].map((match) => ({
    target: match[1],
    start: match.index,
    end: match.index + match[0].length,
  }))
  if (links.length > 0) return links

  const bare = [...line.slice('Plan:'.length).matchAll(/[^\s,]+/g)].map(
    (match) => ({
      target: match[0],
      start: 'Plan:'.length + match.index,
      end: 'Plan:'.length + match.index + match[0].length,
    }),
  )
  const prose = bare.findIndex(
    ({ target }) => !target.includes('/') && !target.endsWith('.md'),
  )
  const paths = prose === -1 ? bare : bare.slice(0, prose)

  return paths.length > 0 ? paths : bare.slice(0, 1)
}

/**
 * Reads every target the first `Plan:` line outside a fenced sample carries.
 * The path is returned as written, relative to the board.
 */
export function readPlanTargets(text: string): readonly string[] {
  const lines = text.split('\n')
  const index = planLineIndex(lines)
  if (index === -1) return []

  return planTokens(lines[index]).map(({ target }) => target)
}

/**
 * The single target a task's `Plan:` line carries, or `undefined` for no line
 * and for a line linking several plans alike. A caller that must tell those two
 * apart reads `readPlanTargets` instead.
 */
export function readPlanTarget(text: string): string | undefined {
  const targets = readPlanTargets(text)
  return targets.length === 1 ? targets[0] : undefined
}

/**
 * Builds a `Plan:` line as a markdown link whose text and target stay in step,
 * the label taken from the target's filename with its extension dropped.
 * `record.ts` reuses this so a plan-link write and an archive retarget produce
 * one line shape rather than two.
 */
export function planLine(target: string): string {
  return `Plan: ${planLink(target)}`
}

function planLink(target: string): string {
  const name = basename(target)
  const label = name.endsWith('.md') ? name.slice(0, -'.md'.length) : name

  return `[${label}](${target})`
}

/**
 * Points each moved link on the task's `Plan:` line at the plan's new home,
 * keyed by the target as the line wrote it. A link the map does not name keeps
 * its path, since a plan another task still cites stays live. A moved bare
 * path is written back as a link, the shape `planLine` gives a single one.
 *
 * The line is rebuilt by concatenation rather than a replacement string,
 * because `$&` and its siblings are substitution sequences inside one. A plan
 * filename carrying one would write a path nobody typed, and `.canon/plans/` is
 * gitignored, so nothing recovers the pointer it replaced.
 */
export function retargetPlanLine(
  text: string,
  moves: ReadonlyMap<string, string>,
): string {
  const lines = text.split('\n')
  const index = planLineIndex(lines)
  if (index === -1) return text

  const line = lines[index]
  let rewritten = ''
  let at = 0
  for (const token of planTokens(line)) {
    const to = moves.get(token.target)
    if (to === undefined) continue
    rewritten += line.slice(at, token.start) + planLink(to)
    at = token.end
  }
  lines[index] = rewritten + line.slice(at)

  return lines.join('\n')
}

/** The `Ready:` line in either form, the link's target captured ahead of the bare path. */
const READY_PATTERN = /^Ready:[ \t]*(?:\[[^\]]*\]\(([^)]+)\)|(\S+))[ \t]*$/m

/** A ready folder path as a plan's constraints write it, the folder name captured. */
const READY_PATH_PATTERN = /(\.(?:canon|claude)\/ready\/)([^\s/`)]+)(?=\/)/g

export function readReadyTarget(text: string): string | undefined {
  const match = READY_PATTERN.exec(text)
  if (!match) return undefined
  return match[1] ?? match[2]
}

/**
 * Builds a `Ready:` line as a link whose target keeps the trailing slash a
 * folder carries, the label taken from the folder's own name.
 */
export function readyLine(target: string): string {
  const folder = target.replace(/\/+$/, '')

  return `Ready: [${basename(folder)}](${folder}/)`
}

export function retargetReadyLine(text: string, target: string): string {
  return text.replace(READY_PATTERN, () => readyLine(target))
}

/**
 * Builds the `Declined:` line recording why a task was decided against and by
 * whom. Free prose after the colon, since the line names no file to link,
 * unlike `planLine`.
 */
export function declineLine(reason: string, by: string, date: string): string {
  return `Declined: ${reason}, ${by} on ${date}`
}

/**
 * Lines a `Declined:` line anchors after, mirroring `record.ts`'s
 * `ORIGIN_PREFIXES` with `Pull request:` folded in, since a decline can follow
 * a pull request that never merged.
 */
const DECLINE_ANCHOR_PREFIXES = [
  'Plan:',
  'Groundwork:',
  'Intake:',
  'Issue:',
  'Pull request:',
] as const

function lastAnchorLine(lines: readonly string[]): number | undefined {
  let found: number | undefined

  for (const [index, line] of lines.entries()) {
    if (DECLINE_ANCHOR_PREFIXES.some((prefix) => line.startsWith(prefix))) {
      found = index
    }
  }

  return found
}

/**
 * Places the `Declined:` line after the origin lines a task carries, the same
 * scan-and-anchor shape `writePullRequestLine` carries. A decline runs once
 * per task, so there is no existing line to correct, unlike the
 * add/correct/unchanged shape a write safe to run twice needs.
 */
function insertDeclinedLine(text: string, line: string): string {
  const lines = text.split('\n')
  const anchor = lastAnchorLine(lines)

  if (anchor !== undefined) {
    lines.splice(anchor + 1, 0, line)
    return lines.join('\n')
  }

  const heading = lines.findIndex((entry) => entry.startsWith('# '))
  if (heading === -1) return `${line}\n${text}`

  lines.splice(heading + 1, 0, '', line)
  return lines.join('\n')
}

/**
 * Drops the archived task's row from the ordering table. Rows are matched by
 * the link they carry rather than by a line pattern, because a row holds links
 * and prose that a stream edit against it would rewrite in place.
 */
export function removePriorityRow(
  text: string,
  stem: string,
): { readonly text: string; readonly removed: boolean } {
  const target = `](${stem}.md)`
  const lines = text.split('\n')
  const kept = lines.filter((line) => !isRowFor(line, target))

  return { text: kept.join('\n'), removed: kept.length !== lines.length }
}

/**
 * A row is about a task when its first cell links to it. A later cell naming
 * another task is a reference, such as a blocker pointing at what it waits on,
 * and matching anywhere in the line would delete that task's row alongside it.
 */
function isRowFor(line: string, target: string): boolean {
  const trimmed = line.trimStart()
  if (!trimmed.startsWith('|')) return false

  const [, first] = trimmed.split('|')
  return first !== undefined && first.includes(target)
}

/**
 * Drops the declined task's bullet from the backlog. A backlog line is a
 * bullet carrying a link rather than a table row, so the match is a bullet
 * prefix and the link target rather than `isRowFor`'s pipe-delimited cell.
 */
export function removeBacklogRow(
  text: string,
  stem: string,
): { readonly text: string; readonly removed: boolean } {
  const target = `](${stem}.md)`
  const lines = text.split('\n')
  const kept = lines.filter((line) => !isBulletFor(line, target))

  return { text: kept.join('\n'), removed: kept.length !== lines.length }
}

function isBulletFor(line: string, target: string): boolean {
  const trimmed = line.trimStart()
  return /^[-*]\s/.test(trimmed) && trimmed.includes(target)
}

/**
 * Resolves the `Plan:` target against the board and against the project root
 * both, which is how `context-fold` reads the same line. It accepts `../plans/x.md`
 * and `.canon/plans/x.md` as one file, so a gate reading only the first form
 * would pass the second and strand the plan this exists to protect.
 *
 * The resolved path is returned rather than a boolean, because the citation
 * count below compares two tasks by where their targets land and not by the
 * strings they wrote. A target outside the live plans folder yields nothing,
 * which is an archived plan or a pointer into somewhere else entirely.
 *
 * The archive sits inside the folder it archives, so containment alone reads an
 * archived plan as live. Subtracting it is what keeps a closed task from being
 * counted as a citation the sweep has yet to make.
 */
export function resolveLivePlan(
  target: string,
  dir: string,
  root: string,
): string | undefined {
  // Both roots are tested rather than the one this tree resolves at, since a
  // task's line is a string somebody wrote and a path spelling the root the tree
  // has since left is still a path into the plans folder. Reading it as outside
  // would report a shipped plan as still live.
  const plans = recordDirs(root, PLANS)
  const archives = recordDirs(root, PLANS, ARCHIVE)
  const live = (path: string): boolean =>
    plans.some((dir) => isUnder(path, dir)) &&
    !archives.some((dir) => isUnder(path, dir))
  const fromBoard = resolve(dir, target)
  const fromRoot = resolve(root, target)

  if (live(fromBoard)) return atOneRoot(fromBoard, plans, root)
  if (live(fromRoot)) return atOneRoot(fromRoot, plans, root)
  return undefined
}

/**
 * Restates a live plan path at the root this tree actually resolves, so two
 * tasks naming one plan through different roots compare equal.
 *
 * Callers compare the return of `resolveLivePlan` by string. Both roots are
 * accepted above, so without this a task citing `.canon/plans/x.md` and one
 * citing `.canon/plans/x.md` name one file and read as two, which counts a
 * sibling's citation as absent and refuses the archive it should allow.
 */
function atOneRoot(path: string, plans: string[], root: string): string {
  const at = plans.find((dir) => isUnder(path, dir))

  return at === undefined
    ? path
    : join(recordDir(root, PLANS), relative(at, path))
}

/**
 * Names the other live tasks whose `Plan:` line lands on the same file through
 * any of its links. This is
 * the rule `context-fold` applies before it archives a plan, held here so one
 * question has one implementation: a plan another live task still cites is a
 * plan the sweep is correct to leave, and a guard that read the folder instead
 * refused every task sharing one plan and deadlocked the board against the
 * sweep that was behaving correctly.
 *
 * The closing task is excluded by name. It cites the plan itself, so counting
 * it would never reach zero and the count would answer nothing.
 */
export async function otherTasksCitingPlan(
  dir: string,
  root: string,
  plan: string,
  closing: string,
): Promise<string[]> {
  const stems = (await listTaskStems(dir)).filter((stem) => stem !== closing)

  const read = await Promise.all(
    stems.map(async (stem) => {
      const targets = readPlanTargets(
        await readFile(join(dir, `${stem}.md`), 'utf8'),
      )
      const cites = targets.some(
        (target) => resolveLivePlan(target, dir, root) === plan,
      )
      return cites ? stem : undefined
    }),
  )

  return read.filter((stem): stem is string => stem !== undefined)
}

/**
 * Where a task's `Plan:` target resolves, which is what decides whether the
 * plan is the sweep's to move. `unstated` is a task carrying no line at all,
 * and it is distinct from a line resolving somewhere unexpected. `several` is a
 * line linking more than one plan, which answers no single location.
 */
export const CITATION_LOCATIONS = [
  'unstated',
  'several',
  'live',
  'archived',
  'outside',
] as const

export type CitationLocation = (typeof CITATION_LOCATIONS)[number]

export interface PlanCitations {
  readonly ok: true
  readonly stem: string
  /** The one target the line carries. Undefined when it carries none or several. */
  readonly target: string | undefined
  /** Every target the line carries, in line order. */
  readonly targets: readonly string[]
  readonly location: CitationLocation
  /** Other live tasks landing on the same file. Empty unless `location` is `live`. */
  readonly citedBy: readonly string[]
}

export type CitationOutcome = PlanCitations | ArchiveRefused

/**
 * Answers where one task's plan sits and who else holds it, which is the whole
 * of the last-live-citation rule. `context-fold` reads this rather than scanning
 * the board itself, so the sweep that moves a plan and the gate that refuses a
 * task archive cannot drift into disagreeing about which plan is free.
 *
 * It reports and never writes. The move, the retarget, and the ordering the two
 * happen in belong to the caller, and a verb that performed them would be
 * deciding a question the sweep is there to decide.
 */
export async function planCitations(
  root: string,
  stem: string,
): Promise<CitationOutcome> {
  const dir = tasksDir(root)

  if (!existsSync(dir)) {
    return refuse('no-board', `No task board at ${relative(root, dir)}.`)
  }

  const stems = await listTaskStems(dir)
  if (!stems.includes(stem)) {
    const unmatched = describeUnmatchedStem(stems, stem)
    return refuse(unmatched.reason, unmatched.message, unmatched.detail)
  }

  const targets = readPlanTargets(
    await readFile(join(dir, `${stem}.md`), 'utf8'),
  )
  const [target] = targets
  if (target === undefined || targets.length > 1) {
    return {
      ok: true,
      stem,
      target: undefined,
      targets,
      location: target === undefined ? 'unstated' : 'several',
      citedBy: [],
    }
  }

  const live = resolveLivePlan(target, dir, root)
  if (!live) {
    const location = resolvesUnder(
      target,
      dir,
      root,
      recordDirs(root, PLANS, ARCHIVE),
    )
      ? 'archived'
      : 'outside'
    return { ok: true, stem, target, targets, location, citedBy: [] }
  }

  return {
    ok: true,
    stem,
    target,
    targets,
    location: 'live',
    citedBy: await otherTasksCitingPlan(dir, root, live, stem),
  }
}

/**
 * Runs the two-base resolution `resolveLivePlan` applies against folders other
 * than the live ones, so an archived plan is read as archived whichever base the
 * task wrote its path against and whichever record root it spelled.
 */
function resolvesUnder(
  target: string,
  dir: string,
  root: string,
  dirs: readonly string[],
): boolean {
  const fromBoard = resolve(dir, target)
  const fromRoot = resolve(root, target)

  return dirs.some(
    (resolved) => isUnder(fromBoard, resolved) || isUnder(fromRoot, resolved),
  )
}

export async function listTaskStems(dir: string): Promise<string[]> {
  const entries = await readdir(dir)

  return entries
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => entry.slice(0, -'.md'.length))
    .filter((stem) => !isReservedStem(stem))
    .sort()
}

async function matchByPullRequest(
  dir: string,
  stems: readonly string[],
  number: number,
): Promise<string[]> {
  const read = await Promise.all(
    stems.map(async (stem) => ({
      stem,
      numbers: readPullRequest(await readFile(join(dir, `${stem}.md`), 'utf8')),
    })),
  )

  return read
    .filter((entry) => entry.numbers.includes(number))
    .map(({ stem }) => stem)
}

/**
 * Generic over the refusal vocabulary so `archiveTask` and `declineTask` share
 * one builder despite answering with two disjoint reason sets.
 */
function refuse<Reason extends string>(
  reason: Reason,
  message: string,
  detail: readonly string[] = [],
): {
  readonly ok: false
  readonly reason: Reason
  readonly message: string
  readonly detail: readonly string[]
} {
  return { ok: false, reason, message, detail }
}

export interface UnmatchedStem {
  readonly reason: 'no-match' | 'ambiguous'
  readonly message: string
  readonly detail: readonly string[]
}

/**
 * The three-way refusal a bare stem earns once it fails an exact match:
 * exactly one task starts with it, several do, or none does. `archive.ts`'s
 * own `resolveStem`, `planCitations`, and `record.ts`'s `resolveStem` all
 * refuse a stem this way, so the wording lives once rather than three times.
 */
export function describeUnmatchedStem(
  stems: readonly string[],
  name: string,
): UnmatchedStem {
  const prefixed = stems.filter((stem) => stem.startsWith(name))
  if (prefixed.length === 1) {
    const [match] = prefixed
    return {
      reason: 'no-match',
      message: `${name} does not name a task by itself. One task starts with it: ${match}. Pass the full name instead.`,
      detail: [match],
    }
  }
  if (prefixed.length > 1) {
    return {
      reason: 'ambiguous',
      message: `${name} does not name a task by itself. ${prefixed.length} tasks start with it. Pass the full name instead.`,
      detail: prefixed,
    }
  }
  return {
    reason: 'no-match',
    message: `No task named ${name} on the board.`,
    detail: stems,
  }
}

async function resolveStem(
  dir: string,
  selector: TaskSelector,
): Promise<string | ArchiveRefused> {
  const stems = await listTaskStems(dir)

  if (selector.kind === 'stem') {
    if (!stems.includes(selector.stem)) {
      const { reason, message, detail } = describeUnmatchedStem(
        stems,
        selector.stem,
      )
      return refuse(reason, message, detail)
    }
    return selector.stem
  }

  const matched = await matchByPullRequest(dir, stems, selector.number)

  if (matched.length === 0) {
    return refuse('no-match', `No task names pull request #${selector.number}.`)
  }

  if (matched.length > 1) {
    return refuse(
      'ambiguous',
      `${matched.length} tasks name pull request #${selector.number}. One task, one pull request.`,
      matched,
    )
  }

  return matched[0]
}

/**
 * Archives one task as a single unit: the move, the ordering-row removal, and
 * the index regen. The hook and `task-board` both call this, so every gate
 * refuses rather than reports. A caller with nobody watching cannot act on a
 * warning, and two callers gating differently is the drift this exists to stop.
 */
export async function archiveTask(
  root: string,
  selector: TaskSelector,
): Promise<ArchiveOutcome> {
  const dir = tasksDir(root)

  if (!existsSync(dir)) {
    return refuse('no-board', `No task board at ${relative(root, dir)}.`)
  }

  const resolved = await resolveStem(dir, selector)
  if (typeof resolved !== 'string') return resolved

  const stem = resolved
  const from = join(dir, `${stem}.md`)
  const text = await readFile(from, 'utf8')

  // `context-fold` ticks outcomes at ship time, before the merge, so an earlier
  // slice merging after the last slice shipped would find every box ticked
  // while the last slice is still open. Only the last number closes the task.
  const last = readPullRequest(text).at(-1)
  if (selector.kind === 'pull-request' && last !== selector.number) {
    return refuse(
      'earlier-slice',
      `${stem} lists #${last} after #${selector.number}, so the task closes when #${last} merges.`,
    )
  }

  // A branch ticks its outcome before `git-pr` appends its number, so in that
  // window the number above reads as last while it is not. The stem selector
  // skips this check the way it skips the one above, since a hand archive is
  // the route out of a pending branch that was abandoned.
  const pending = readPendingBranches(text)
  if (selector.kind === 'pull-request' && pending.length > 0) {
    return refuse(
      'pending-branch',
      `${stem} still waits on ${pending.join(', ')}, which closed an outcome before its own pull request was recorded, so the task closes when that pull request merges.`,
      pending,
    )
  }

  const { open, closed, cut } = readOutcomes(text)

  if (open.length > 0) {
    return refuse(
      'open-outcomes',
      `${stem} has ${open.length} open outcome(s). Close them, or cut one with \`- ~~<outcome>~~ <why>\`, then archive.`,
      open,
    )
  }

  if (closed.length === 0 && cut.length === 0) {
    return refuse(
      'no-outcomes',
      `${stem} carries no outcomes, so nothing marks it shipped.`,
    )
  }

  const plans = await plansToArchive(dir, root, stem, text)
  const ready =
    plans.moves.length > 0 &&
    (await readyToArchive(dir, root, text, plans.moves))
  const destination = archiveDir(root)
  const to = join(destination, `${stem}.md`)

  // The plans move first so the line written below describes files already at
  // their new paths. Writing the retarget first and failing a move would leave
  // a pointer at a folder holding nothing, and `.canon/plans/` is gitignored, so
  // no history recovers the target it named. The folder follows the plans and
  // all precede the task, so a failed rename never leaves the task archived
  // with its folder live, which the unattended post-merge hook cannot repair.
  await movePlans(plans.moves)

  if (ready) {
    await mkdir(dirname(ready.to), { recursive: true })
    await rename(ready.from, ready.to)
    await retargetReadyInPlans(plans.moves, basename(ready.from))
  }

  await mkdir(destination, { recursive: true })
  await rename(from, to)
  const retargeted = rebaseRelativeLinks(
    retargetPlanLine(text, plans.links(dir)),
    dir,
    destination,
  )
  await writeFile(
    to,
    ready
      ? retargetReadyLine(retargeted, `${linkTo(destination, ready.to)}/`)
      : retargeted,
  )

  const priorityRowRemoved = await clearPriorityRow(dir, stem)
  const regen = await regenOne(dir, { dryRun: false })

  return {
    ok: true,
    stem,
    from,
    to,
    priorityRowRemoved,
    indexRegenerated: regen.action === 'written',
    plans: plans.moves,
    ready: ready || undefined,
    closed: closed.length,
    cut: cut.length,
  }
}

interface PlansToArchive {
  readonly moves: readonly PlanMove[]
  /** Each moved target as the line wrote it, mapped to its link from `taskDir`. */
  readonly links: (taskDir: string) => ReadonlyMap<string, string>
}

/**
 * The plans this task carries into the archive with it, one per live target on
 * its `Plan:` line. The merge is what settles a plan, and the hook reaches this
 * with nobody watching, so the move sits inside the archive rather than in a
 * second call that could leave the task archived and a plan live.
 *
 * A plan another live task still cites stays where it is. Moving it on the
 * first task to close strands every other pointer at a path that has gone, and
 * the sibling has no history behind it to repair the line from.
 *
 * A target resolving to no file moves nothing too. A pointer somebody typed
 * wrong is not a plan to move, and refusing the whole archive over it would
 * park the board behind a repair the merge cannot make.
 */
async function plansToArchive(
  dir: string,
  root: string,
  stem: string,
  text: string,
): Promise<PlansToArchive> {
  const read = await Promise.all(
    readPlanTargets(text).map(async (target) => {
      const live = resolveLivePlan(target, dir, root)
      if (!live || !existsSync(live)) return undefined

      const shared = await otherTasksCitingPlan(dir, root, live, stem)
      return shared.length > 0 ? undefined : { target, live }
    }),
  )

  const moves = new Map<string, PlanMove>()
  const targets = new Map<string, string>()
  for (const entry of read) {
    if (!entry) continue
    const to = join(recordDir(root, PLANS, ARCHIVE), basename(entry.live))
    moves.set(entry.live, { from: entry.live, to })
    targets.set(entry.target, to)
  }

  return {
    moves: [...moves.values()],
    links: (taskDir) =>
      new Map(
        [...targets].map(([target, to]) => [target, linkTo(taskDir, to)]),
      ),
  }
}

async function movePlans(moves: readonly PlanMove[]): Promise<void> {
  for (const move of moves) {
    await mkdir(dirname(move.to), { recursive: true })
    await rename(move.from, move.to)
  }
}

/**
 * The ready folder that travels with the plan, or nothing. It is read from the
 * task's `Ready:` line, falling back to a folder path in the plan's own text for
 * a task written before the line was defined. It moves only with its plan,
 * since the folder is the plan's verbatim source and a plan another task still
 * cites still needs it, so the caller passes the plans `plansToArchive`
 * settled. Their texts are searched in line order and the first folder wins.
 *
 * A target naming no folder, one already archived, or a destination taken
 * yields nothing and refuses nothing, the way a mistyped `Plan:` does.
 */
async function readyToArchive(
  dir: string,
  root: string,
  text: string,
  plans: readonly PlanMove[],
): Promise<ReadyMove | undefined> {
  const planTexts = await Promise.all(
    plans.map((plan) => readFile(plan.from, 'utf8')),
  )
  const live = [text, ...planTexts]
    .map((candidate) => readyFolder(dir, root, candidate))
    .find((folder) => folder !== undefined)
  if (!live) return undefined

  const to = join(recordDir(root, READY, ARCHIVE), basename(live))
  if (existsSync(to)) return undefined

  return { from: live, to }
}

function readyFolder(
  dir: string,
  root: string,
  text: string,
): string | undefined {
  const target = readReadyTarget(text)
  const named = target ? [resolve(dir, target), resolve(root, target)] : []
  const constrained = [...text.matchAll(READY_PATH_PATTERN)].map(([, , name]) =>
    join(recordDir(root, READY), name),
  )
  const archives = recordDirs(root, READY, ARCHIVE)

  return [...named, ...constrained].find(
    (path) =>
      recordDirs(root, READY).some((base) => dirname(path) === base) &&
      basename(path) !== ARCHIVE &&
      !archives.some((base) => isUnder(path, base)) &&
      existsSync(path),
  )
}

async function retargetReadyInPlans(
  plans: readonly PlanMove[],
  folder: string,
): Promise<void> {
  await Promise.all(
    plans.map(async (plan) => {
      const text = await readFile(plan.to, 'utf8')
      const retargeted = retargetReadyPaths(text, folder)
      if (retargeted !== text) await writeFile(plan.to, retargeted)
    }),
  )
}

/** Points the plan's literal folder paths at `ready/archive/`, since the folder no longer sits where they say. */
function retargetReadyPaths(text: string, folder: string): string {
  return text.replace(
    READY_PATH_PATTERN,
    (whole: string, prefix: string, name: string) =>
      name === folder ? `${prefix}${ARCHIVE}/${name}` : whole,
  )
}

/**
 * The archived plan as the archived task cites it. Both halves land a folder
 * deeper than the live pair, so the link is measured between the two
 * destinations rather than written as the `../plans/` the live task carried.
 */
export function linkTo(taskDir: string, plan: string): string {
  return relative(taskDir, plan).split(sep).join('/')
}

const MARKDOWN_LINK_PATTERN = /(\]\()([^)\s]+)/g
/** The capture group makes `split` keep each code span, at the odd positions. */
const INLINE_CODE_PATTERN = /(`+[^`]*`+)/
const BARE_ORIGIN_PATTERN =
  /^((?:Plan|Ready|Groundwork|Intake):[ \t]*)([^\s[\]()]+)[ \t]*$/

function isRelativeTarget(target: string): boolean {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(target)
}

function rebaseTarget(target: string, fromDir: string, toDir: string): string {
  if (!isRelativeTarget(target)) return target

  const suffixAt = target.search(/[#?]/)
  const path = suffixAt === -1 ? target : target.slice(0, suffixAt)
  const suffix = suffixAt === -1 ? '' : target.slice(suffixAt)
  if (path === '') return target

  const rebased = relative(toDir, resolve(fromDir, path)).split(sep).join('/')
  const slash = path.endsWith('/') ? '/' : ''

  return `${rebased}${slash}${suffix}`
}

/**
 * Re-resolves every relative link in a task written for `fromDir` so it reads
 * the same target from `toDir`. Every link rather than the four origin lines,
 * since the body breaks one folder short the same way. Fenced samples stay
 * verbatim, and a URL, an anchor, or a rooted path names nothing depth changes.
 */
export function rebaseRelativeLinks(
  text: string,
  fromDir: string,
  toDir: string,
): string {
  const lines = text.split('\n')
  const fenced = fenceMask(lines)

  return lines
    .map((line, index) => {
      if (fenced[index]) return line

      const bare = BARE_ORIGIN_PATTERN.exec(line)
      if (bare?.[2].includes('/')) {
        return `${bare[1]}${rebaseTarget(bare[2], fromDir, toDir)}`
      }

      return line
        .split(INLINE_CODE_PATTERN)
        .map((part, position) =>
          position % 2 === 1
            ? part
            : part.replace(
                MARKDOWN_LINK_PATTERN,
                (_whole: string, open: string, target: string) =>
                  `${open}${rebaseTarget(target, fromDir, toDir)}`,
              ),
        )
        .join('')
    })
    .join('\n')
}

async function clearPriorityRow(dir: string, stem: string): Promise<boolean> {
  const path = join(dir, 'priority.md')
  if (!existsSync(path)) return false

  const { text, removed } = removePriorityRow(
    await readFile(path, 'utf8'),
    stem,
  )
  if (removed) await writeFile(path, text)

  return removed
}

async function clearBacklogRow(dir: string, stem: string): Promise<boolean> {
  const path = join(dir, BACKLOG)
  if (!existsSync(path)) return false

  const { text, removed } = removeBacklogRow(await readFile(path, 'utf8'), stem)
  if (removed) await writeFile(path, text)

  return removed
}

/**
 * Declines one task as a single unit: the move, the ordering-or-backlog row
 * removal, and the index regen. Unlike `archiveTask`, it carries no
 * outcome-state gate, since a task decided against can sit at any outcome
 * state, and the two never share a refusal set for the reason
 * `DECLINE_REFUSALS` states.
 */
export async function declineTask(
  root: string,
  stem: string,
  reason: string,
  by: string,
): Promise<DeclineOutcome> {
  const dir = tasksDir(root)

  if (!existsSync(dir)) {
    return refuse('no-board', `No task board at ${relative(root, dir)}.`)
  }

  const stems = await listTaskStems(dir)
  if (!stems.includes(stem)) {
    const unmatched = describeUnmatchedStem(stems, stem)
    return refuse(unmatched.reason, unmatched.message, unmatched.detail)
  }

  const from = join(dir, `${stem}.md`)
  const text = await readFile(from, 'utf8')

  const plans = await plansToArchive(dir, root, stem, text)
  const destination = declinedDir(root)
  const to = join(destination, `${stem}.md`)

  // The plans move first, the same order archiveTask uses, so the retarget
  // written below describes files already at their new paths.
  await movePlans(plans.moves)

  await mkdir(destination, { recursive: true })
  await rename(from, to)

  const date = new Date().toISOString().slice(0, 10)
  const declined = insertDeclinedLine(
    rebaseRelativeLinks(
      retargetPlanLine(text, plans.links(dir)),
      dir,
      destination,
    ),
    declineLine(reason, by, date),
  )
  await writeFile(to, declined)

  const priorityRowRemoved = await clearPriorityRow(dir, stem)
  const backlogRowRemoved = await clearBacklogRow(dir, stem)
  const regen = await regenOne(dir, { dryRun: false })

  return {
    ok: true,
    stem,
    from,
    to,
    priorityRowRemoved,
    backlogRowRemoved,
    indexRegenerated: regen.action === 'written',
    plans: plans.moves,
  }
}
