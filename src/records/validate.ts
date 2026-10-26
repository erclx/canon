import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { linesOutsideFences } from '@/markdown/scan'
import {
  isSessionMap,
  measureSessionMap,
  type SessionMapLength,
} from '@/records/session-map'
import {
  intakeStructure,
  type StructureEntry,
  structureFindings,
} from '@/records/structure'
import {
  recordDir as resolveRecordDir,
  recordDirs as resolveRecordDirs,
} from '@/roots/record'

export const RECORD_KINDS = [
  'plans',
  'groundwork',
  'intake',
  'sessions',
] as const

export type RecordKind = (typeof RECORD_KINDS)[number]

/**
 * `unknown-kind` is raised at the argument boundary rather than by the walk, and
 * it sits here because both reach a caller through the same `reason` field. A
 * union covering only what the walk returns would type a record the command can
 * emit as impossible.
 */
export const VALIDATE_REFUSALS = [
  'no-folder',
  'no-record',
  'unknown-kind',
] as const

export type ValidateRefusal = (typeof VALIDATE_REFUSALS)[number]

export const FINDING_KINDS = [
  'name-malformed',
  'title-missing',
  'section-missing',
  'entry-unreasoned',
  'suggestion-missing',
  'question-unanswerable',
  'frontmatter-incomplete',
  'date-malformed',
  'index-missing',
  'state-missing',
  'closing-partial',
  'item-incomplete',
  'operator-call-phrasing',
  'batch-unsplit',
  'source-unquoted',
  'stack-foldable',
  'fan-in-unmatched',
] as const

export type FindingKind = (typeof FINDING_KINDS)[number]

export interface Finding {
  readonly kind: FindingKind
  /** The record the finding sits in, relative to the validated folder. */
  readonly record: string
  readonly subject: string
  readonly message: string
}

/**
 * A place a record misses a structure criterion. It sits apart from `Finding`
 * so it never sets the exit, since every record written before the criteria
 * misses `S1` and a gate on it would fail them all.
 */
export interface StructureFinding extends StructureEntry {
  /** The record the entry sits in, relative to the validated folder. */
  readonly record: string
  /** The file inside a folder record, or the record itself for a plan. */
  readonly subject: string
}

export interface ValidateReport {
  readonly ok: true
  readonly kind: RecordKind
  readonly records: number
  readonly findings: readonly Finding[]
  readonly structure: readonly StructureFinding[]
  /**
   * Each session map's words against its cap, carried by the sessions kind
   * alone. It never sets the exit, since a map refused near a compaction loses
   * the reasoning it was written to save.
   */
  readonly length?: readonly SessionMapLength[]
}

export interface ValidateRefused {
  readonly ok: false
  readonly reason: ValidateRefusal
  readonly message: string
}

export type ValidateOutcome = ValidateReport | ValidateRefused

/**
 * The record folder each kind reads. Session maps sit on the task board beside
 * the tasks rather than in a folder of their own.
 */
const KIND_FOLDER: Readonly<Record<RecordKind, string>> = {
  plans: 'plans',
  groundwork: 'groundwork',
  intake: 'intake',
  sessions: 'tasks',
}

/** Every folder a kind would accept, whether or not it is on disk. */
export function recordDirs(root: string, kind: RecordKind): string[] {
  return resolveRecordDirs(root, KIND_FOLDER[kind])
}

/**
 * The folder a kind reads. The first candidate on disk wins, and the creation
 * default stands in when none exists, so a refusal and a test fixture both name
 * the location the kind would be written to.
 */
export function recordsDir(root: string, kind: RecordKind): string {
  return resolveRecordDir(root, KIND_FOLDER[kind])
}

export function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value)
}

const NONE_IDENTIFIED = 'None identified.'
const NUMBERED_FILE = /^\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.md$/

/**
 * The suggestion the plan standard fixes for a question that turns on the
 * operator's preference rather than on a technical default. `src/tasks/answers.ts`
 * reads this alongside `normalizeOperatorCall` so the dispatch gate and this
 * write-time check cannot drift into recognizing different spellings.
 */
export const OPERATOR_CALL = 'needs your call'

/**
 * The two demonstrated paraphrases of `OPERATOR_CALL`, longer variant first so
 * it is not read as a shorter match sitting inside it: `operator's call` is a
 * substring of `the operator's call`, and checking it first would rewrite the
 * `the` into place with the wrong phrase on either side.
 */
const OPERATOR_CALL_PHRASES = [
  "the operator's call",
  "operator's call",
] as const

