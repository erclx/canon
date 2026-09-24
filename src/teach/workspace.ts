import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { TEACH_STYLESHEET_COMPONENTS } from '@/design/components'
import { buildDesignCss } from '@/design/css'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { type BodyLine, bodyLines } from '@/markdown/scan'
import { recordDir } from '@/record-root'
import { TEACH_FONT_FACES } from '@/teach/fonts'

export const TEACH_REFUSALS = [
  'no-teach',
  'no-workspace',
  'ambiguous',
  'exists',
  'no-file',
  'no-section',
  'listed',
  'defined',
  'bad-input',
] as const

export type TeachRefusal = (typeof TEACH_REFUSALS)[number]

export interface TeachRefused {
  readonly ok: false
  readonly reason: TeachRefusal
  readonly message: string
  readonly detail: readonly string[]
}

/** The files and folders `standards/teach.md` fixes for a workspace. */
export const TEACH_MISSION = 'MISSION.md'
export const TEACH_RESOURCES = 'RESOURCES.md'
export const TEACH_GLOSSARY = 'GLOSSARY.md'
export const TEACH_REFERENCE = 'reference'
export const TEACH_RECORDS = 'learning-records'
export const TEACH_LESSONS = 'lessons'
export const TEACH_ASSETS = 'assets'

/**
 * The one stylesheet every lesson in a workspace links. The name is fixed here
 * rather than chosen per lesson, because the second lesson has to reach the
 * file the first one wrote and a name composed twice is a name that can differ.
 * This file is workspace-owned: `writeStylesheet` writes it once and leaves it
 * alone, since a lesson adds its own rules here. It imports `TEACH_STYLESHEET_BASE`
 * for the tokens and components, which is the half a resync may always replace.
 */
export const TEACH_STYLESHEET = 'course.css'

/**
 * The seeded half of a workspace's styling, imported by `TEACH_STYLESHEET`.
 * `writeStylesheet` rewrites this file from the design source on every call,
 * since nothing workspace-authored lives in it, which is what lets a design
 * token move without a `--force` flag discarding a workspace's lesson rules.
 */
export const TEACH_STYLESHEET_BASE = 'base.css'

/**
 * The mission heading whose list a session reads as exit criteria. The writer,
 * the reader below, and the record validator all match this one spelling, so a
 * heading none of them can find fails the validator rather than reading as an
 * empty list.
 */
export const TEACH_SUCCESS_HEADING = '## Success looks like'

/**
 * A workspace folder as the standard names it, capturing the ordinal and the
 * topic separately so a listing sorts by the first and a selector matches the
 * second.
 */
export const WORKSPACE_NAME = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/

const TOPIC_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const READ_HEADING = '## Read'
const LEADS_HEADING = '## Leads'

/**
 * The line a scaffolded section carries until something real lands in it. An
 * empty section reads as one someone forgot to write, and the insert verbs drop
 * this line as the first real entry arrives.
 */
const PLACEHOLDER = '- None yet.'

/** Two digits on the folder, per the standard, because a person opens few. */
const ORDINAL_WIDTH = 2

const DATE_LENGTH = 'YYYY-MM-DD'.length

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** The heading a learning record schedules its revisits under. */
const REVISIT_HEADING = '## Revisit'

/**
 * The gaps a revisit item moves through, in days. A rung is a one-based index
 * into this list, widening after a retrieval the learner passed unaided and
 * narrowing after a miss, which is the spacing rule the pedagogy reference
 * states. The values are here rather than in a skill body because a session
 * told to widen a gap still picks the number by judgment.
 */
const REVISIT_LADDER = [1, 3, 7, 16, 35] as const

/**
 * One scheduled entry, as a learning record spells it. The rung is carried in
 * the record rather than derived from how many records name the item, since a
 * miss drops it back and a count only ever climbs.
 */
const REVISIT_ENTRY =
  /^-\s+\*\*(.+?)\*\*:\s*due\s+(\d{4}-\d{2}-\d{2}),\s*rung\s+([1-9]\d*)\s*$/

