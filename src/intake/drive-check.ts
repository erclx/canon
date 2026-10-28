import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, normalize } from 'node:path'
import {
  changedSince,
  readWorktreeStatus,
  type StatusEntry,
} from '@/git/status'
import { extractOrdinal, type IntakeRefused, openFolder } from '@/intake/folder'
import { requirementsRel } from '@/context/requirements'
import { bodyLines } from '@/markdown/scan'

/** The record a drive leaves in its intake folder, which this check reads. */
export const DRIVE_RECORD = 'drive.json'

/** The one folder inside an intake folder that evidence may live in. */
export const EVIDENCE_DIR = 'evidence'

/** The log a person reads, which the `undrawn` axis parses by its labels. */
export const DRIVE_LOG = join(EVIDENCE_DIR, 'drive-log.md')

const SCRATCH = join('.canon', 'tmp', 'app-drive')

/**
 * The refusals this check adds to the folder lookup's own, which reach a
 * caller unchanged as an `IntakeRefused`.
 */
export const DRIVE_REFUSALS = [
  'bad-input',
  'no-record',
  'bad-record',
  'no-requirements',
  'no-baseline',
  'unreadable-tree',
] as const

export type DriveRefusal = (typeof DRIVE_REFUSALS)[number]

export interface DriveRefused {
  readonly ok: false
  readonly reason: DriveRefusal
  readonly message: string
  readonly detail: readonly string[]
}

export interface BaselineRecorded {
  readonly ok: true
  readonly slug: string
  readonly path: string
  readonly entries: number
}

/** Each list names what failed, and an empty list is a clean axis. */
export interface DriveFindings {
  /** Goals the record carries no entry for. */
  readonly unmapped: readonly string[]
  /** Goals marked `not-driven` with no reason given. */
  readonly unreasoned: readonly string[]
  /** Entries naming a goal the requirements record does not hold. */
  readonly unknown: readonly string[]
  /** Paths in the main checkout that differ from the baseline. */
  readonly changed: readonly string[]
  /** Evidence paths that resolve outside the folder's `evidence/`. */
  readonly strayEvidence: readonly string[]
  /** Evidence paths inside `evidence/` that hold no file. */
  readonly missingEvidence: readonly string[]
  /** The drive's worktree, when the record names one still on disk. */
  readonly worktreeLeft: readonly string[]
  /** Logged findings the operator decided with no drawn outcome. */
  readonly undrawn: readonly string[]
}

export interface DrawnReading {
  /** Each decided finding's heading, as `<nn>. <title>`, with nothing drawn. */
  readonly undrawn: readonly string[]
  /** Every path a `Drawn` field cites, for the evidence tests. */
  readonly paths: readonly string[]
}

export interface DriveChecked {
  readonly ok: true
  readonly slug: string
  readonly reason: 'clean' | 'failed'
  readonly goals: number
  readonly findings: DriveFindings
}

export type BaselineOutcome = BaselineRecorded | DriveRefused
export type CheckOutcome = DriveChecked | DriveRefused | IntakeRefused

type GoalStatus = 'driven' | 'not-driven'

interface DriveGoal {
  readonly goal: string
  readonly status: GoalStatus
  readonly reason?: string
}

interface DriveRecord {
  readonly goals: readonly DriveGoal[]
  readonly evidence: readonly string[]
  readonly worktree?: string
}

function refuse(
  reason: DriveRefusal,
  message: string,
  detail: readonly string[] = [],
): DriveRefused {
  return { ok: false, reason, message, detail }
}

/**
 * A goal as both sides compare it: a leading bold label and a trailing period
 * dropped, and whitespace collapsed. Requirements records carry no goal ids,
 * so the text is the identity, and stripping the label lets a drive record
 * paste the bullet whole or name the sentence alone.
 */
function normalizeGoal(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\*\*[^*]+\*\*\s*/, '')
    .replace(/\.$/, '')
    .trim()
}

/**
 * Every top-level bullet under `## Goals`, through any H3 grouping, up to the
 * next H2. A wrapped bullet's indented continuation joins it, and a nested
 * bullet is detail of its parent rather than a goal of its own.
 */