/**
 * Reads a recognized paraphrase as the canonical phrase, so a caller testing
 * `startsWith(OPERATOR_CALL)` sees one spelling regardless of which wording the
 * author used. Case-insensitive, since the corpus capitalizes a suggestion's
 * first word, and it rewrites only the matched span so the reason text either
 * side of it survives untouched.
 *
 * Short-circuits on an already-canonical opening before scanning the rest of
 * the text. Without that, a suggestion already opening with `needs your call`
 * that goes on to mention a paraphrase inside its own reason, such as
 * `needs your call, since the operator's call outranks a default`, has that
 * later occurrence rewritten too, which garbles the reason the dispatcher
 * reports rather than leaving it as the author wrote it.
 */
export function normalizeOperatorCall(text: string): string {
  const lower = text.toLowerCase()
  if (lower.startsWith(OPERATOR_CALL)) return text

  for (const phrase of OPERATOR_CALL_PHRASES) {
    const at = lower.indexOf(phrase)
    if (at !== -1) {
      return `${text.slice(0, at)}your call${text.slice(at + phrase.length)}`
    }
  }

  return text
}

function finding(
  kind: FindingKind,
  record: string,
  subject: string,
  message: string,
): Finding {
  return { kind, record, subject, message }
}

async function listMarkdown(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort()
}