export interface RevisitItem {
  /** What comes back up, as the record names it. */
  readonly item: string
  /** The day it comes back up, as `YYYY-MM-DD`. */
  readonly date: string
  readonly rung: number
  /** True once that day has arrived or passed. */
  readonly overdue: boolean
  /** The date to schedule when the learner retrieves it unaided. */
  readonly hit: string
  /** The date to schedule when they miss it. */
  readonly miss: string
  /** The record the surviving entry was written in. */
  readonly record: string
}

export interface WorkspaceSummary {
  readonly slug: string
  /** `NaN` when the folder name carries no ordinal, which a listing reports. */
  readonly ordinal: number
  readonly topic: string
  /** Relative to the root, so a caller prints a path a reader can open. */
  readonly path: string
  readonly title: string | undefined
  readonly opened: string | undefined
  readonly lessons: number
  readonly records: number
  readonly reference: number
  readonly terms: number
  /** Required files the workspace does not carry, by the standard's layout. */
  readonly missing: readonly string[]
}

export interface WorkspaceDetail extends WorkspaceSummary {
  readonly lessonFiles: readonly string[]
  readonly recordFiles: readonly string[]
  readonly referenceFiles: readonly string[]
  readonly glossary: readonly string[]
  /** The mission's success lines, which a session reports progress against. */
  readonly success: readonly string[]
  /**
   * What the learning records schedule, soonest first. A session reads this
   * before it has chosen what to teach, which is why it rides on the listing
   * rather than on the verb that resolves a lesson already picked.
   */
  readonly due: readonly RevisitItem[]
}

export interface WorkspacesListed {
  readonly ok: true
  readonly workspaces: readonly WorkspaceSummary[]
  /** The ordinal an open would take, so no caller derives one by hand. */
  readonly next: string
}

export interface WorkspaceRead {
  readonly ok: true
  readonly workspace: WorkspaceDetail
}

export interface WorkspaceOpened {
  readonly ok: true
  readonly slug: string
  readonly path: string
  readonly created: readonly string[]
}

export interface SourcesWritten {
  readonly ok: true
  readonly slug: string
  readonly path: string
  readonly read: readonly Source[]
  readonly leads: readonly Source[]
}

export interface TermsWritten {
  readonly ok: true
  readonly slug: string
  readonly path: string
  readonly defined: readonly Term[]
}

export type ListOutcome = WorkspacesListed | TeachRefused
export type ReadOutcome = WorkspaceRead | TeachRefused
export type OpenOutcome = WorkspaceOpened | TeachRefused
export type SourceOutcome = SourcesWritten | TeachRefused
export type TermOutcome = TermsWritten | TeachRefused

export interface Source {
  readonly title: string
  readonly url: string
}

export interface Term {
  readonly term: string
  readonly definition: string
}

export interface OpenRequest {
  readonly topic: string
  readonly subject: string
  readonly startingPoint: string
  readonly success: readonly string[]
  readonly outOfScope: readonly string[]
  readonly title?: string
  readonly date?: string
}

export function refuse(
  reason: TeachRefusal,
  message: string,
  detail: readonly string[] = [],
): TeachRefused {
  return { ok: false, reason, message, detail }
}

/**
 * Every workspace sits under the main worktree root rather than under the
 * checkout the caller stands in. Resolving that root belongs to the caller, so
 * this takes one and never reads the working directory.
 *
 * A root already named `teach` is taken as the teach folder itself rather than
 * a project root to wrap, which is what lets a caller point straight at a
 * folder such as `examples/teach` that holds workspaces outside any `.canon/`
 * or `.claude/` record root.
 */
export function teachDir(root: string): string {
  return basename(root) === 'teach' ? root : recordDir(root, 'teach')
}

async function listSlugs(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => WORKSPACE_NAME.test(name))
    .sort()
}

async function filesIn(
  dir: string,
  folder: string,
  suffix?: string,
): Promise<string[]> {
  const path = join(dir, folder)
  if (!existsSync(path)) return []

  const entries = await readdir(path, { withFileTypes: true })

  return entries
    .filter(
      (entry) => entry.isFile() && (!suffix || entry.name.endsWith(suffix)),
    )
    .map((entry) => entry.name)
    .sort()
}

