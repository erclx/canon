import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, normalize } from 'node:path'
import {
  changedSince,
  readWorktreeStatus,
  type StatusEntry,
} from '@/git/status'
import {
  DRIVE_LOG,
  type DrawnReading,
  EVIDENCE_DIR,
  isEvidencePath,
  readDrawn,
} from '@/intake/drive-log'
import {
  extractOrdinal,
  type IntakeRefused,
  listClusters,
  namesRenderedSurface,
  openFolder,
} from '@/intake/folder'
import { parseDecided, readItems } from '@/intake/items'
import {
  APP_CONFIG_REL,
  type AppTableRead,
  LEGACY_APP_FILES,
  readAppTable,
} from '@/config/app'
import { requirementsRel } from '@/context/requirements'
import {
  type BehaviorRow,
  normalizeBehaviorText,
  normalizeEntryText as normalizeGoal,
  normalizeSurface,
  readBehaviorRows,
} from '@/design/behavior'
import { bodyLines } from '@/markdown/scan'

/** The record a drive leaves in its intake folder, which this check reads. */
export const DRIVE_RECORD = 'drive.json'

const BASELINE_DIR = join(EVIDENCE_DIR, 'baseline')
const CURRENT_PAGE = '00-current'
const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|gif|avif)$/i

const SCRATCH = join('.canon', 'tmp', 'app-drive')

/**
 * The refusals this check adds to the folder lookup's own, which reach a
 * caller unchanged as an `IntakeRefused`.
 */
export const DRIVE_REFUSALS = [
  'bad-input',
  'no-record',
  'bad-record',
  'bad-config',
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
  /**
   * Configured scripts a persona never ran, or skipped with no reason, each as
   * `<script> (<persona>)`, or the bare script when the config names no personas.
   */
  readonly unscripted: readonly string[]
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
  /** `evidence/baseline/00-current` when a drive that drew a decided finding on a board holds no capture of the current page. */
  readonly uncaptured: readonly string[]
  /** Findings whose drawing was skipped while the item deciding them fixes a rendered surface. */
  readonly skippedVisible: readonly string[]
  /**
   * Design record Behavior rows and `behaviors` entries that failed, each as
   * `unmapped: <surface>: <behavior>`, `unreasoned: ...`, or `unknown: ...`,
   * the same three ways a goal fails.
   */
  readonly behavior: readonly string[]
}

export interface DriveChecked {
  readonly ok: true
  readonly slug: string
  readonly reason: 'clean' | 'failed'
  readonly goals: number
  /** The Behavior rows the design record holds, zero with no record or section. */
  readonly behaviors: number
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

interface DriveBehavior {
  readonly surface: string
  readonly behavior: string
  readonly status: GoalStatus
  readonly reason?: string
}

interface DriveScript {
  readonly script: string
  readonly persona: string
  readonly status: GoalStatus
  readonly reason?: string
}

interface DriveRecord {
  readonly goals: readonly DriveGoal[]
  /** Empty for a record written before the design record held behavior. */
  readonly behaviors: readonly DriveBehavior[]
  /** Absent for the flat default target. */
  readonly target?: string
  readonly scripts: readonly DriveScript[]
  readonly evidence: readonly string[]
  /** Absent or `null` for a drive of the live app, which made no copy. */
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

  const { goals, behaviors, evidence, worktree, target, scripts } =
    parsed as Record<string, unknown>
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
  if (
    worktree !== undefined &&
    worktree !== null &&
    typeof worktree !== 'string'
  ) {
    return `${DRIVE_RECORD} carries a "worktree" that is not a path.`
  }
  if (typeof worktree === 'string' && worktree.trim() === '') {
    return `${DRIVE_RECORD} carries an empty "worktree". A drive of the live app records null.`
  }

  if (target !== undefined && target !== null && typeof target !== 'string') {
    return `${DRIVE_RECORD} carries a "target" that is not a name.`
  }
  if (typeof target === 'string' && target.trim() === '') {
    return `${DRIVE_RECORD} carries an empty "target". A drive of the default target records null.`
  }

  const runs = parseScripts(scripts)
  if (typeof runs === 'string') return runs

  const tried = parseBehaviors(behaviors)
  if (typeof tried === 'string') return tried

