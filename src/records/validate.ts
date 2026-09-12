import { existsSync, statSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseFrontmatter, readField } from '@/indexes/frontmatter'
import { linesOutsideFences } from '@/markdown/scan'
import {
  recordDir as resolveRecordDir,
  recordDirs as resolveRecordDirs,
} from '@/record-root'
import {
  TEACH_GLOSSARY,
  TEACH_MISSION,
  TEACH_RECORDS,
  TEACH_REFERENCE,
  TEACH_RESOURCES,
  TEACH_SUCCESS_HEADING,
  WORKSPACE_NAME,
} from '@/teach/workspace'

export const RECORD_KINDS = [
  'plans',
  'groundwork',
  'intake',
  'memory',
  'standards',
  'teach',
] as const

export type RecordKind = (typeof RECORD_KINDS)[number]

/**
 * The folders standards reads, in precedence order.
 *
 * It carries two because the corpus authors at the project root and installs
 * under `.claude/`. The authoring root wins where both exist, since the
 * installed tree is a generated copy here and a finding fixed there is
 * overwritten by the next regen. A project that consumed the corpus holds only
 * the second, so one order serves both.
 *
 * Every other kind is a session record and takes the record roots instead,
 * resolved by `@/record-root`. Standards is the one kind that is tracked, so it
 * does not move and spells its own two candidates here.
 */
const STANDARDS_FOLDERS: readonly string[] = [
  'standards',
  join('.claude', 'standards'),
]

/**
 * `unknown-kind` is raised at the argument boundary rather than by the walk, and
 * it sits here because both reach a caller through the same `reason` field. A
 * union covering only what the walk returns would type a record the command can
 * emit as impossible.
 */
export const VALIDATE_REFUSALS = ['no-folder', 'unknown-kind'] as const

export type ValidateRefusal = (typeof VALIDATE_REFUSALS)[number]

export const FINDING_KINDS = [
  'name-malformed',
  'title-missing',
  'title-is-slug',
  'section-missing',
  'scope-unanchored',
  'entry-unreasoned',
  'suggestion-missing',
  'question-unanswerable',
  'frontmatter-incomplete',
  'date-malformed',
  'index-missing',
  'state-missing',
  'closing-partial',
  'item-incomplete',
  'category-mismatch',
  'operator-call-phrasing',
  'batch-unsplit',
] as const

export type FindingKind = (typeof FINDING_KINDS)[number]

/**
 * The transforms `migrate.ts` carries. Most finding kinds have none, since a
 * transform is only safe where the old shape is recoverable from the file
 * itself, so this stays optional on `Finding` rather than required.
 */
export const FINDING_REMEDIES = ['category-from-name'] as const

export type FindingRemedy = (typeof FINDING_REMEDIES)[number]

export interface Finding {
  readonly kind: FindingKind
  /** The record the finding sits in, relative to the validated folder. */
  readonly record: string
  readonly subject: string
  readonly message: string
  readonly remedy?: FindingRemedy
}

export interface ValidateReport {
  readonly ok: true
  readonly kind: RecordKind
  readonly records: number
  readonly findings: readonly Finding[]
}

export interface ValidateRefused {
  readonly ok: false
  readonly reason: ValidateRefusal
  readonly message: string
}

export type ValidateOutcome = ValidateReport | ValidateRefused

/** Every folder a kind would accept, whether or not it is on disk. */
export function recordDirs(root: string, kind: RecordKind): string[] {
  if (kind === 'standards') {
    return STANDARDS_FOLDERS.map((folder) => join(root, folder))
  }

  return resolveRecordDirs(root, kind)
}

/**
 * The folder a kind reads. The first candidate on disk wins, and the creation
 * default stands in when none exists, so a refusal and a test fixture both name
 * the location the kind would be written to.
 *
 * The default is where this parts company with `dirs[0]`, which the record
 * kinds can no longer take: their first candidate is the root the move lands at
 * and nothing creates there yet, so a fallback reading it would name a folder no
 * verb would ever write. Standards has no such split, since it is tracked and
 * its first candidate is where it is authored.
 */
export function recordsDir(root: string, kind: RecordKind): string {
  if (kind === 'standards') {
    const dirs = recordDirs(root, kind)
    return dirs.find((dir) => existsSync(dir)) ?? dirs[0]
  }

  return resolveRecordDir(root, kind)
}

export function isRecordKind(value: string): value is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(value)
}