function isEntry(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('- ') && trimmed !== PLACEHOLDER
}

/** One bullet per term the subject defines, which is what a glossary holds. */
function glossaryTerms(text: string): string[] {
  return unfenced(text)
    .map((line) => line.text)
    .filter(isEntry)
    .map((line) => line.trim().slice('- '.length))
}

/**
 * The mission's success lines, each one an observable thing the learner will be
 * able to do. A session reads them as exit criteria, so a wrapped entry is
 * joined back into one line rather than reported as two criteria.
 *
 * A mission carrying no such heading yields nothing rather than refusing. The
 * record validator is what reports the absent section, and a listing that
 * refused would take the whole workspace down with it.
 */
function successLines(text: string): string[] {
  const lines = text.split('\n')
  const section = sectionRange(
    unfenced(text),
    TEACH_SUCCESS_HEADING,
    lines.length,
  )

  if (!section) return []

  return bulletBlocks(lines.slice(section.start, section.end)).map((block) =>
    block.join(' ').trim().slice('- '.length).replace(/\s+/g, ' ').trim(),
  )
}

/**
 * Whether a `YYYY-MM-DD` string names a real day.
 *
 * The entry pattern admits `2026-13-45`, since it counts digits rather than
 * reading a calendar, and `addDays` throws on a date that names no day, so a
 * single mistyped record would take down every listing that reads the
 * workspace. Every date reaching `addDays` passes here first.
 */
function isDay(date: string): boolean {
  return !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
}

/** A day offset from a real `YYYY-MM-DD` date, back out in the same form. */
function addDays(date: string, days: number): string {
  const start = Date.parse(`${date}T00:00:00Z`)
  return new Date(start + days * MS_PER_DAY).toISOString().slice(0, DATE_LENGTH)
}

/** A rung moved by one step, held inside the ladder at both ends. */
function stepRung(rung: number, step: number): number {
  return Math.min(REVISIT_LADDER.length, Math.max(1, rung + step))
}

function gapFor(rung: number, step: number): number {
  return REVISIT_LADDER[stepRung(rung, step) - 1]
}

export interface RecordText {
  readonly file: string
  readonly text: string
}

/**
 * Every revisit a workspace's learning records schedule, soonest first.
 *
 * Records arrive in read order and a later one supersedes an earlier entry for
 * the same item, since the schedule is the state of one topic rather than a log
 * of every time it was set. Matching is case-insensitive on the item, so a
 * session that capitalized differently in a later record still supersedes
 * rather than opening a second schedule beside the first.
 *
 * An entry not in the recorded shape is skipped rather than reported. A note
 * carrying no date schedules nothing, which is what the standard's anti-pattern
 * names, and this reader has no date to put on it. A date naming no real day is
 * skipped on the same footing, since a schedule nothing can order is a note.
 */
export function readRevisits(
  records: readonly RecordText[],
  today: string,
): RevisitItem[] {
  if (!isDay(today)) return []

  const scheduled = new Map<
    string,
    { item: string; date: string; rung: number; record: string }
  >()

  for (const record of records) {
    const lines = record.text.split('\n')
    const section = sectionRange(
      unfenced(record.text),
      REVISIT_HEADING,
      lines.length,
    )

    if (!section) continue

    for (const block of bulletBlocks(lines.slice(section.start, section.end))) {
      const match = REVISIT_ENTRY.exec(block.join(' ').replace(/\s+/g, ' '))
      if (!match || !isDay(match[2])) continue

      scheduled.set(match[1].toLowerCase(), {
        item: match[1],
        date: match[2],
        rung: Number(match[3]),
        record: record.file,
      })
    }
  }

  return [...scheduled.values()]
    .map((entry) => ({
      item: entry.item,
      date: entry.date,
      rung: entry.rung,
      overdue: entry.date <= today,
      hit: addDays(today, gapFor(entry.rung, 1)),
      miss: addDays(today, gapFor(entry.rung, -1)),
      record: entry.record,
    }))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.item.localeCompare(right.item),
    )
}