async function listFolders(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

const PLAN_NAME = /^feature-[a-z0-9]+(-[a-z0-9]+)*\.md$/
const PLAN_TITLE = /^#[ \t]+Feature:[ \t]+\S/
const BATCH_LABEL = /^\*\*Batch\s+\d+\b.*\*\*/i

/**
 * Reads the raw text rather than `splitPlanSections`'s output, since a
 * colon-bearing `**Batch 1: ...**` line is itself a `MARKER_LINE` and is
 * already dropped from the split `Files to touch` section before any check
 * sees it.
 */
export function hasStagedBatches(text: string): boolean {
  return linesOutsideFences(text).some((line) => BATCH_LABEL.test(line.trim()))
}

/**
 * An entry names a file and says something about it. Both halves are tested as
 * facts rather than as a syntax: a backticked span anywhere, and prose left over
 * once the spans are removed.
 *
 * Requiring the path to lead and the reason to follow a colon was the first
 * shape and it reported 80 of 178 archived plans. The corpus writes
 * `- Label: prose naming a path` as often as `- path: reason`, and both name the
 * file and say why, so the stricter rule measured a house style rather than a
 * defect.
 */
function statesReason(entry: string): boolean {
  if (!/`[^`]+`/.test(entry)) return false

  const prose = entry.replace(/`[^`]*`/g, '').replace(/^-[ \t]*/, '')
  return /[A-Za-z0-9]/.test(prose)
}
const QUESTION_ITEM = /^\d+[a-z]?\.[ \t]+\S/

const PLAN_SECTIONS = [
  'Summary',
  'Current behavior',
  'Constraints',
  'Files to touch',
  'Design references',
  'Reference images',
  'Verification',
  'Risks',
  'Review focus',
  'Questions',
  'Sources',
] as const

type PlanSection = (typeof PLAN_SECTIONS)[number]

const PLAN_REQUIRED: readonly PlanSection[] = [
  'Summary',
  'Files to touch',
  'Verification',
  'Risks',
  'Review focus',
  'Questions',
]

/**
 * The files whose edit changes what a person sees, the set the `ui/a11y` and
 * `ui/keyboard` rules glob plus the other markup and style extensions a plan
 * names. A plan touching one owes a `Design references` section, so a set too wide forces it on every
 * plan and one too narrow lets a UI plan skip it.
 */
const RENDERED_SURFACE = /\.(?:tsx|jsx|astro|vue|svelte|html|css|scss)$/

export function touchesRenderedSurface(entries: readonly string[]): boolean {
  return entries.some((entry) =>
    [...entry.matchAll(/`([^`]+)`/g)].some((span) =>
      RENDERED_SURFACE.test(span[1]),
    ),
  )
}

/**
 * A line standing alone as a bold label or an H2, whatever it names. A plan is
 * free to carry a section of its own, so the split has to see one to close the
 * section above it.
 */
const MARKER_LINE = /^(?:##[ \t]+(.+?)|\*\*(.+?):\*\*)[ \t]*$/

/**
 * A section opens as a bold label or as an H2 and both count. The corpus writes
 * `Summary` as a heading and the others as bold labels, and roughly a fifth
 * of it swaps one for the other. Reporting the variant would fail nearly every
 * plan present on the rule a reader is least served by, which is what teaches
 * them to skip the output.
 */
export function sectionMarker(line: string): PlanSection | undefined {
  const match = MARKER_LINE.exec(line.trim())
  if (!match) return undefined

  const name = match[1] ?? match[2]
  return PLAN_SECTIONS.find((entry) => entry === name)
}

/** The spelling a finding names, which is the one the standard's template ships. */
export function preferredMarker(section: PlanSection): string {
  return `## ${section}`
}

export function splitPlanSections(text: string): Map<string, string[]> {
  const sections = new Map<string, string[]>()
  let current: string | undefined

  for (const line of linesOutsideFences(text)) {
    // Any marker-shaped line closes the section above it, and only a recognized
    // one opens a section. A plan carrying a label of its own would otherwise
    // collect its bullets into whichever section came before.
    if (MARKER_LINE.test(line.trim())) {
      current = sectionMarker(line)
      if (current) sections.set(current, [])
      continue
    }

    if (current) sections.get(current)?.push(line)
  }

  return sections
}

interface Question {
  readonly label: string
  readonly body: readonly string[]
}

export function readQuestions(lines: readonly string[]): Question[] {
  const questions: { label: string; body: string[] }[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (QUESTION_ITEM.test(trimmed)) {
      questions.push({ label: trimmed, body: [] })
      continue
    }

    questions.at(-1)?.body.push(trimmed)
  }

  return questions
}

function shorten(label: string): string {
  return label.length > 60 ? `${label.slice(0, 57)}...` : label
}

const SUGGESTED_PREFIX = '- Suggested:'
const ANSWER_PREFIX = '- Answer:'

function checkQuestionContract(name: string, lines: string[]): Finding[] {
  if (lines.some((line) => line.trim() === NONE_IDENTIFIED)) return []

  const findings: Finding[] = []

  for (const question of readQuestions(lines)) {
    const subject = shorten(question.label)
    const suggested = question.body.find((line) =>
      line.startsWith(SUGGESTED_PREFIX),
    )
    const answer = question.body.find((line) => line.startsWith(ANSWER_PREFIX))

    if (!suggested) {
      findings.push(
        finding(
          'suggestion-missing',
          name,
          subject,
          'carries no Suggested line, so it arrives at execution as a stop.',
        ),
      )
    }

    if (!answer) {
      findings.push(
        finding(
          'question-unanswerable',
          name,
          subject,
          'carries no Answer slot, so the blank-answer default has nowhere to sit.',
        ),
      )
    }

    if (
      suggested &&
      answer &&
      answer.slice(ANSWER_PREFIX.length).trim() === ''
    ) {
      const text = suggested.slice(SUGGESTED_PREFIX.length).trim()
      const normalized = normalizeOperatorCall(text)

      if (
        normalized.toLowerCase().startsWith(OPERATOR_CALL) &&
        !text.toLowerCase().startsWith(OPERATOR_CALL)
      ) {
        findings.push(
          finding(
            'operator-call-phrasing',
            name,
            subject,
            'defers to the operator over a blank Answer without opening with the canonical needs your call, so a paraphrase reaches the corpus instead of the fixed spelling.',
          ),
        )
      }
    }
  }

  return findings
}

const SOURCE_LINK = /\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/\S+/
const SOURCE_QUOTE = /["“][^"“”]+["”]/
const SOURCE_UNVERIFIED = /\bunverified\b/i

/**
 * A bullet opens an entry only at the section's shallowest indent, so a nested
 * bullet and a wrapped line both belong to the entry above. Joining them first
 * lets a passage wrap across lines and still count as quoted.
 */
function readSourceEntries(lines: readonly string[]): string[] {
  const entries: string[] = []
  let depth: number | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    const indent = line.length - line.trimStart().length
    const opensEntry =
      trimmed.startsWith('- ') && (depth === undefined || indent <= depth)

    if (opensEntry) {
      depth = indent
      entries.push(trimmed)
      continue
    }

    if (entries.length > 0) entries[entries.length - 1] += ` ${trimmed}`
  }

  return entries
}

function checkSources(name: string, lines: readonly string[]): Finding[] {
  return readSourceEntries(lines)
    .filter((entry) => entry !== `- ${NONE_IDENTIFIED}`)
    .filter(
      (entry) =>
        !SOURCE_LINK.test(entry) ||
        !(SOURCE_QUOTE.test(entry) || SOURCE_UNVERIFIED.test(entry)),
    )
    .map((entry) =>
      finding(
        'source-unquoted',
        name,
        shorten(entry),
        'carries no link, or a link with neither a double-quoted passage nor the word unverified.',
      ),
    )
}

export function checkPlan(name: string, text: string): Finding[] {
  const findings: Finding[] = []

  if (!PLAN_NAME.test(name)) {
    findings.push(
      finding(
        'name-malformed',
        name,
        name,
        'is not named feature-<slug>.md with a kebab-case slug.',
      ),
    )
  }

  const lines = linesOutsideFences(text)

  if (!lines.some((line) => PLAN_TITLE.test(line))) {
    findings.push(
      finding('title-missing', name, name, 'opens with no # Feature: heading.'),
    )
  }

  const sections = splitPlanSections(text)

  for (const marker of PLAN_REQUIRED) {
    if (!sections.has(marker)) {
      findings.push(
        finding(
          'section-missing',
          name,
          preferredMarker(marker),
          'is required and the plan carries no such section.',
        ),
      )
    }
  }

  if (
    !sections.has('Design references') &&
    touchesRenderedSurface(sections.get('Files to touch') ?? [])
  ) {
    findings.push(
      finding(
        'section-missing',
        name,
        preferredMarker('Design references'),
        'is required when Files to touch names a rendered-surface file. Write None identified. when no reference folder governs it.',
      ),
    )
  }

  for (const line of sections.get('Files to touch') ?? []) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('- ') || trimmed === `- ${NONE_IDENTIFIED}`)
      continue

    if (!statesReason(trimmed)) {
      findings.push(
        finding(
          'entry-unreasoned',
          name,
          shorten(trimmed),
          'names no file, or names one and says nothing about it.',
        ),
      )
    }
  }

  findings.push(...checkQuestionContract(name, sections.get('Questions') ?? []))
  findings.push(...checkSources(name, sections.get('Sources') ?? []))

  if (hasStagedBatches(text)) {
    const staged = linesOutsideFences(text).find((line) =>
      BATCH_LABEL.test(line.trim()),
    )

    findings.push(
      finding(
        'batch-unsplit',
        name,
        shorten((staged ?? '').trim()),
        "stages a batch inside one file, so the batch sharing this plan's branch has nothing left to open a pull request against once an earlier one merges. Split it into one plan file per batch.",
      ),
    )
  }

  return findings
}