  return {
    goals: entries,
    behaviors: tried,
    ...(typeof target === 'string' && { target }),
    scripts: runs,
    evidence: evidence ?? [],
    ...(typeof worktree === 'string' && { worktree }),
  }
}

function parseBehaviors(behaviors: unknown): DriveBehavior[] | string {
  if (behaviors === undefined) return []
  if (!Array.isArray(behaviors)) {
    return `${DRIVE_RECORD} carries a "behaviors" field that is not a list.`
  }

  const entries: DriveBehavior[] = []
  for (const [index, entry] of behaviors.entries()) {
    const { surface, behavior, status, reason } = (entry ?? {}) as Record<
      string,
      unknown
    >
    if (typeof surface !== 'string' || surface.trim() === '') {
      return `${DRIVE_RECORD} behaviors[${index}] carries no "surface".`
    }
    if (typeof behavior !== 'string' || behavior.trim() === '') {
      return `${DRIVE_RECORD} behaviors[${index}] carries no "behavior" text.`
    }
    if (status !== 'driven' && status !== 'not-driven') {
      return `${DRIVE_RECORD} behaviors[${index}] has a "status" other than "driven" or "not-driven".`
    }
    entries.push({
      surface,
      behavior,
      status,
      ...(typeof reason === 'string' && { reason }),
    })
  }
  return entries
}

function parseScripts(scripts: unknown): DriveScript[] | string {
  if (scripts === undefined) return []
  if (!Array.isArray(scripts)) {
    return `${DRIVE_RECORD} carries a "scripts" field that is not a list.`
  }

  const runs: DriveScript[] = []
  for (const [index, entry] of scripts.entries()) {
    const { script, persona, status, reason } = (entry ?? {}) as Record<
      string,
      unknown
    >
    if (typeof script !== 'string' || script.trim() === '') {
      return `${DRIVE_RECORD} scripts[${index}] carries no "script" path.`
    }
    if (typeof persona !== 'string' || persona.trim() === '') {
      return `${DRIVE_RECORD} scripts[${index}] carries no "persona".`
    }
    if (status !== 'driven' && status !== 'not-driven') {
      return `${DRIVE_RECORD} scripts[${index}] has a "status" other than "driven" or "not-driven".`
    }
    runs.push({
      script,
      persona,
      status,
      ...(typeof reason === 'string' && { reason }),
    })
  }
  return runs
}

function behaviorKey(surface: string, behavior: string): string {
  return `${normalizeSurface(surface)}: ${normalizeBehaviorText(behavior)}`
}

/** Each Behavior row or entry that fails, read the three ways a goal fails. */
function behaviorFindings(
  rows: readonly BehaviorRow[],
  entries: readonly DriveBehavior[],
): string[] {
  const byKey = new Map(
    entries.map((entry) => [behaviorKey(entry.surface, entry.behavior), entry]),
  )
  const known = new Set(
    rows.map((row) => behaviorKey(row.surface, row.behavior)),
  )

  const unmapped: string[] = []
  const unreasoned: string[] = []
  for (const key of known) {
    const entry = byKey.get(key)
    if (entry === undefined) unmapped.push(`unmapped: ${key}`)
    else if (entry.status === 'not-driven' && !entry.reason?.trim()) {
      unreasoned.push(`unreasoned: ${key}`)
    }
  }
  const unknown = [...byKey.keys()]
    .filter((key) => !known.has(key))
    .map((key) => `unknown: ${key}`)

  return [...unmapped, ...unreasoned, ...unknown]
}

interface ScriptPlan {
  readonly scripts: readonly string[]
  readonly personas: readonly string[]
}

function isStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim() !== '')
  )
}

/**
 * The scripts and personas the drive's target owes, a named target's table falling back to the flat key the way
 * `app-drive` reads it. A project with no `[drive]` table owes no scripts.
 */