/** The ordinal a folder name carries, or `NaN` when it carries none. */
function ordinalOf(slug: string): number {
  const match = WORKSPACE_NAME.exec(slug)
  return match ? Number(match[1]) : Number.NaN
}

async function summarize(
  root: string,
  dir: string,
  slug: string,
): Promise<WorkspaceDetail> {
  const match = WORKSPACE_NAME.exec(slug)
  const missionPath = join(dir, TEACH_MISSION)
  const mission = existsSync(missionPath)
    ? await readFile(missionPath, 'utf8')
    : undefined
  const frontmatter =
    mission === undefined ? undefined : parseFrontmatter(mission)

  const glossaryPath = join(dir, TEACH_GLOSSARY)
  const glossary = existsSync(glossaryPath)
    ? glossaryTerms(await readFile(glossaryPath, 'utf8'))
    : []

  const [lessonFiles, recordFiles, referenceFiles] = await Promise.all([
    filesIn(dir, TEACH_LESSONS),
    filesIn(dir, TEACH_RECORDS, '.md'),
    filesIn(dir, TEACH_REFERENCE, '.md'),
  ])

  // Read order is filename order, which is record order, so a later record
  // supersedes an earlier schedule for the same item.
  const records = await Promise.all(
    recordFiles.map(async (file) => ({
      file,
      text: await readFile(join(dir, TEACH_RECORDS, file), 'utf8'),
    })),
  )

  return {
    slug,
    ordinal: match ? Number(match[1]) : Number.NaN,
    topic: match ? match[2] : slug,
    path: relative(root, dir),
    title: readField(frontmatter, 'title'),
    opened: readField(frontmatter, 'date'),
    lessons: lessonFiles.length,
    records: recordFiles.length,
    reference: referenceFiles.length,
    terms: glossary.length,
    missing: [TEACH_MISSION, TEACH_RESOURCES, TEACH_GLOSSARY].filter(
      (file) => !existsSync(join(dir, file)),
    ),
    lessonFiles,
    recordFiles,
    referenceFiles,
    glossary,
    success: mission === undefined ? [] : successLines(mission),
    due: readRevisits(records, today()),
  }
}

function byOrdinal(left: WorkspaceSummary, right: WorkspaceSummary): number {
  if (Number.isNaN(left.ordinal)) return Number.isNaN(right.ordinal) ? 0 : 1
  if (Number.isNaN(right.ordinal)) return -1
  return left.ordinal - right.ordinal
}

/**
 * Reads the ordinals off the folder names rather than off summaries, so opening
 * a workspace costs one directory listing instead of a read of every file in
 * every workspace already there.
 */
function nextOrdinal(slugs: readonly string[]): string {
  const highest = slugs
    .map(ordinalOf)
    .filter((ordinal) => !Number.isNaN(ordinal))
    .reduce((carry, ordinal) => Math.max(carry, ordinal), 0)

  return String(highest + 1).padStart(ORDINAL_WIDTH, '0')
}

/**
 * Every workspace under the root, with the ordinal a new one would take.
 *
 * A folder failing the name pattern is listed rather than dropped, since
 * dropping it hides the one workspace a session most needs to see. Its ordinal
 * reads as absent, it sorts last, and it never moves the next number.
 */
export async function listWorkspaces(root: string): Promise<ListOutcome> {
  const dir = teachDir(root)

  if (!existsSync(dir)) {
    return refuse('no-teach', `No teach folder at ${relative(root, dir)}.`)
  }

  const slugs = await listSlugs(dir)

  const workspaces = await Promise.all(
    slugs.map((slug) => summarize(root, join(dir, slug), slug)),
  )

  return {
    ok: true,
    workspaces: [...workspaces].sort(byOrdinal),
    next: nextOrdinal(slugs),
  }
}

/**
 * The workspace a selector names, matched on the folder name or on the topic
 * behind the ordinal. Two topics matching is a refusal rather than a pick,
 * because the caller meant one of them and no verb here can say which.
 */
