import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { listChangedFiles, resolveBaseRef } from '@/git/files'
import { recordDir } from '@/roots/record'
import { splitPlanSections } from '@/records/validate'
import { type AnswersRefused, resolvePlanReference } from '@/tasks/answers'
import { tasksDir } from '@/tasks/archive'
import { orderingPath, readBoard, rowPlan } from '@/tasks/validate'

const PLANS = 'plans'
const MARKDOWN = '.md'
const NONE_IDENTIFIED = 'None identified.'

/** The one group a dispatch reads, per `claude/skills/task-board/references/board.md`. */
const DISPATCH_GROUP = 'In flight'

export const REACH_REFUSALS = [
  'no-plan',
  'archived',
  'bad-input',
  'no-base',
  'no-diff',
] as const

export type ReachRefusal = (typeof REACH_REFUSALS)[number]

export interface ReachRefused {
  readonly ok: false
  readonly reason: ReachRefusal
  readonly message: string
  readonly detail: readonly string[]
}

/**
 * One surface holding a path: a live plan, named by its filename stem, or a
 * `## In flight` row, named by its task label.
 */
export interface Holder {
  readonly name: string
  readonly source: 'plan' | 'row'
  readonly declaration: string
  /**
   * Whether a holding plan carries an `## In flight` row, undefined on a row
   * holder. It narrows a search, since a plan without a row may be unarchived.
   */
  readonly rowed?: boolean
}

/**
 * One changed path other tracks already hold, carrying every holder and the
 * declaration each matched on. It is grouped by path, since a track carrying
 * both a board cell and a plan list reported the same path twice.
 */
export interface Claim {
  readonly path: string
  readonly holders: readonly Holder[]
}

export interface ReachReport {
  readonly ok: true
  readonly plan: string
  readonly base: string
  readonly changed: number
  readonly declared: readonly string[]
  /** Leads the report. Short on nearly every branch, and the half worth acting on. */
  readonly claimed: readonly Claim[]
  readonly undeclared: readonly string[]
  /** Live plans compared against, this branch's own excluded. */
  readonly plans: number
  /** `## In flight` rows compared against, the row citing this plan excluded. */
  readonly rows: number
  /** Whether an ordering file was on disk to read rows from at all. */
  readonly board: boolean
}

export type ReachOutcome = ReachReport | ReachRefused

export interface ReachOptions {
  /**
   * Where the range is read, defaulting to the records root. A linked worktree
   * holds the branch's commits while the records root sits on the trunk, so
   * reading there closes the range on itself and every reach reads nothing.
   */
  readonly repo?: string
  /** The far side of the range, defaulting to the trunk. */
  readonly ref?: string
}

/**
 * Splits an entry at the colon that opens its reason, the first one outside a
 * backticked span. The span test keeps `canon:docs-sync` and `<slug>: <title>`
 * from ending the subject early, which is the ordinary case, not a corner.
 */
function subjectOf(entry: string): string {
  let fenced = false

  for (let i = 0; i < entry.length; i += 1) {
    const char = entry[i]
    if (char === '`') fenced = !fenced
    else if (char === ':' && !fenced) return entry.slice(0, i)
  }

  return entry
}

/**
 * Whether a span names a file rather than a skill, a command, or a version.
 * It is `readPaths`' test, held here rather than shared, because that function
 * reads a whole cell where this reads one already-split subject.
 */
function namesFile(span: string): boolean {
  return span.includes('/') || /\.[A-Za-z][A-Za-z0-9]*$/.test(span)
}

/**
 * Reads the paths a plan declares out of its `**Files to touch:**` section. A
 * declaration is a backticked span as an entry's subject, ahead of the colon,
 * since a reason names files the branch never writes. A rename declares both sides.
 */
export function readDeclarations(text: string): string[] {
  const section = splitPlanSections(text).get('Files to touch') ?? []
  const declared: string[] = []

  for (const line of section) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('- ') || trimmed === `- ${NONE_IDENTIFIED}`)
      continue

    const spans = subjectOf(trimmed.slice(2)).match(/`[^`]+`/g) ?? []

    for (const span of spans) {
      const path = span
        .slice(1, -1)
        .trim()
        .replace(/^\.\//, '')
        .replace(/\/+$/, '')

      if (namesFile(path)) declared.push(path)
    }
  }

  return [...new Set(declared)]
}

/**
 * Whether a declaration covers a changed path: the same file, or a folder the
 * file sits under. Containment runs one way, since a changed path is a file and
 * the reverse would be a folder claim its author did not write.
 */
function covers(declaration: string, path: string): boolean {
  return path === declaration || path.startsWith(`${declaration}/`)
}

function stemOf(path: string): string {
  return basename(path, MARKDOWN)
}

/**
 * Every live plan beside this one, as a stem and the paths it declares. The
 * archive is a folder below this one and is never walked, so a shipped plan
 * cannot claim a path against a branch building today.
 */
async function otherPlans(
  root: string,
  own: string,
): Promise<{ stem: string; declared: readonly string[] }[]> {
  const dir = recordDir(root, PLANS)
  if (!existsSync(dir)) return []

  const names = (await readdir(dir)).filter(
    (name) => name.endsWith(MARKDOWN) && name !== basename(own),
  )
  names.sort()

  const plans = []
  for (const name of names) {
    const text = await readFile(join(dir, name), 'utf8')
    plans.push({ stem: stemOf(name), declared: readDeclarations(text) })
  }

  return plans
}

/**
 * Every `## In flight` cell beside this branch's own row. A cell is copied from a
 * plan's own list, so the board catches a row whose plan is absent and the
 * plans folder catches a claim no cell carried.
 */