const DATE_FIELD = /^date:[ \t]*'?"?(\d{4}-\d{2}-\d{2})'?"?[ \t]*$/m

/**
 * Reads the opening date off the raw block rather than the parsed fields. A YAML
 * parser resolves an unquoted `YYYY-MM-DD` to a date value on the core schema
 * and to a string elsewhere, and a check keyed on the parsed type would report a
 * conforming file on one runtime and not the other.
 */
function hasOpeningDate(raw: string): boolean {
  return DATE_FIELD.test(raw)
}

async function checkFolderFrontmatter(
  dir: string,
  slug: string,
  files: readonly string[],
  indexFile: string,
): Promise<Finding[]> {
  const perFile = await Promise.all(
    files.map(async (file) => {
      const found: Finding[] = []
      const frontmatter = parseFrontmatter(
        await readFile(join(dir, file), 'utf8'),
      )

      const missing = ['title', 'description'].filter(
        (field) => !readField(frontmatter, field),
      )

      if (missing.length > 0) {
        found.push(
          finding(
            'frontmatter-incomplete',
            slug,
            file,
            `carries no ${missing.join(' and no ')}.`,
          ),
        )
      }

      if (file === indexFile && !hasOpeningDate(frontmatter?.raw ?? '')) {
        found.push(
          finding(
            'date-malformed',
            slug,
            file,
            'carries no date field as YYYY-MM-DD, so the folder states no opening day.',
          ),
        )
      }

      if (file !== indexFile && !NUMBERED_FILE.test(file)) {
        found.push(
          finding(
            'name-malformed',
            slug,
            file,
            'is not numbered NN-<name>.md, so the folder has no read order.',
          ),
        )
      }

      return found
    }),
  )

  return perFile.flat()
}

const GROUNDWORK_INDEX = 'README.md'
const GROUNDWORK_STATE = '01-current-state.md'
const GROUNDWORK_DECISION = '06-'
const GROUNDWORK_HANDOFF = '07-'