async function findWorkspace(
  root: string,
  selector: string,
): Promise<{ slug: string; dir: string } | TeachRefused> {
  const dir = teachDir(root)

  if (!existsSync(dir)) {
    return refuse('no-teach', `No teach folder at ${relative(root, dir)}.`)
  }

  const slugs = await listSlugs(dir)
  const matched = slugs.filter(
    (slug) => slug === selector || WORKSPACE_NAME.exec(slug)?.[2] === selector,
  )

  if (matched.length === 0) {
    return refuse('no-workspace', `No workspace named ${selector}.`, slugs)
  }

  if (matched.length > 1) {
    return refuse(
      'ambiguous',
      `${selector} names ${matched.length} workspaces.`,
      matched,
    )
  }

  return { slug: matched[0], dir: join(dir, matched[0]) }
}

/** One workspace with the filenames behind each count. */
export async function readWorkspace(
  root: string,
  selector: string,
): Promise<ReadOutcome> {
  const found = await findWorkspace(root, selector)
  if ('ok' in found) return found

  return { ok: true, workspace: await summarize(root, found.dir, found.slug) }
}

function titleFor(topic: string, given: string | undefined): string {
  if (given) return given

  const words = topic.split('-')
  return [
    words[0].charAt(0).toUpperCase() + words[0].slice(1),
    ...words.slice(1),
  ].join(' ')
}

function missionText(
  request: OpenRequest,
  title: string,
  date: string,
): string {
  const outOfScope =
    request.outOfScope.length > 0
      ? request.outOfScope
      : ['Nothing has been ruled out yet.']

  return [
    '---',
    `title: ${yamlValue(title)}`,
    `description: ${yamlValue(request.subject)}`,
    `date: ${date}`,
    '---',
    '',
    `# ${title}`,
    '',
    request.subject,
    '',
    '## Starting point',
    '',
    request.startingPoint,
    '',
    '## Success looks like',
    '',
    ...request.success.map((line) => `- ${line}`),
    '',
    '## Out of scope',
    '',
    ...outOfScope.map((line) => `- ${line}`),
    '',
  ].join('\n')
}

function resourcesText(title: string): string {
  return [
    '---',
    `title: ${yamlValue(`Sources for ${title}`)}`,
    `description: ${yamlValue(`Sources read for ${title}, and leads found but not opened`)}`,
    '---',
    '',
    `# Sources for ${title}`,
    '',
    'Sources that stand behind this workspace, kept apart from leads nobody opened.',
    '',
    READ_HEADING,
    '',
    PLACEHOLDER,
    '',
    LEADS_HEADING,
    '',
    PLACEHOLDER,
    '',
  ].join('\n')
}

function glossaryText(title: string): string {
  return [
    '---',
    `title: ${yamlValue(`Glossary for ${title}`)}`,
    `description: ${yamlValue(`Terms ${title} defines, one entry each`)}`,
    '---',
    '',
    `# Glossary for ${title}`,
    '',
    'One entry per term the subject defines, sorted alphabetically.',
    '',
    PLACEHOLDER,
    '',
  ].join('\n')
}

/**
 * Serializes a frontmatter value, quoting only what YAML would otherwise read
 * as something other than the string, so a plain title stays byte-identical.
 */
function yamlValue(value: string): string {
  return Bun.YAML.stringify(value)
}

/** Today as `YYYY-MM-DD`, which is the one field the mission dates. */
function today(): string {
  return new Date().toISOString().slice(0, DATE_LENGTH)
}

/**
 * Creates a workspace at the next ordinal with all three required files.
 *
 * The ordinal, the folder name, and every path are derived here rather than by
 * the caller. A caller standing in a linked worktree cannot reach this root
 * through its file-editing tools, so a path it composed by hand is one nothing
 * checks before the write lands somewhere else.
 */