export function readGoals(source: string): string[] {
  const goals: string[] = []
  let inGoals = false
  let current: string | undefined
  let appending = false

  const close = () => {
    if (current !== undefined) goals.push(normalizeGoal(current))
    current = undefined
    appending = false
  }

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    const text = line.text

    if (/^#{1,2}\s/.test(text)) {
      close()
      inGoals = /^##\s+Goals\s*$/.test(text)
      continue
    }
    if (!inGoals) continue

    const bullet = /^[-*]\s+(.*)$/.exec(text)
    if (bullet) {
      close()
      current = bullet[1]
      appending = true
    } else if (/^\s+[-*]\s/.test(text) || text.trim() === '') {
      appending = false
    } else if (appending && /^\s+\S/.test(text)) {
      current = `${current} ${text.trim()}`
    } else if (/^#{3,}\s/.test(text)) {
      appending = false
    }
  }
  close()

  return goals
}

const FINDING_HEADING = /^##\s+(\d+\.\s.*?)\s*$/
const LOG_FIELD = /^[-*]\s+\*\*([^*]+):\*\*\s*(.*)$/
const DECISION_LABEL = 'Decision (operator)'
const DRAWN_LABEL = 'Drawn'

/**
 * Reads the drive log's numbered findings for a decision with nothing drawn.
 * A decision reading `see <nn>` was drawn under the finding it names, and a
 * `ref-<nn>` heading or a finding with no decision carries nothing to draw. A
 * `Drawn` field passes when it cites a path in a code span or reads
 * `skipped, <reason>`, so a bare `skipped` still lists the finding. A skip
 * cites no path, since its reason may code-span a flag or a format.
 */