function readScriptPlan(
  read: AppTableRead,
  target: string | undefined,
): ScriptPlan | DriveRefused {
  const none: ScriptPlan = { scripts: [], personas: [] }
  if (read.kind === 'absent') {
    return target === undefined
      ? none
      : refuse(
          'bad-record',
          `${DRIVE_RECORD} names target "${target}", but neither ${APP_CONFIG_REL} nor ${LEGACY_APP_FILES.drive.rel} holds a [drive] config.`,
        )
  }
  if (read.kind === 'unparsable') {
    return refuse('bad-config', `${read.source} ${read.detail}.`)
  }

  const { source, spell } = read
  const parsed: Record<string, unknown> =
    typeof read.value === 'object' &&
    read.value !== null &&
    !Array.isArray(read.value)
      ? (read.value as Record<string, unknown>)
      : {}

  let table: Record<string, unknown> = {}
  if (target !== undefined) {
    const targets = parsed.targets as Record<string, unknown> | undefined
    const named = targets?.[target]
    if (typeof named !== 'object' || named === null) {
      return refuse(
        'bad-record',
        `${DRIVE_RECORD} names target "${target}", which ${source} does not hold under [${spell('targets')}].`,
      )
    }
    table = named as Record<string, unknown>
  }

  const readList = (key: 'scripts' | 'personas'): string[] | DriveRefused => {
    const value = key in table ? table[key] : parsed[key]
    if (value === undefined) return []
    if (!isStringList(value)) {
      const where = spell(key in table ? `targets.${target}.${key}` : key)
      return refuse(
        'bad-config',
        `${source} carries a "${where}" that is not a list of strings.`,
      )
    }
    return value
  }

  const scripts = readList('scripts')
  if (!Array.isArray(scripts)) return scripts
  const personas = readList('personas')
  if (!Array.isArray(personas)) return personas
  return { scripts, personas }
}

/**
 * Each configured script and persona pair the record carries no passing or
 * reasoned entry for. With no personas configured, a script needs one such
 * entry under any persona, since the drive asked for them instead.
 */
function unscriptedPairs(
  plan: ScriptPlan,
  runs: readonly DriveScript[],
): string[] {
  const settled = (run: DriveScript) =>
    run.status === 'driven' || Boolean(run.reason?.trim())

  if (plan.personas.length === 0) {
    return plan.scripts.filter(
      (script) => !runs.some((run) => run.script === script && settled(run)),
    )
  }

  return plan.scripts.flatMap((script) =>
    plan.personas
      .filter(
        (persona) =>
          !runs.some(
            (run) =>
              run.script === script && run.persona === persona && settled(run),
          ),
      )
      .map((persona) => `${script} (${persona})`),
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
 * Stores the main checkout's status before a drive, so the check can tell a write
 * the drive made from one already in the tree. Scratch rather than the intake
 * folder, and a second call replaces the first.
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

async function holdsCurrentPage(folder: string): Promise<boolean> {
  const dir = join(folder, BASELINE_DIR)
  if (!existsSync(dir)) return false
  const names = await readdir(dir)
  return names.some(
    (name) =>
      IMAGE_EXTENSION.test(name) &&
      name.startsWith(CURRENT_PAGE) &&
      /^[-.]|^$/.test(
        name.slice(CURRENT_PAGE.length).replace(IMAGE_EXTENSION, ''),
      ),
  )
}

/**
 * The skipped findings whose deciding item names a rendered-surface file in
 * its `Fix:` or `Worth it:` line, joined through the item's `Decided:` pointer.
 */
async function skippedOnVisible(
  folder: string,
  skipped: DrawnReading['skipped'],
): Promise<string[]> {
  if (skipped.length === 0) return []

  const visible = new Set<number>()
  for (const cluster of await listClusters(folder)) {
    for (const item of readItems(
      await readFile(join(folder, cluster), 'utf8'),
    )) {
      const pointer =
        item.decided === undefined ? undefined : parseDecided(item.decided)
      if (pointer === undefined || normalize(pointer.path) !== DRIVE_LOG)
        continue
      if (namesRenderedSurface(item)) visible.add(pointer.finding)
    }
  }
  return skipped
    .filter((entry) => visible.has(entry.finding))
    .map((entry) => entry.heading)
}

/**
 * Checks a finished drive against its `drive.json`, failing each axis
 * `DriveFindings` names. It reports a changed path and never reverts it,
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
  const rows = readBehaviorRows(root)

  const plan = readScriptPlan(readAppTable(root, 'drive'), record.target)
  if ('ok' in plan) return plan

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
    : { undrawn: [], paths: [], skipped: [], board: false }
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
    unscripted: unscriptedPairs(plan, record.scripts),
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
    uncaptured:
      drawn.board && drawn.paths.length > 0 && !(await holdsCurrentPage(folder))
        ? [join(BASELINE_DIR, CURRENT_PAGE)]
        : [],
    skippedVisible: await skippedOnVisible(folder, drawn.skipped),
    behavior: behaviorFindings(rows, record.behaviors),
  }
  const failed = Object.values(findings).some((list) => list.length > 0)

  return {
    ok: true,
    slug: basename(folder),
    reason: failed ? 'failed' : 'clean',
    goals: goals.length,
    behaviors: rows.length,
    findings,
  }
}