export async function openWorkspace(
  root: string,
  request: OpenRequest,
): Promise<OpenOutcome> {
  if (!TOPIC_SLUG.test(request.topic)) {
    return refuse('bad-input', `Not a kebab-case topic: ${request.topic}.`, [
      request.topic,
    ])
  }

  if (request.success.length === 0) {
    return refuse(
      'bad-input',
      'A mission needs at least one success line. Pass --success <line>.',
    )
  }

  const dir = teachDir(root)
  await mkdir(dir, { recursive: true })

  const slugs = await listSlugs(dir)
  const existing = slugs.find(
    (slug) => WORKSPACE_NAME.exec(slug)?.[2] === request.topic,
  )

  if (existing) {
    return refuse(
      'exists',
      `${existing} already covers ${request.topic}. Resume it rather than opening a second.`,
      [existing],
    )
  }

  const slug = `${nextOrdinal(slugs)}-${request.topic}`
  const folder = join(dir, slug)
  const title = titleFor(request.topic, request.title)

  await mkdir(folder, { recursive: true })

  const files: ReadonlyArray<readonly [string, string]> = [
    [TEACH_MISSION, missionText(request, title, request.date ?? today())],
    [TEACH_RESOURCES, resourcesText(title)],
    [TEACH_GLOSSARY, glossaryText(title)],
  ]

  for (const [name, text] of files) {
    await writeFile(join(folder, name), text)
  }

  return {
    ok: true,
    slug,
    path: relative(root, folder),
    created: files.map(([name]) => join(relative(root, folder), name)),
  }
}

interface Range {
  readonly start: number
  readonly end: number
}

/**
 * Body lines outside every fence, each still carrying the source line it came
 * from. `bodyLines` numbers from one past the frontmatter it drops, so `number
 * - 1` addresses the same line in the array a caller splits itself.
 */
function unfenced(text: string): BodyLine[] {
  return bodyLines(text).filter((line) => !line.fenced)
}

/**
 * The half-open source range a heading owns, ending at the next heading of the
 * same level or above. A heading quoted inside a fenced example selects nothing,
 * since the scan never sees it.
 */
function sectionRange(
  lines: readonly BodyLine[],
  heading: string,
  total: number,
): Range | undefined {
  let start: number | undefined

  for (const line of lines) {
    if (start === undefined) {
      if (line.text.trim() === heading) start = line.number
      continue
    }

    if (/^##?[ \t]/.test(line.text)) return { start, end: line.number - 1 }
  }

  return start === undefined ? undefined : { start, end: total }
}

/**
 * The half-open source range holding a bullet list, from its first entry to the
 * last line of its last entry. A list carrying only the placeholder yields that
 * line's range, so the first real entry replaces it rather than landing beside
 * it.
 *
 * An indented non-blank line extends the range because that is how markdown
 * wraps an entry too long for one line. An unindented one does not, so a
 * paragraph written under a list stays outside and is neither sorted nor moved.
 */
function bulletRange(
  lines: readonly BodyLine[],
  within?: Range,
): Range | undefined {
  let first: number | undefined
  let last: number | undefined

  for (const line of lines) {
    const index = line.number - 1

    if (within && (index < within.start || index >= within.end)) continue

    if (line.text.trim().startsWith('- ')) {
      first ??= index
      last = index
      continue
    }

    const wraps = first !== undefined && /^\s+\S/.test(line.text)
    if (wraps) last = index
  }

  return first === undefined || last === undefined
    ? undefined
    : { start: first, end: last + 1 }
}

/**
 * The bullet blocks in a run of lines, each a bullet with the continuation lines
 * wrapped under it.
 *
 * Splitting on the bullet marker rather than keeping the lines that are bullets
 * is what holds a wrapped entry together. A filter over lines keeps the first
 * line of one and silently drops the rest, which loses half of every entry an
 * author wrapped at the margin.
 */
function bulletBlocks(lines: readonly string[]): string[][] {
  const blocks: string[][] = []

  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      blocks.push([line])
      continue
    }

    blocks.at(-1)?.push(line)
  }

  return blocks.filter((block) => block[0].trim() !== PLACEHOLDER)
}

/**
 * Places entries in a line range, dropping the scaffolded placeholder as the
 * first real entry lands. `sorted` merges alphabetically and anything else
 * appends, which is the split between a glossary and a source list.
 */