async function checkTrack(dir: string, slug: string): Promise<Finding[]> {
  const files = await listMarkdown(dir)
  const findings: Finding[] = []

  if (!files.includes(GROUNDWORK_INDEX)) {
    findings.push(
      finding(
        'index-missing',
        slug,
        GROUNDWORK_INDEX,
        'is absent, so the track carries no file map and no reason it is running.',
      ),
    )
  }

  if (!files.includes(GROUNDWORK_STATE)) {
    findings.push(
      finding(
        'state-missing',
        slug,
        GROUNDWORK_STATE,
        'is absent, so the track states no measured current state.',
      ),
    )
  }

  // A track closes on the decision and the handoff together. One without the
  // other reads as closed to anyone scanning filenames and strands the half a
  // returning session actually opens.
  const decided = files.some((file) => file.startsWith(GROUNDWORK_DECISION))
  const handed = files.some((file) => file.startsWith(GROUNDWORK_HANDOFF))

  if (decided !== handed) {
    findings.push(
      finding(
        'closing-partial',
        slug,
        decided ? GROUNDWORK_HANDOFF : GROUNDWORK_DECISION,
        `is absent while ${decided ? '06' : '07'} is present, so the track is neither live nor closed.`,
      ),
    )
  }

  findings.push(
    ...(await checkFolderFrontmatter(dir, slug, files, GROUNDWORK_INDEX)),
  )

  return findings
}

const INTAKE_INDEX = '00-overview.md'
const INTAKE_HANDOFF = '99-next-session.md'

const ITEM_HEADING = /^###[ \t]+\S/
const ITEM_REQUIRED = ['Problem', 'Fix', 'Worth it', 'You'] as const

function bulletLabel(line: string): string | undefined {
  const match = /^-[ \t]+\*\*([^:*]+):\*\*/.exec(line.trim())
  return match ? match[1].trim() : undefined
}