async function dispatchRows(
  root: string,
  own: string,
): Promise<{
  read: boolean
  rows: { label: string; plan: string | undefined; touches: string[] }[]
}> {
  const ordering = orderingPath(root)
  if (!existsSync(ordering)) return { read: false, rows: [] }

  const { rows } = readBoard(await readFile(ordering, 'utf8'))
  const ownStem = stemOf(own)
  const dir = tasksDir(root)

  const running = await Promise.all(
    rows
      .filter((row) => row.group === DISPATCH_GROUP)
      .map(async (row) => {
        const plan = (await rowPlan(row, dir))?.plan
        return {
          label: row.label,
          plan: plan === undefined ? undefined : stemOf(plan),
          touches: [...(row.touches ?? [])],
        }
      }),
  )

  return {
    read: true,
    rows: running.filter((row) => row.plan !== ownStem),
  }
}

/**
 * Every holder of one path, plans first. Returning a list rather than a claim
 * per source is what keeps a track carrying both a plan and a row from reading
 * as two tracks in a report that leads on this list.
 */
function holdersOf(
  path: string,
  plans: readonly { stem: string; declared: readonly string[] }[],
  rows: readonly {
    label: string
    plan: string | undefined
    touches: readonly string[]
  }[],
): Holder[] {
  const holders: Holder[] = []

  for (const plan of plans) {
    const declaration = plan.declared.find((entry) => covers(entry, path))
    if (declaration !== undefined) {
      holders.push({
        name: plan.stem,
        source: 'plan',
        declaration,
        rowed: rows.some((row) => row.plan === plan.stem),
      })
    }
  }

  for (const row of rows) {
    const declaration = row.touches.find((entry) => covers(entry, path))
    if (declaration !== undefined) {
      holders.push({ name: row.label, source: 'row', declaration })
    }
  }

  return holders
}

/**
 * Reads a branch back against what was written about it: the paths its own plan
 * declared, and the paths every other live plan or dispatch row holds. It
 * reports and never gates, trusts the live folder, and sees no track lacking a plan.
 */
export async function planReach(
  root: string,
  reference: string,
  { repo = root, ref }: ReachOptions = {},
): Promise<ReachOutcome> {
  const resolved = resolvePlanReference(root, reference)
  if (!resolved.ok) return widen(resolved)

  const base = await resolveBaseRef(repo, ref)
  if (base === undefined) {
    return refuse(
      'no-base',
      `No merge base against ${ref ?? 'origin/main or main'}, so the branch has no range to read.`,
      [reference],
    )
  }

  const changed = await listChangedFiles(repo, base)
  if (changed === undefined) {
    return refuse(
      'no-diff',
      `git could not list the files changed since ${base}, so the reach is unread rather than clear.`,
      [reference],
    )
  }

  const declared = readDeclarations(await readFile(resolved.path, 'utf8'))
  const plans = await otherPlans(root, resolved.path)
  const board = await dispatchRows(root, resolved.path)

  const claimed: Claim[] = []
  const undeclared: string[] = []

  for (const path of changed) {
    const holders = holdersOf(path, plans, board.rows)
    if (holders.length > 0) claimed.push({ path, holders })
    if (!declared.some((entry) => covers(entry, path))) undeclared.push(path)
  }

  return {
    ok: true,
    plan: resolved.plan,
    base,
    changed: changed.length,
    declared,
    claimed,
    undeclared,
    plans: plans.length,
    rows: board.rows.length,
    board: board.read,
  }
}

/**
 * Carries a resolution refusal through unchanged. The reasons are a subset of
 * this verb's own, so restating the message here would put one wording in two
 * places that ship together.
 */
function widen(refused: AnswersRefused): ReachRefused {
  return refused
}

function refuse(
  reason: ReachRefusal,
  message: string,
  detail: readonly string[] = [],
): ReachRefused {
  return { ok: false, reason, message, detail }
}
