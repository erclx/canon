import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { checkBundles, type BundleReport } from '@/intake/bundles'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { linesOutsideFences } from '@/markdown/scan'
import {
  checkCeiling,
  documentReader,
  splitAtColon,
  type ReadDocument,
} from '@/records/ceiling'
import {
  type CallersRoot,
  checkCallers,
  readCallersRoot,
} from '@/records/callers'
import {
  checkCounterparts,
  type CounterpartRoot,
  readCounterpartRoot,
} from '@/records/counterpart'
import {
  checkDeferrals,
  type DeferralRoot,
  readDeferralRoot,
} from '@/records/deferred'
import {
  isSessionMap,
  measureSessionMap,
  type SessionMapLength,
} from '@/records/session-map'
import {
  driveLogStructure,
  groundworkStructure,
  intakeStructure,
  planStructure,
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
 * `unknown-kind` is raised at the argument boundary rather than by the walk, and sits here
 * because both reach a caller through the same `reason` field.
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
  'verification-load-unconfined',
  'design-reference-unclassified',
  'stack-foldable',
  'fan-in-unmatched',
  'counterpart-unstated',
  'counterpart-malformed',
  'callers-unstated',
  'callers-malformed',
  'deferral-unfiled',
  'ceiling-unstated',
  'bundle-unshared',
  'evidence-missing',
  'evidence-unresolved',
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
   * Each plan question's Evidence line, carried by the plans kind alone. It
   * never sets the exit, since every plan written before the line misses it.
   */
  readonly evidence?: readonly Finding[]
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
 * The suggestion the plan standard fixes for a question that turns on the operator's
 * preference. `src/tasks/answers.ts` reads it so the two checks recognize the same spellings.
 */
export const OPERATOR_CALL = 'needs your call'

/**
 * The two paraphrases of `OPERATOR_CALL`, longer variant first, since `operator's call` is a
 * substring of `the operator's call`.
 */
const OPERATOR_CALL_PHRASES = [
  "the operator's call",
  "operator's call",
] as const

/**
 * Reads a recognized paraphrase as the canonical phrase, so `startsWith(OPERATOR_CALL)` sees one
 * spelling. Case-insensitive, and it short-circuits on an already-canonical opening so a later
 * paraphrase in the reason is not garbled.
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
 * Reads the raw text rather than `splitPlanSections`'s output, since a `**Batch 1: ...**` line
 * is a `MARKER_LINE` and is already dropped from the split section.
 */
export function hasStagedBatches(text: string): boolean {
  return linesOutsideFences(text).some((line) => BATCH_LABEL.test(line.trim()))
}

/**
 * An entry names a file and says something about it, tested as facts rather than syntax: a
 * backticked span anywhere, and prose left once the spans are removed. The corpus writes
 * `- Label: prose naming a path` as often as `- path: reason`.
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
  'Counterparts',
  'Callers',
  'Deferred',
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
 * The files whose edit changes what a person sees: the `ui/a11y` and `ui/keyboard` globs plus
 * other markup and style extensions. A set too wide forces `Design references` on every plan.
 */
export const RENDERED_SURFACE = /\.(?:tsx|jsx|astro|vue|svelte|html|css|scss)$/

export function touchesRenderedSurface(entries: readonly string[]): boolean {
  return entries.some((entry) =>
    [...splitAtColon(entry)[0].matchAll(/`([^`]+)`/g)].some(
      (span) => !span[1].includes('*') && RENDERED_SURFACE.test(span[1]),
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
 * A section opens as a bold label or as an H2 and both count, since the corpus swaps one for
 * the other and reporting the variant would fail nearly every plan.
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
    // Any marker-shaped line closes the section above, so a label never collects bullets into it.
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
const EVIDENCE_PREFIX = '- Evidence:'
const ANSWER_PREFIX = '- Answer:'
const EVIDENCE_NONE = /^none,\s*\S/i
const LOCATION_SUFFIX = /(?::\d+(?:-\d+)?)+$|#L\d+(?:-L?\d+)?$/
const REVISION_PREFIX = /^[0-9a-f]{7,40}:/
const FILE_EXTENSIONS = new Set([
  'astro',
  'cjs',
  'css',
  'go',
  'html',
  'js',
  'json',
  'jsx',
  'lock',
  'md',
  'mjs',
  'php',
  'png',
  'py',
  'sh',
  'svelte',
  'svg',
  'toml',
  'ts',
  'tsx',
  'txt',
  'vue',
  'yaml',
  'yml',
])

/** Answers whether a project-relative path exists, a file or a folder alike. */
export type PathExists = (rel: string) => boolean

/**
 * A span reads as a path only when its first segment exists at the root, or a
 * bare name carries a known extension, so a command, ref, symbol, or alias is
 * checked for shape alone. Running a cited command would write.
 */
function citedPath(span: string, pathExists: PathExists): string | undefined {
  if (/[\s<>*]/.test(span)) return undefined

  const path = span
    .replace(REVISION_PREFIX, '')
    .replace(LOCATION_SUFFIX, '')
    .replace(/^\.\//, '')
    .replace(/\/$/, '')
  const [first] = path.split('/')

  if (path.includes('/')) {
    return first !== '' && pathExists(first) ? path : undefined
  }

  const extension = path.split('.').at(-1)?.toLowerCase() ?? ''
  return path.includes('.') && FILE_EXTENSIONS.has(extension) ? path : undefined
}

function checkEvidence(
  name: string,
  subject: string,
  body: readonly string[],
  pathExists?: PathExists,
): Finding[] {
  const line = body.find((entry) => entry.startsWith(EVIDENCE_PREFIX))
  const text = line?.slice(EVIDENCE_PREFIX.length).trim() ?? ''
  const spans = [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1])

  if (!EVIDENCE_NONE.test(text) && spans.length === 0) {
    return [
      finding(
        'evidence-missing',
        name,
        subject,
        'carries no Evidence line citing a command or path in a code span, or none with a reason, so its claim reaches the build unchecked.',
      ),
    ]
  }

  if (!pathExists) return []

  return spans
    .map((span) => citedPath(span, pathExists))
    .filter((path): path is string => path !== undefined)
    .filter((path) => !pathExists(path))
    .map((path) =>
      finding(
        'evidence-unresolved',
        name,
        subject,
        `cites ${path} as evidence, and no such path exists in the project.`,
      ),
    )
}

/**
 * Reads each question's Evidence line apart from `checkPlan`, so a plan
 * written before the line reports it without failing the exit or the examples
 * gate. Left without `pathExists`, a cited path is checked for shape alone.
 */
export function checkPlanEvidence(
  name: string,
  text: string,
  pathExists?: PathExists,
): Finding[] {
  const lines = splitPlanSections(text).get('Questions') ?? []
  if (lines.some((line) => line.trim() === NONE_IDENTIFIED)) return []

  return readQuestions(lines).flatMap((question) =>
    checkEvidence(name, shorten(question.label), question.body, pathExists),
  )
}

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

const LOAD_GENERATOR =
  /\b\d+\s+(?:[a-z]+[ -])?(?:hogs?|busy[ -]loops?)\b|\bstress-ng\s+-/i
const LOAD_PINNED = /\btaskset\b|\bmacos\b/i
const LOAD_BOUNDED = /\bg?timeout\b/

/**
 * Keys on a launched generator, a digit count beside the word or `stress-ng` with arguments.
 * Confined takes a `timeout` bound and a `taskset` pin, where naming macOS waives the pin.
 */
function checkVerification(name: string, lines: readonly string[]): Finding[] {
  return readSourceEntries(lines)
    .filter(
      (entry) =>
        LOAD_GENERATOR.test(entry) &&
        !(LOAD_PINNED.test(entry) && LOAD_BOUNDED.test(entry)),
    )
    .map((entry) =>
      finding(
        'verification-load-unconfined',
        name,
        shorten(entry),
        'names generated machine load without both a taskset pin and a timeout bound, per the Timing bullet of canon:systematic-debugging.',
      ),
    )
}

const DESIGN_FOLDER = /`[^`]*canon\/design\/[^`]*`/
const DESIGN_ROLE = /^(?:built against|redrawn)\b/i

/**
 * The role is read after the first colon outside a code span, so a path
 * carrying a colon cannot end the label early. The check sees that a role is
 * stated and never whether it is the right one.
 */
function statesDesignRole(entry: string): boolean {
  const masked = entry.replace(/`[^`]*`/g, (span) => 'x'.repeat(span.length))
  const colon = masked.indexOf(':')
  if (colon === -1) return false

  return DESIGN_ROLE.test(entry.slice(colon + 1).trim())
}

function checkDesignReferences(
  name: string,
  lines: readonly string[],
): Finding[] {
  return readSourceEntries(lines)
    .filter((entry) => DESIGN_FOLDER.test(entry) && !statesDesignRole(entry))
    .map((entry) =>
      finding(
        'design-reference-unclassified',
        name,
        shorten(entry),
        'opens on neither built against nor redrawn after its colon, so the builder cannot tell whether the change leaves this folder true or owes it a redraw.',
      ),
    )
}

/**
 * `counterpart`, `callers`, and `deferrals` are the roots each section's check
 * reads. Left out, as in a project with no stack, no shipped skills, or no
 * board, the plan owes that section nothing.
 */
export function checkPlan(
  name: string,
  text: string,
  counterpart?: CounterpartRoot,
  readDocument?: ReadDocument,
  callers?: CallersRoot,
  deferrals?: DeferralRoot,
): Finding[] {
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

  if (counterpart) {
    findings.push(
      ...checkCounterparts(
        sections.get('Files to touch') ?? [],
        sections.get('Counterparts'),
        counterpart,
      ).map((found) => finding(found.kind, name, found.subject, found.message)),
    )
  }

  if (callers) {
    findings.push(
      ...checkCallers(
        sections.get('Files to touch') ?? [],
        sections.get('Callers'),
        callers,
      ).map((found) => finding(found.kind, name, found.subject, found.message)),
    )
  }

  if (deferrals) {
    findings.push(
      ...checkDeferrals(sections.get('Deferred'), deferrals).map((found) =>
        finding(found.kind, name, found.subject, found.message),
      ),
    )
  }

  if (readDocument) {
    findings.push(
      ...checkCeiling(sections.get('Files to touch') ?? [], readDocument).map(
        (found) => finding(found.kind, name, found.subject, found.message),
      ),
    )
  }

  findings.push(...checkQuestionContract(name, sections.get('Questions') ?? []))
  findings.push(...checkSources(name, sections.get('Sources') ?? []))
  findings.push(...checkVerification(name, sections.get('Verification') ?? []))
  findings.push(
    ...checkDesignReferences(name, sections.get('Design references') ?? []),
  )

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
 * Reads the opening date off the raw block rather than the parsed fields, since a YAML parser
 * resolves an unquoted date differently by schema and a check on the type would differ by runtime.
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
const GROUNDWORK_PAUSE = '99-next-session.md'

export async function checkTrack(
  dir: string,
  slug: string,
): Promise<Finding[]> {
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

  // A track closes on its decision alone, so a legacy handoff or a pause note reads as neither.
  const decided = files.some((file) => file.startsWith(GROUNDWORK_DECISION))
  const handed = files.some((file) => file.startsWith(GROUNDWORK_HANDOFF))

  if (handed && !decided) {
    findings.push(
      finding(
        'closing-partial',
        slug,
        GROUNDWORK_DECISION,
        'is absent while 07 is present, so the track is neither live nor closed.',
      ),
    )
  }

  if (decided && files.includes(GROUNDWORK_PAUSE)) {
    findings.push(
      finding(
        'closing-partial',
        slug,
        GROUNDWORK_PAUSE,
        'is present beside 06, so a closed track still carries the note for resuming it.',
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

/** The bundle rows of an intake folder read against its cluster files, or nothing when it has no overview. */
async function readBundles(
  dir: string,
  files: readonly string[],
): Promise<BundleReport> {
  if (!files.includes(INTAKE_INDEX)) return { unshared: [], unresolved: [] }

  const clusters = new Map(
    await Promise.all(
      files
        .filter((file) => file !== INTAKE_INDEX && file !== INTAKE_HANDOFF)
        .map(
          async (file) =>
            [file, await readFile(join(dir, file), 'utf8')] as const,
        ),
    ),
  )

  return checkBundles(await readFile(join(dir, INTAKE_INDEX), 'utf8'), clusters)
}

export async function checkDump(dir: string, slug: string): Promise<Finding[]> {
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

  // The two reserved files hold no items, so the item check would report each heading as malformed.
  const clusters = files.filter(
    (file) => file !== INTAKE_INDEX && file !== INTAKE_HANDOFF,
  )

  const perCluster = await Promise.all(
    clusters.map(async (file) =>
      checkItems(slug, file, await readFile(join(dir, file), 'utf8')),
    ),
  )

  const bundles = await readBundles(dir, files)
  const unshared = bundles.unshared.map((row) =>
    finding(
      'bundle-unshared',
      slug,
      `${INTAKE_INDEX}: ${row.name}`,
      row.message,
    ),
  )

  return [...findings, ...perCluster.flat(), ...unshared]
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
 * The files of a folder record the structure report reads. A groundwork track's `evidence/`,
 * `scripts/`, and `clones/` hold raw output, and an intake folder's reserved files hold no items.
 */
const STRUCTURE_FILES: Readonly<
  Partial<Record<RecordKind, (file: string) => boolean>>
> = {
  groundwork: (file) => file === GROUNDWORK_INDEX || NUMBERED_FILE.test(file),
  intake: (file) => file !== INTAKE_INDEX && file !== INTAKE_HANDOFF,
}

/**
 * An app drive's log, under an intake folder's `evidence/`, holding findings as headings and
 * fields. It reads on the plain criteria with a labeled field exempt from `S4`, and without
 * the cluster-only checks.
 */
const DRIVE_LOG = 'evidence/drive-log.md'

async function folderStructure(
  dir: string,
  kind: RecordKind,
  slug: string,
): Promise<StructureFinding[]> {
  const reads = STRUCTURE_FILES[kind]
  if (!reads) return []

  const report =
    kind === 'intake'
      ? intakeStructure
      : kind === 'groundwork'
        ? groundworkStructure
        : structureFindings
  const files = (await listMarkdown(dir)).filter(reads)
  const reports = files.map((file) => ({ file, read: report }))
  if (kind === 'intake' && existsSync(join(dir, DRIVE_LOG))) {
    reports.push({ file: DRIVE_LOG, read: driveLogStructure })
  }

  const perFile = await Promise.all(
    reports.map(async ({ file, read }) =>
      read(await readFile(join(dir, file), 'utf8')).map((entry) => ({
        ...entry,
        record: slug,
        subject: file,
      })),
    ),
  )

  const unresolved =
    kind === 'intake'
      ? (await readBundles(dir, await listMarkdown(dir))).unresolved.map(
          (row) => ({
            criterion: 'bundle-unresolved' as const,
            line: row.line,
            message: row.message,
            record: slug,
            subject: INTAKE_INDEX,
          }),
        )
      : []

  return [...perFile.flat(), ...unresolved]
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
  report: (text: string) => StructureEntry[],
  evidence?: (name: string, text: string) => Finding[],
): Promise<ValidateReport> {
  const perFile = await Promise.all(
    files.map(async (file) => {
      const text = await readFile(join(dir, file), 'utf8')
      return {
        findings: check(file, text),
        evidence: evidence?.(file, text) ?? [],
        structure: report(text).map((entry) => ({
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
    ...(evidence && { evidence: perFile.flatMap((one) => one.evidence) }),
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

  if (kind === 'plans') {
    const counterpart = await readCounterpartRoot(root)
    const callers = readCallersRoot(root)
    const deferrals = await readDeferralRoot(root)
    return validateFiles(
      dir,
      kind,
      names,
      (name, text) =>
        checkPlan(
          name,
          text,
          counterpart,
          documentReader(root),
          callers,
          deferrals,
        ),
      planStructure,
      (name, text) =>
        checkPlanEvidence(name, text, (rel) => existsSync(join(root, rel))),
    )
  }
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