/**
 * Whether a kind's folder is shared session scratch at the main worktree root.
 *
 * The five record folders are, so every session validates the records every
 * other session reads. The corpus is tracked instead, so a linked worktree holds
 * its own edited copy, and defaulting that kind to the main root would report on
 * a tree the session never touched and say nothing about which one it read.
 */
export function isSharedScratch(kind: RecordKind): boolean {
  return kind !== 'standards'
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
  remedy?: FindingRemedy,
): Finding {
  return { kind, record, subject, message, remedy }
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
  'Constraints',
  'Files to touch',
  'Risks',
  'Questions',
] as const

type PlanSection = (typeof PLAN_SECTIONS)[number]

const PLAN_REQUIRED: readonly PlanSection[] = [
  'Summary',
  'Files to touch',
  'Risks',
  'Questions',
]

/**
 * A line standing alone as a bold label or an H2, whatever it names. A plan is
 * free to carry a section of its own, so the split has to see one to close the
 * section above it.
 */
const MARKER_LINE = /^(?:##[ \t]+(.+?)|\*\*(.+?):\*\*)[ \t]*$/

/**
 * A section opens as a bold label or as an H2 and both count. The corpus writes
 * `Summary` as a heading and the other four as bold labels, and roughly a fifth
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
  return section === 'Summary' ? '## Summary' : `**${section}:**`
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

const NUMBERED_RECORD = /^\d{4}-[a-z0-9]+(-[a-z0-9]+)*\.md$/
/**
 * A kebab slug that does not open with an ordinal. The lookahead rejects a
 * leading run of digits followed by a hyphen and nothing else, so a subject
 * whose own name starts with a digit still passes.
 */
const REFERENCE_NAME = /^(?!\d+-)[a-z0-9]+(-[a-z0-9]+)*\.md$/

/** The two fields every markdown file in a workspace carries. */
async function checkTeachFile(
  dir: string,
  slug: string,
  file: string,
  subject: string,
): Promise<Finding[]> {
  const frontmatter = parseFrontmatter(await readFile(join(dir, file), 'utf8'))

  const missing = ['title', 'description'].filter(
    (field) => !readField(frontmatter, field),
  )

  if (missing.length === 0) return []

  return [
    finding(
      'frontmatter-incomplete',
      slug,
      subject,
      `carries no ${missing.join(' and no ')}.`,
    ),
  ]
}

/**
 * One markdown subfolder of a workspace. `lessons/` and `assets/` are never
 * reached, because a lesson is generated markup carrying no frontmatter and a
 * walk over it would report every one as malformed.
 */
async function checkTeachSubfolder(
  dir: string,
  slug: string,
  folder: string,
  name: RegExp,
  message: string,
): Promise<Finding[]> {
  const path = join(dir, folder)

  // Tested as a directory rather than for presence. Every other walk in this
  // module takes its path from `listFolders`, and this one is built from a
  // fixed name, so a workspace holding a plain file called `reference` would
  // reach `readdir` and take the whole run down with `ENOTDIR`.
  if (!statSync(path, { throwIfNoEntry: false })?.isDirectory()) return []

  const files = await listMarkdown(path)

  const malformed = files
    .filter((file) => !name.test(file))
    .map((file) =>
      finding('name-malformed', slug, `${folder}/${file}`, message),
    )

  const perFile = await Promise.all(
    files.map((file) => checkTeachFile(path, slug, file, `${folder}/${file}`)),
  )

  return [...malformed, ...perFile.flat()]
}

async function checkWorkspace(dir: string, slug: string): Promise<Finding[]> {
  const findings: Finding[] = []

  if (!WORKSPACE_NAME.test(slug)) {
    findings.push(
      finding(
        'name-malformed',
        slug,
        slug,
        'is not named NN-<topic> with a two-digit ordinal, so a listing sorts alphabetically rather than by when each workspace opened.',
      ),
    )
  }

  const files = await listMarkdown(dir)

  if (!files.includes(TEACH_MISSION)) {
    findings.push(
      finding(
        'index-missing',
        slug,
        TEACH_MISSION,
        'is absent, so the workspace states no subject and no success to finish against.',
      ),
    )
  }

  for (const required of [TEACH_RESOURCES, TEACH_GLOSSARY]) {
    if (!files.includes(required)) {
      findings.push(
        finding(
          'section-missing',
          slug,
          required,
          'is required and the workspace carries no such file.',
        ),
      )
    }
  }

  const perFile = await Promise.all(
    files.map((file) => checkTeachFile(dir, slug, file, file)),
  )
  findings.push(...perFile.flat())

  if (files.includes(TEACH_MISSION)) {
    const text = await readFile(join(dir, TEACH_MISSION), 'utf8')

    if (!hasOpeningDate(parseFrontmatter(text)?.raw ?? '')) {
      findings.push(
        finding(
          'date-malformed',
          slug,
          TEACH_MISSION,
          'carries no date field as YYYY-MM-DD, so the workspace states no opening day.',
        ),
      )
    }

    if (
      !linesOutsideFences(text).some(
        (line) => line.trim() === TEACH_SUCCESS_HEADING,
      )
    ) {
      findings.push(
        finding(
          'section-missing',
          slug,
          TEACH_SUCCESS_HEADING,
          'is absent, so the mission names no observable thing the learner will be able to do.',
        ),
      )
    }
  }

  return [
    ...findings,
    ...(await checkTeachSubfolder(
      dir,
      slug,
      TEACH_REFERENCE,
      REFERENCE_NAME,
      'is not named <slug>.md as a kebab slug opening with no ordinal, so a page looked up rather than worked through implies an order no reader follows.',
    )),
    ...(await checkTeachSubfolder(
      dir,
      slug,
      TEACH_RECORDS,
      NUMBERED_RECORD,
      'is not numbered NNNN-<slug>.md, so the records carry no read order.',
    )),
  ]
}

const MEMORY_INDEX = 'index.md'
const MEMORY_FIELDS = ['title', 'description', 'category'] as const

/**
 * The filename prefix and the `category` field are one fact in two spellings,
 * so the map is the whole type list and the comparison against it is what
 * catches a prefix outside the set, a field disagreeing with the prefix, and a
 * casing drift that would open a second group in the catalog.
 */
export const CATEGORY_BY_TYPE = {
  feedback: 'Feedback',
  project: 'Project',
  user: 'User',
  reference: 'Reference',
} as const

export type MemoryType = keyof typeof CATEGORY_BY_TYPE

const MEMORY_TYPES = Object.keys(CATEGORY_BY_TYPE) as readonly MemoryType[]

export const MEMORY_NAME = /^([a-z]+)-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/

/** The two markers a rule-bearing body carries, on top of the rule line itself. */
const MEMORY_MARKERS = ['**Why:**', '**How to apply:**'] as const

export function memoryType(value: string): MemoryType | undefined {
  return MEMORY_TYPES.find((type) => type === value)
}

/**
 * The one missing-field shape `migrate.ts` can repair: `category` alone,
 * recoverable from the same filename prefix `checkMemory` already read it
 * from. `title` and `description` are prose nobody wrote down, so a finding
 * naming either carries no remedy.
 */
function memoryRemedy(
  missing: readonly string[],
  named: MemoryType | undefined,
): FindingRemedy | undefined {
  return named && missing.length === 1 && missing[0] === 'category'
    ? 'category-from-name'
    : undefined
}

export function checkMemory(name: string, text: string): Finding[] {
  const findings: Finding[] = []
  const match = MEMORY_NAME.exec(name)
  const named = match ? memoryType(match[1]) : undefined

  if (!named) {
    findings.push(
      finding(
        'name-malformed',
        name,
        name,
        `is not named <type>-<slug>.md with a type of ${MEMORY_TYPES.join(', ')}.`,
      ),
    )
  }

  const frontmatter = parseFrontmatter(text)
  const missing = MEMORY_FIELDS.filter(
    (field) => !readField(frontmatter, field),
  )

  if (missing.length > 0) {
    findings.push(
      finding(
        'frontmatter-incomplete',
        name,
        name,
        `carries no ${missing.join(' and no ')}.`,
        memoryRemedy(missing, named),
      ),
    )
  }

  // Its own kind rather than `title-missing`, which means an absent heading on a
  // plan. One kind covering both leaves a caller filtering the JSON unable to
  // tell a record with no title from one whose title is its own slug.
  if (readField(frontmatter, 'title') === name.replace(/\.md$/, '')) {
    findings.push(
      finding(
        'title-is-slug',
        name,
        name,
        'is titled with its own filename, so the catalog renders a slug where the rule belongs.',
      ),
    )
  }

  const category = readField(frontmatter, 'category')

  // Reported against the prefix alone. A name the prefix rule already failed
  // has no type to compare against, and reporting it twice names one defect as
  // two.
  if (named && category && category !== CATEGORY_BY_TYPE[named]) {
    findings.push(
      finding(
        'category-mismatch',
        name,
        category,
        `is not ${CATEGORY_BY_TYPE[named]}, which the filename prefix declares.`,
      ),
    )
  }

  return [
    ...findings,
    ...checkMemoryBody(
      name,
      text.slice(frontmatter?.raw.length ?? 0),
      named ?? category,
    ),
  ]
}

/**
 * A `user` or `reference` entry is a single sentence by design, so the markers
 * are checked only where a rule is being stated. The type is read off the
 * prefix, falling back to the category so a misnamed file is still checked
 * against the shape it claims.
 */
function checkMemoryBody(
  name: string,
  text: string,
  claimed: string | undefined,
): Finding[] {
  const type = claimed && memoryType(claimed.toLowerCase())
  if (type !== 'feedback' && type !== 'project') return []

  const body = linesOutsideFences(text).filter((line) => line.trim().length > 0)

  const findings: Finding[] = []
  const opening = body[0]

  if (!opening || MEMORY_MARKERS.some((marker) => opening.startsWith(marker))) {
    findings.push(
      finding(
        'section-missing',
        name,
        'the rule line',
        'is absent, so the entry carries a rationale with no rule to apply.',
      ),
    )
  }

  for (const marker of MEMORY_MARKERS) {
    if (!body.some((line) => line.startsWith(marker))) {
      findings.push(
        finding(
          'section-missing',
          name,
          marker,
          `is required on a ${type} entry and the body carries no such line.`,
        ),
      )
    }
  }

  return findings
}

const STANDARD_INDEX = 'index.md'
const STANDARD_FIELDS = ['title', 'description'] as const

const SCOPE_HEADING = /^##[ \t]+Scope[ \t]*$/
const ANY_HEADING = /^#{1,6}[ \t]+\S/
const DOES_NOT_GOVERN = 'Does not govern:'
const ATTRIBUTE_MARKER = 'attribute standard'
const CODE_SPAN = /`([^`]+)`/g

interface Scope {
  /** The first non-blank line under the heading, which is the statement. */
  readonly statement: string
  readonly lines: readonly string[]
}

export function readScope(text: string): Scope | undefined {
  const lines = linesOutsideFences(text)
  const opened = lines.findIndex((line) => SCOPE_HEADING.test(line.trim()))
  if (opened === -1) return undefined

  const body: string[] = []

  for (const line of lines.slice(opened + 1)) {
    if (ANY_HEADING.test(line.trim())) break
    body.push(line)
  }

  const statement = body.find((line) => line.trim().length > 0)

  return { statement: statement?.trim() ?? '', lines: body }
}

/**
 * The paths a scope statement declares, read the way `scripts/standards/list.sh`
 * reads them for the catalog's `appliesTo` field: backticked spans in the first
 * sentence alone. One sentence read two ways would let a standard pass here
 * while publishing a different jurisdiction to every consumer of the catalog.
 */
export function governedPaths(statement: string): string[] {
  const [sentence] = statement.split('. ')
  return [...sentence.matchAll(CODE_SPAN)].map((match) => match[1])
}

/**
 * The words a governed path offers a filename. Each segment gives its own word
 * and, where it carries a prefix or a placeholder, the parts either side of a
 * hyphen, so `.canon/tasks/session-<slug>.md` offers `tasks` and `session`.
 *
 * A dotted segment gives nothing. It names the folder holding the artifact
 * rather than the artifact, and a standard named for it would pass this check
 * while naming the container every sibling shares.
 */
export function pathWords(path: string): string[] {
  const words: string[] = []

  for (const segment of path.split('/')) {
    if (segment.startsWith('.')) continue

    const stem = segment.replace(/\.[a-z]+$/i, '').toLowerCase()
    words.push(stem)
    if (stem.includes('-')) words.push(...stem.split('-'))
  }

  return words.filter((word) => /^[a-z]+$/.test(word))
}

/**
 * Accepts the singular and the plural of one word. A standard over a single
 * document is named for the document and one over a folder of them is named for
 * either, and picking a side would report a conforming half of the corpus.
 */
function namesWord(stem: string, word: string): boolean {
  return stem === word || `${stem}s` === word || stem === `${word}s`
}

function checkStandardName(name: string, statement: string): Finding[] {
  const paths = governedPaths(statement)

  // The marker is read only where the first sentence backticks nothing, which
  // is the catalog's own rule. A statement naming a path publishes that path
  // however the rest of the statement describes itself.
  if (paths.length === 0) {
    if (statement.includes(ATTRIBUTE_MARKER)) return []

    return [
      finding(
        'scope-unanchored',
        name,
        name,
        'backticks no path in its first scope sentence and does not call itself an attribute standard, so it names no artifact to be named for.',
      ),
    ]
  }

  const stem = name.replace(/\.md$/, '')
  const words = paths.flatMap(pathWords)

  if (words.some((word) => namesWord(stem, word))) return []

  return [
    finding(
      'name-malformed',
      name,
      name,
      `names no part of ${paths.join(', ')}, which is what it governs. A rename reaches every target that installed the corpus and every surface citing it by bare filename.`,
    ),
  ]
}

export function checkStandard(name: string, text: string): Finding[] {
  const findings: Finding[] = []
  const frontmatter = parseFrontmatter(text)

  const missing = STANDARD_FIELDS.filter(
    (field) => !readField(frontmatter, field),
  )

  if (missing.length > 0) {
    findings.push(
      finding(
        'frontmatter-incomplete',
        name,
        name,
        `carries no ${missing.join(' and no ')}.`,
      ),
    )
  }

  const scope = readScope(text)

  // The name derives from the scope statement, so an absent section leaves
  // nothing to derive against. Reporting the name as well would name one defect
  // twice and point the fix at the wrong file.
  if (!scope) {
    return [
      ...findings,
      finding(
        'section-missing',
        name,
        '## Scope',
        'is absent, so the standard claims no jurisdiction and can refuse no rule.',
      ),
    ]
  }

  if (!scope.lines.some((line) => line.trim().startsWith(DOES_NOT_GOVERN))) {
    findings.push(
      finding(
        'section-missing',
        name,
        DOES_NOT_GOVERN,
        'is absent from the scope section, so no boundary names the owner it hands off to.',
      ),
    )
  }

  return [...findings, ...checkStandardName(name, scope.statement)]
}

/**
 * The three kinds whose records are folders rather than files. Keyed by kind so
 * a seventh arrives as an entry here and the compiler names the walk it owes,
 * where a ternary chain would silently fall through to whichever branch is last.
 */
const FOLDER_CHECK: Readonly<
  Record<
    Exclude<RecordKind, 'plans' | 'memory' | 'standards'>,
    (dir: string, slug: string) => Promise<Finding[]>
  >
> = {
  groundwork: checkTrack,
  intake: checkDump,
  teach: checkWorkspace,
}

function refuse(reason: ValidateRefusal, message: string): ValidateRefused {
  return { ok: false, reason, message }
}

/** The walk for a kind whose records are files in one flat folder. */
async function validateFiles(
  dir: string,
  kind: RecordKind,
  check: (name: string, text: string) => Finding[],
  skip: (file: string) => boolean = () => false,
): Promise<ValidateReport> {
  const files = (await listMarkdown(dir)).filter((file) => !skip(file))

  const perFile = await Promise.all(
    files.map(async (file) =>
      check(file, await readFile(join(dir, file), 'utf8')),
    ),
  )

  return { ok: true, kind, records: files.length, findings: perFile.flat() }
}

/**
 * Reports what every record in one folder claims against the shape its standard
 * fixes. It writes nothing whichever kind runs, and the reason differs by kind.
 * A session record is per-machine scratch with no history behind it, so a repair
 * that guessed wrong could not be undone. A standard installs into every target
 * and is cited by bare filename, so a rename costs more than the file move it
 * looks like.
 */
export async function validateRecords(
  root: string,
  kind: RecordKind,
): Promise<ValidateOutcome> {
  const dir = recordsDir(root, kind)

  if (!existsSync(dir)) {
    return refuse(
      'no-folder',
      `No ${kind} folder at ${recordDirs(root, kind).join(' or ')}.`,
    )
  }

  if (kind === 'plans') return validateFiles(dir, kind, checkPlan)

  if (kind === 'memory') {
    return validateFiles(
      dir,
      kind,
      checkMemory,
      (file) => file === MEMORY_INDEX,
    )
  }

  // The walk stays flat, matching install and the catalog.
  if (kind === 'standards') {
    return validateFiles(
      dir,
      kind,
      checkStandard,
      (file) => file === STANDARD_INDEX,
    )
  }

  const folders = await listFolders(dir)
  const check = FOLDER_CHECK[kind]
  const perFolder = await Promise.all(
    folders.map((slug) => check(join(dir, slug), slug)),
  )

  return { ok: true, kind, records: folders.length, findings: perFolder.flat() }
}