function placeEntries(
  lines: readonly string[],
  range: Range,
  entries: readonly string[],
  sorted: boolean,
): string {
  const kept = bulletBlocks(lines.slice(range.start, range.end))
  const added = entries.map((entry) => [entry])

  const placed = sorted
    ? [...kept, ...added].sort((left, right) =>
        left[0].toLowerCase().localeCompare(right[0].toLowerCase()),
      )
    : [...kept, ...added]

  return [
    ...lines.slice(0, range.start),
    ...placed.flat(),
    ...lines.slice(range.end),
  ].join('\n')
}

/** Appends entries under a heading, keeping the blank lines around the list. */
function insertUnderHeading(
  text: string,
  heading: string,
  entries: readonly string[],
): string | undefined {
  const lines = text.split('\n')
  const body = unfenced(text)
  const section = sectionRange(body, heading, lines.length)
  if (!section) return undefined

  const bullets = bulletRange(body, section)

  if (!bullets) {
    return [
      ...lines.slice(0, section.start),
      '',
      ...entries,
      '',
      ...lines.slice(section.end),
    ].join('\n')
  }

  return placeEntries(lines, bullets, entries, false)
}

async function openFile(
  dir: string,
  slug: string,
  name: string,
): Promise<string | TeachRefused> {
  const path = join(dir, name)

  if (!existsSync(path)) {
    return refuse('no-file', `${slug} carries no ${name}.`)
  }

  return path
}

/**
 * Appends sources to `RESOURCES.md`, keeping what was read apart from what was
 * only found.
 *
 * A URL already listed under either heading is refused rather than repeated,
 * since a second entry for one source splits what rests on it across two lines.
 */
export async function recordSources(
  root: string,
  selector: string,
  read: readonly Source[],
  leads: readonly Source[],
): Promise<SourceOutcome> {
  const found = await findWorkspace(root, selector)
  if ('ok' in found) return found

  const path = await openFile(found.dir, found.slug, TEACH_RESOURCES)
  if (typeof path !== 'string') return path

  let text = await readFile(path, 'utf8')
  const listed = unfenced(text)
    .map((line) => line.text)
    .filter(isEntry)

  const repeated = [...read, ...leads].filter((source) =>
    listed.some((line) => line.includes(`(${source.url})`)),
  )

  if (repeated.length > 0) {
    return refuse(
      'listed',
      `${TEACH_RESOURCES} already lists ${repeated.map((source) => source.url).join(', ')}.`,
      repeated.map((source) => source.url),
    )
  }

  for (const [heading, sources] of [
    [READ_HEADING, read],
    [LEADS_HEADING, leads],
  ] as const) {
    if (sources.length === 0) continue

    const written = insertUnderHeading(
      text,
      heading,
      sources.map((source) => `- [${source.title}](${source.url})`),
    )

    if (written === undefined) {
      return refuse(
        'no-section',
        `${TEACH_RESOURCES} carries no ${heading} section to write into.`,
        [heading],
      )
    }

    text = written
  }

  await writeFile(path, text)

  return { ok: true, slug: found.slug, path, read, leads }
}

/**
 * The entry shape the standard fixes, which leads with the bolded term.
 *
 * The definition is terminated before the citation is appended, since a caller
 * passing a bare phrase would otherwise run it into the sentence naming where
 * the term first appears.
 */
function termEntry(term: Term, firstSeen: string | undefined): string {
  const definition = /[.!?]$/.test(term.definition)
    ? term.definition
    : `${term.definition}.`

  const where = firstSeen ? ` First seen in ${firstSeen}.` : ''

  return `- **${term.term}**: ${definition}${where}`
}

/** The term a glossary entry defines, read back out of its bolded span. */
function definedTerm(entry: string): string {
  return entry.replace(/^\*\*(.+?)\*\*.*$/s, '$1').toLowerCase()
}

/**
 * Adds terms to `GLOSSARY.md`, alphabetically, in one read and one write.
 *
 * A term already defined is refused rather than replaced. A definition the
 * subject has moved under is a revision of the entry rather than a second one,
 * and no verb here can tell those two apart from the command line.
 */