export function checkItems(
  slug: string,
  file: string,
  text: string,
): Finding[] {
  const findings: Finding[] = []
  const items: { heading: string; labels: string[] }[] = []

  for (const line of linesOutsideFences(text)) {
    if (ITEM_HEADING.test(line)) {
      items.push({ heading: line.trim().replace(/^###[ \t]+/, ''), labels: [] })
      continue
    }

    const label = bulletLabel(line)
    if (label) items.at(-1)?.labels.push(label)
  }

  for (const item of items) {
    const missing = ITEM_REQUIRED.filter(
      (label) => !item.labels.includes(label),
    )

    if (missing.length > 0) {
      findings.push(
        finding(
          'item-incomplete',
          slug,
          `${file}: ${shorten(item.heading)}`,
          `states no ${missing.join(', no ')}.`,
        ),
      )
    }

    if (item.labels.includes('Open') && !item.labels.includes('Suggested')) {
      findings.push(
        finding(
          'suggestion-missing',
          slug,
          `${file}: ${shorten(item.heading)}`,
          'asks an open question and suggests nothing, so a bare answer decides it.',
        ),
      )
    }
  }

  return findings
}

async function checkDump(dir: string, slug: string): Promise<Finding[]> {
  const files = await listMarkdown(dir)
  const findings: Finding[] = []

  if (!files.includes(INTAKE_INDEX)) {
    findings.push(
      finding(
        'index-missing',
        slug,
        INTAKE_INDEX,
        'is absent, so the dump carries no cluster table and no verdict counts.',
      ),
    )
  }

  findings.push(
    ...(await checkFolderFrontmatter(dir, slug, files, INTAKE_INDEX)),
  )

  // The two reserved files hold no items. Running the item check over the
  // handoff would report every heading it carries as a malformed item.
  const clusters = files.filter(
    (file) => file !== INTAKE_INDEX && file !== INTAKE_HANDOFF,
  )

  const perCluster = await Promise.all(
    clusters.map(async (file) =>
      checkItems(slug, file, await readFile(join(dir, file), 'utf8')),
    ),
  )

  return [...findings, ...perCluster.flat()]
}

/**
 * The two kinds whose records are folders rather than files. Keyed by kind so
 * a third arrives as an entry here and the compiler names the walk it owes,
 * where a ternary chain would silently fall through to whichever branch is last.
 */
const FOLDER_CHECK: Readonly<
  Record<
    Exclude<RecordKind, 'plans' | 'sessions'>,
    (dir: string, slug: string) => Promise<Finding[]>
  >
> = {
  groundwork: checkTrack,
  intake: checkDump,
}

/**
 * The files of a folder record the structure report reads. A groundwork
 * track's `evidence/`, `scripts/`, and `clones/` sit below the top level and
 * hold copies and raw output, so only its index and numbered files are read.
 * An intake folder's reserved files hold no items, so only clusters are.
 */
const STRUCTURE_FILES: Readonly<
  Partial<Record<RecordKind, (file: string) => boolean>>
> = {
  groundwork: (file) => file === GROUNDWORK_INDEX || NUMBERED_FILE.test(file),
  intake: (file) => file !== INTAKE_INDEX && file !== INTAKE_HANDOFF,
}

async function folderStructure(
  dir: string,
  kind: RecordKind,
  slug: string,
): Promise<StructureFinding[]> {
  const reads = STRUCTURE_FILES[kind]
  if (!reads) return []

  const report = kind === 'intake' ? intakeStructure : structureFindings
  const files = (await listMarkdown(dir)).filter(reads)
  const perFile = await Promise.all(
    files.map(async (file) =>
      report(await readFile(join(dir, file), 'utf8')).map((entry) => ({
        ...entry,
        record: slug,
        subject: file,
      })),
    ),
  )

  return perFile.flat()
}

function refuse(reason: ValidateRefusal, message: string): ValidateRefused {
  return { ok: false, reason, message }
}

/** The walk for a kind whose records are files in one flat folder. */
async function validateFiles(
  dir: string,
  kind: RecordKind,
  files: readonly string[],
  check: (name: string, text: string) => Finding[],
): Promise<ValidateReport> {
  const perFile = await Promise.all(
    files.map(async (file) => {
      const text = await readFile(join(dir, file), 'utf8')
      return {
        findings: check(file, text),
        structure: structureFindings(text).map((entry) => ({
          ...entry,
          record: file,
          subject: file,
        })),
      }
    }),
  )

  return {
    ok: true,
    kind,
    records: files.length,
    findings: perFile.flatMap((one) => one.findings),
    structure: perFile.flatMap((one) => one.structure),
  }
}

/**
 * The walk for session maps, which measures length alone. Their shape is not
 * checked, so `findings` stays empty and the exit stays clean whatever the
 * count reads.
 */
async function validateSessionMaps(
  dir: string,
  files: readonly string[],
): Promise<ValidateReport> {
  const length = await Promise.all(
    files.map(async (file) =>
      measureSessionMap(file, await readFile(join(dir, file), 'utf8')),
    ),
  )

  return {
    ok: true,
    kind: 'sessions',
    records: files.length,
    findings: [],
    structure: [],
    length,
  }
}

async function listRecords(dir: string, kind: RecordKind): Promise<string[]> {
  if (kind === 'plans') return listMarkdown(dir)
  if (kind === 'sessions') return (await listMarkdown(dir)).filter(isSessionMap)
  return listFolders(dir)
}

/**
 * Narrows a listing to the one record a caller named, by a plan's stem or a
 * folder's slug, so a writing skill reads its own record and not every old one.
 */
function narrow(
  names: readonly string[],
  record: string | undefined,
): readonly string[] {
  if (record === undefined) return names
  return names.filter((name) => name === record || name === `${record}.md`)
}

/**
 * Reports what every record in one folder claims against the shape its reference
 * fixes. It writes nothing, since a session record is per-machine scratch with
 * no history behind it, so a repair that guessed wrong could not be undone.
 */
export async function validateRecords(
  root: string,
  kind: RecordKind,
  record?: string,
): Promise<ValidateOutcome> {
  const dir = recordsDir(root, kind)

  if (!existsSync(dir)) {
    return refuse(
      'no-folder',
      `No ${kind} folder at ${recordDirs(root, kind).join(' or ')}.`,
    )
  }

  const names = narrow(await listRecords(dir, kind), record)

  if (record !== undefined && names.length === 0) {
    return refuse('no-record', `No ${kind} record named ${record} in ${dir}.`)
  }

  if (kind === 'plans') return validateFiles(dir, kind, names, checkPlan)
  if (kind === 'sessions') return validateSessionMaps(dir, names)

  const check = FOLDER_CHECK[kind]
  const perFolder = await Promise.all(
    names.map(async (slug) => ({
      findings: await check(join(dir, slug), slug),
      structure: await folderStructure(join(dir, slug), kind, slug),
    })),
  )

  return {
    ok: true,
    kind,
    records: names.length,
    findings: perFolder.flatMap((one) => one.findings),
    structure: perFolder.flatMap((one) => one.structure),
  }
}