export function readDrawn(source: string): DrawnReading {
  const undrawn: string[] = []
  const paths: string[] = []
  let finding: string | undefined
  let decision: string | undefined
  let drawn: string | undefined

  const close = () => {
    if (finding !== undefined && decision && !/^see\s+\d+/i.test(decision)) {
      const field = drawn ?? ''
      if (/^skipped\b/i.test(field)) {
        if (!/^skipped\s*,\s*\S/i.test(field)) undrawn.push(finding)
      } else {
        const cited = [...field.matchAll(/`([^`]+)`/g)].map((match) => match[1])
        paths.push(...cited)
        if (cited.length === 0) undrawn.push(finding)
      }
    }
    finding = decision = drawn = undefined
  }

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    if (/^#{1,2}\s/.test(line.text)) {
      close()
      finding = FINDING_HEADING.exec(line.text)?.[1]
      continue
    }
    const field = LOG_FIELD.exec(line.text)
    if (finding === undefined || !field) continue
    if (field[1] === DECISION_LABEL) decision = field[2].trim()
    if (field[1] === DRAWN_LABEL) drawn = field[2].trim()
  }
  close()

  return { undrawn, paths }
}

function parseRecord(raw: string): DriveRecord | string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return `${DRIVE_RECORD} does not parse as JSON.`
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return `${DRIVE_RECORD} is not an object.`
  }

  const { goals, evidence, worktree } = parsed as Record<string, unknown>
  if (!Array.isArray(goals)) {
    return `${DRIVE_RECORD} carries no "goals" list.`
  }

  const entries: DriveGoal[] = []
  for (const [index, entry] of goals.entries()) {
    const { goal, status, reason } = (entry ?? {}) as Record<string, unknown>
    if (typeof goal !== 'string' || goal.trim() === '') {
      return `${DRIVE_RECORD} goals[${index}] carries no "goal" text.`
    }
    if (status !== 'driven' && status !== 'not-driven') {
      return `${DRIVE_RECORD} goals[${index}] has a "status" other than "driven" or "not-driven".`
    }
    entries.push({
      goal,
      status,
      ...(typeof reason === 'string' && { reason }),
    })
  }

  if (
    evidence !== undefined &&
    (!Array.isArray(evidence) ||
      !evidence.every((item): item is string => typeof item === 'string'))
  ) {
    return `${DRIVE_RECORD} carries an "evidence" field that is not a list of paths.`
  }
  if (worktree !== undefined && typeof worktree !== 'string') {
    return `${DRIVE_RECORD} carries a "worktree" that is not a path.`
  }

  return {
    goals: entries,
    evidence: evidence ?? [],
    ...(worktree !== undefined && { worktree }),
  }
}

function isEvidencePath(path: string): boolean {
  if (isAbsolute(path)) return false
  const segments = normalize(path).split(/[\\/]/)
  return (
    segments[0] === EVIDENCE_DIR &&
    segments.length > 1 &&
    !segments.includes('..')
  )
}

/**
 * The scratch key for a topic, with any ordinal dropped, so a baseline taken
 * before the intake folder is numbered and a check naming the numbered folder
 * meet at one file. Undefined for a slug that could leave scratch.
 */
function bareSlug(slug: string): string | undefined {
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(slug) || slug.includes('..')) {
    return undefined
  }
  const ordinal = extractOrdinal(slug)
  return ordinal === '' ? slug : slug.slice(ordinal.length + 1)
}

function baselinePath(root: string, bare: string): string {
  return join(root, SCRATCH, bare, 'baseline.json')
}

function badSlug(slug: string): DriveRefused {
  return refuse(
    'bad-input',
    `Not an intake slug: ${slug}. Pass the folder's topic, as in app-drive-1-0.`,
  )
}

/**
 * Stores the main checkout's status before a drive, so the check can tell a
 * write the drive made from one already in the tree. Scratch rather than the
 * intake folder, since the baseline is safe to lose once the check passes and
 * the folder holds findings alone. A second call replaces the first.
 */
export async function recordBaseline(
  root: string,
  slug: string,
): Promise<BaselineOutcome> {
  const bare = bareSlug(slug)
  if (bare === undefined) return badSlug(slug)

  const status = await readWorktreeStatus(root)
  if (status === undefined) {
    return refuse('unreadable-tree', `git cannot read the status of ${root}.`)
  }

  const path = baselinePath(root, bare)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, `${JSON.stringify(status)}\n`)

  return { ok: true, slug: bare, path, entries: status.length }
}

/**
 * Checks a finished drive against its intake folder's `drive.json`: every
 * goal mapped or skipped with a reason, the main checkout unchanged since the
 * baseline, the evidence inside the folder's `evidence/`, every decision in
 * the drive log drawn, and the drive's worktree gone. A folder with no log
 * reads as nothing undrawn. It reports what failed and never reverts a changed path,
 * since only the operator knows which of them to keep.
 */
export async function checkDrive(
  root: string,
  slug: string,
): Promise<CheckOutcome> {
  const bare = bareSlug(slug)
  if (bare === undefined) return badSlug(slug)

  const folder = await openFolder(root, slug)
  if (typeof folder !== 'string') return folder

  const recordPath = join(folder, DRIVE_RECORD)
  if (!existsSync(recordPath)) {
    return refuse(
      'no-record',
      `No ${DRIVE_RECORD} in ${basename(folder)}, so no drive was recorded.`,
    )
  }
  const record = parseRecord(await readFile(recordPath, 'utf8'))
  if (typeof record === 'string') return refuse('bad-record', record)

  const requirements = join(root, requirementsRel(root))
  if (!existsSync(requirements)) {
    return refuse(
      'no-requirements',
      `No requirements record at ${requirementsRel(root)}, so no goal can be checked.`,
    )
  }
  const goals = readGoals(await readFile(requirements, 'utf8'))

  let baseline: readonly StatusEntry[]
  try {
    baseline = JSON.parse(await readFile(baselinePath(root, bare), 'utf8'))
  } catch {
    return refuse(
      'no-baseline',
      `No baseline for ${bare}. Run canon intake drive-check ${bare} --baseline before the drive.`,
    )
  }
  const current = await readWorktreeStatus(root)
  if (current === undefined) {
    return refuse('unreadable-tree', `git cannot read the status of ${root}.`)
  }

  const logPath = join(folder, DRIVE_LOG)
  const drawn: DrawnReading = existsSync(logPath)
    ? readDrawn(await readFile(logPath, 'utf8'))
    : { undrawn: [], paths: [] }
  const evidence = [...new Set([...record.evidence, ...drawn.paths])]

  const entries = new Map(
    record.goals.map((entry) => [normalizeGoal(entry.goal), entry]),
  )
  const known = new Set(goals)
  const unreasoned = goals.filter((goal) => {
    const entry = entries.get(goal)
    return entry?.status === 'not-driven' && !entry.reason?.trim()
  })

  const findings: DriveFindings = {
    unmapped: goals.filter((goal) => !entries.has(goal)),
    unreasoned,
    unknown: record.goals
      .filter((entry) => !known.has(normalizeGoal(entry.goal)))
      .map((entry) => entry.goal),
    changed: changedSince(baseline, current),
    strayEvidence: evidence.filter((path) => !isEvidencePath(path)),
    missingEvidence: evidence.filter(
      (path) => isEvidencePath(path) && !existsSync(join(folder, path)),
    ),
    worktreeLeft:
      record.worktree !== undefined && existsSync(record.worktree)
        ? [record.worktree]
        : [],
    undrawn: drawn.undrawn,
  }
  const failed = Object.values(findings).some((list) => list.length > 0)

  return {
    ok: true,
    slug: basename(folder),
    reason: failed ? 'failed' : 'clean',
    goals: goals.length,
    findings,
  }
}