export async function defineTerms(
  root: string,
  selector: string,
  terms: readonly Term[],
  firstSeen: string | undefined,
): Promise<TermOutcome> {
  const found = await findWorkspace(root, selector)
  if ('ok' in found) return found

  const path = await openFile(found.dir, found.slug, TEACH_GLOSSARY)
  if (typeof path !== 'string') return path

  const text = await readFile(path, 'utf8')
  const existing = glossaryTerms(text).map(definedTerm)

  const defined = terms.filter((term) =>
    existing.includes(term.term.toLowerCase()),
  )

  if (defined.length > 0) {
    return refuse(
      'defined',
      `${TEACH_GLOSSARY} already defines ${defined.map((term) => term.term).join(', ')}.`,
      defined.map((term) => term.term),
    )
  }

  const entries = terms.map((term) => termEntry(term, firstSeen))
  const lines = text.split('\n')
  const bullets = bulletRange(unfenced(text))

  // A glossary carries no heading over its list, so the entries land in the
  // bullet range itself. A file holding none yet is appended to, which covers a
  // glossary written by hand rather than scaffolded here.
  const written = bullets
    ? placeEntries(lines, bullets, entries, true)
    : `${text.trimEnd()}\n\n${entries.join('\n')}\n`

  await writeFile(path, written)

  return { ok: true, slug: found.slug, path, defined: terms }
}

export interface StylesheetWritten {
  readonly ok: true
  readonly slug: string
  /** Relative to the root, so a caller prints a path a reader can open. */
  readonly path: string
  /** Relative to the root, the re-synced seed `path` imports. */
  readonly basePath: string
  /** False when the workspace already held `path` and this call left it alone. */
  readonly written: boolean
}

export type StylesheetOutcome = StylesheetWritten | TeachRefused

const STYLESHEET_BASE_BANNER = [
  'Seeded by `canon teach stylesheet` from the design source in',
  'src/design/tokens.ts, and rewritten on every call. The tokens and the two',
  'components below are the system this workspace renders in. Read a value',
  'through its custom property rather than restating the hex, which is what',
  'let one workspace fork the palette from every other. Add lesson rules to',
  `${TEACH_STYLESHEET} instead, which imports this file and is never rewritten.`,
].join('\n   ')

const stylesheetSeed = (): string =>
  `@import url('./${TEACH_STYLESHEET_BASE}');\n`

/**
 * Writes a workspace's stylesheet pair from the design source.
 *
 * Every workspace used to carry one hand-authored file, which is how the
 * course palette forked once per workspace. The names are fixed at
 * `TEACH_STYLESHEET` and `TEACH_STYLESHEET_BASE`, and the folder at
 * `TEACH_ASSETS`, for the same reason a second lesson has to reach the files
 * the first one wrote and names composed twice can differ.
 *
 * `TEACH_STYLESHEET_BASE` carries the tokens and the components and is
 * rewritten every call, since nothing workspace-authored lives in it.
 * `TEACH_STYLESHEET` imports it, carries a workspace's own lesson rules, and
 * is written once and left alone, since overwriting it would discard them.
 * `--force` is the caller saying it wants that file's seed back too.
 */
export async function writeStylesheet(
  root: string,
  selector: string,
  force = false,
): Promise<StylesheetOutcome> {
  const found = await readWorkspace(root, selector)
  if (!found.ok) return found

  const workspace = found.workspace
  const assetsDir = join(workspace.path, TEACH_ASSETS)
  const baseRel = join(assetsDir, TEACH_STYLESHEET_BASE)
  const rel = join(assetsDir, TEACH_STYLESHEET)
  const basePath = join(root, baseRel)
  const path = join(root, rel)

  await mkdir(join(root, assetsDir), { recursive: true })
  await writeFile(
    basePath,
    buildDesignCss(undefined, {
      banner: STYLESHEET_BASE_BANNER,
      embedFonts: TEACH_FONT_FACES,
      components: TEACH_STYLESHEET_COMPONENTS,
    }),
  )

  if (existsSync(path) && !force) {
    return {
      ok: true,
      slug: workspace.slug,
      path: rel,
      basePath: baseRel,
      written: false,
    }
  }

  await writeFile(path, stylesheetSeed())

  return {
    ok: true,
    slug: workspace.slug,
    path: rel,
    basePath: baseRel,
    written: true,
  }
}
