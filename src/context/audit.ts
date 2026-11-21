import { readFile } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import { BARE_NAME, IGNORE_MARKER } from '@/context/citations'
import type { AuditedFolder } from '@/context/folders'
import { lengthExemption } from '@/markdown/ceiling'
import { type BodyLine, bodyLines, maskDisplayed } from '@/markdown/scan'
import { documentHeight } from '@/markdown/structure'
import { isStubSeed } from '@/tooling/seed-marker'

/**
 * Every reason `canon context audit` refuses for. `no-folders` is the one
 * ordinary absence, a project holding neither `canon/context/` nor an older
 * install's diagrams folder, and the other four are a bad call or an unreadable checkout.
 */
export type ContextAuditRefusal =
  | 'conflicting-options'
  | 'bad-folder-list'
  | 'no-folders'
  | 'no-citation-scope'
  | 'no-git'

/**
 * Checkpoint quoted from the standard stating it. It is not a cap. Entry length
 * rests on one entry per domain, so `claude/skills/context-fold/references/context.md`
 * keeps it, and depth and bullet weight are measured by `canon markdown audit`.
 */
export const LENGTH_CHECKPOINT = 150

/**
 * A table this size or larger whose first column mostly names artifacts reads
 * as a catalog that grows a row per shipped thing, which the standard routes to
 * a bullet list.
 */
export const CATALOG_ROW_CHECKPOINT = 6

/** Share of first cells that must name an artifact for a table to qualify. */
const CATALOG_NAMED_RATIO = 0.6

/**
 * Required sections per audited folder name, in the order its standard states
 * them. Held here rather than parsed, since a parser would fail on a rewording
 * rather than on a defect, and a diagram entry requires none.
 */
export const REQUIRED_SECTIONS_BY_FOLDER: Readonly<
  Record<string, readonly string[]>
> = {
  context: ['Overview', 'Layout'],
}

/**
 * The closed set of H2 sections per audited folder name. An entry carrying
 * another H2 is a finding under `--gate`, since the set is what makes a fact
 * cheap to find, and a domain's folders go down as H3 items under `Layout`.
 */
export const ALLOWED_SECTIONS_BY_FOLDER: Readonly<
  Record<string, readonly string[]>
> = {
  context: ['Overview', 'Layout', 'Gotchas'],
}

/**
 * H2 sections the standard once allowed and now forbids, per audited folder.
 * Kept apart from the extra sections, since a retired one is a shape finding
 * that gates only where the folder was rebuilt, per `SHAPE_GATED_FOLDERS`.
 */
export const RETIRED_SECTIONS_BY_FOLDER: Readonly<
  Record<string, readonly string[]>
> = {
  context: ['Decisions'],
}

/** Bullets a `Gotchas` section may hold, counted at any indent. */
export const GOTCHA_CAP = 5

/** Bullets a folder H3 under `Layout` may hold, counted at any indent. */
export const LAYOUT_BULLET_CAP = 5

/** Paragraphs a folder H3 under `Layout` may hold, being its one lead. */
export const LAYOUT_PARAGRAPH_CAP = 1

/** The one Layout H3 not titled with a path, holding the trivial folders. */
export const OTHER_FOLDERS = 'Other folders'

/** The run-command table H3 only the development entry carries under `Layout`. */
export const SCRIPTS_HEADING = 'Scripts'

/**
 * Whether an entry path is the development entry, the flat entry or any entry
 * directly under `development/`, whose scripts entry the standard exempts from
 * the `Scripts` H3 and which a split folder names by project.
 */
function isDevelopmentEntry(rel: string): boolean {
  return /(?:^|\/)development(?:\/[^/]+)?\.md$/.test(rel)
}

/**
 * The context standard's list, kept as its own export because the audit record
 * has published it flat under `checkpoints.requiredSections` since before any
 * other folder required a section.
 */
export const REQUIRED_SECTIONS: readonly string[] =
  REQUIRED_SECTIONS_BY_FOLDER.context

const HEADING_TEXT = /^#{1,6}\s+(.+?)\s*$/
const TABLE_ROW = /^\s*\|/
const TABLE_SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/
const NAMED_CELL = /`[^`]+`|\[[^\]]+\]\([^)]+\)/

/**
 * Spellings of how the domain reached its shape rather than what it is now.
 * A marker is a judgment, so this reports and never gates. The release pattern
 * takes two segments only with a `v`, since an unprefixed pair is a cost.
 */
const PROVENANCE: readonly { kind: ProvenanceKind; pattern: RegExp }[] = [
  { kind: 'date', pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  { kind: 'change', pattern: /#\d+\b/g },
  { kind: 'release', pattern: /\b(?:v\d+\.\d+(?:\.\d+)?|\d+\.\d+\.\d+)\b/g },
]

/**
 * Verbs that read the date behind them as stamping a measurement, which
 * `claude/skills/context-fold/references/context.md` permits where a change date
 * is cut. The set is closed, so an unenumerated phrasing falls back to a change marker.
 */
const STAMPING = /\b(?:measured|verified|driven|passed|fired)\b/i

/**
 * The noun form, which has to sit against the date to count. A run on a date
 * stamps a measurement while runs on two pull requests that landed date a
 * change, so this is anchored to the clause end where `STAMPING` is not.
 */
const STAMPING_RUN = /\b(?:an?\s+)?runs?\s+(?:on|at|in)\s+$/i

/** Sentence boundary, so a clause is read rather than the whole line. */
const SENTENCE_END = /[.!?:;]\s(?=[^.!?:;]*$)/

/**
 * The folder whose standard carries the exclusion above, narrowing provenance
 * and the required sections. It keeps the provenance name because the JSON
 * record publishes it as `checkpoints.provenanceFolder`.
 */
export const PROVENANCE_FOLDER = 'context'

export type ProvenanceKind = 'date' | 'change' | 'release'

export interface TableFinding {
  readonly line: number
  readonly rows: number
}

export interface ProvenanceFinding {
  readonly line: number
  readonly kind: ProvenanceKind
  /** The marker as written, so a report names what to go and look at. */
  readonly text: string
}

export interface BareReferenceFinding {
  readonly line: number
  /** The name as written, so a report says which reference to respell. */
  readonly name: string
}

/**
 * Each way an entry breaks the section shape the context standard states: a
 * retired `Decisions` H2, a `Gotchas` section past its cap or holding a heading
 * or paragraph, and a Layout H3 or heading level the standard does not allow.
 */
export type ShapeKind =
  | 'retired-section'
  | 'gotcha-count'
  | 'gotcha-heading'
  | 'gotcha-paragraph'
  | 'layout-heading'
  | 'layout-bullets'
  | 'layout-paragraphs'
  | 'layout-depth'

export interface ShapeIssue {
  readonly line: number
  readonly kind: ShapeKind
  /** The heading or line as written, so a report names where to look. */
  readonly text: string
  /** Bullets or paragraphs counted, on the two cap kinds alone. */
  readonly count?: number
}

export interface EntryReport {
  readonly rel: string
  /**
   * Rendered lines across the whole file, counting frontmatter and fenced blocks,
   * through `documentHeight` in `src/markdown/structure.ts`. Fences count here
   * though the depth measure skips them, since a file measure has no run to protect.
   */
  readonly lines: number
  readonly catalogTables: readonly TableFinding[]
  /** Empty for an entry no standard bans a change narrative in. */
  readonly provenance: readonly ProvenanceFinding[]
  /**
   * References naming a sibling entry by bare filename, and empty for a caller
   * that passed no sibling names. Which entries have siblings worth matching is
   * the caller's judgment, stated where it builds the list.
   */
  readonly bareReferences: readonly BareReferenceFinding[]
  /**
   * Required sections this entry declares, in the standard's order, and empty
   * outside a folder whose standard names them. What the folder is short of
   * is `missingSections`, since one entry answers for its siblings.
   */
  readonly sections: readonly string[]
  /**
   * H2 headings outside the folder's closed set, in document order, and empty
   * outside a folder whose standard states one. What the folder carries in
   * all is `extraSections`.
   */
  readonly otherSections: readonly string[]
  /**
   * Breaks of the section shape, in document order, and empty outside the
   * governed folder. Whether one gates depends on where the entry sits, which
   * `shapeFindings` decides rather than the measure.
   */
  readonly shape: readonly ShapeIssue[]
  /**
   * Whether the file declares itself a skeleton, which excludes it from the
   * section check alone. Every other measure still reads it, since a stub is
   * exempt from owing sections rather than from being well formed.
   */
  readonly stub: boolean
  /**
   * Whether a content rule reached this entry, which parts an empty `provenance`
   * list that was measured from one never scanned. The length finding reads it,
   * since a clean history outside the governed folder answers nothing asked.
   */
  readonly governed: boolean
  /**
   * The reason a `canon-length-exempt` marker states, or null where the entry
   * carries none, read the way the document ceiling reads it so one marker
   * exempts a file from both.
   */
  readonly lengthExempt: string | null
}

/**
 * The three questions the context standard asks of an entry past the checkpoint:
 * whether it covers one domain, whether `ls` or `--help` reproduces it, and
 * whether it holds the history of its own changes. A bare count leaves all three unasked.
 */
export type LengthQuestion = 'domain' | 'reproduced' | 'history'

/**
 * What the audit can say about one question for one entry. `unanswered` is a
 * state rather than an omission, since dropping a judgment no measure settles
 * would read as an entry nothing found rather than one nothing checked.
 */
export type QuestionState = 'yes' | 'no' | 'unanswered'

export interface LengthCause {
  readonly question: LengthQuestion
  readonly state: QuestionState
  /**
   * Change markers behind a `yes`, absent wherever nothing was counted. It cites
   * the provenance finding rather than restating it, and a date stamping a
   * measurement never reaches that list.
   */
  readonly markers?: number
}

export interface LengthFinding {
  readonly rel: string
  readonly lines: number
  /** One entry per question in `LengthQuestion` order, never empty. */
  readonly causes: readonly LengthCause[]
  /**
   * The stated exemption reason, or null. An exempt entry still reports, so a
   * reader can count it, and never gates under `gate-length`.
   */
  readonly exempt: string | null
}

export interface ExtraSectionFinding {
  /** Repo-relative path of the entry carrying the headings. */
  readonly rel: string
  /** H2 headings outside the closed set, never empty. */
  readonly headings: readonly string[]
}

export interface SectionFinding {
  /**
   * Repo-relative path of whatever owes the sections: the entry itself in the
   * folder named under `.claude/`, and the folder in a domain split across
   * one, since the split folder's entries answer for each other.
   */
  readonly rel: string
  /** Required sections the path above does not declare, never empty. */
  readonly missing: readonly string[]
}

function firstCell(row: string): string {
  return row.split('|').slice(1)[0] ?? ''
}

/**
 * Finds the tables whose rows name shipped artifacts. A bare table count reports
 * mostly fixed comparison tables, and a first column carrying a path, command,
 * or link separates a catalog that gains a row per artifact.
 */
function catalogTables(entry: readonly BodyLine[]): TableFinding[] {
  const findings: TableFinding[] = []
  const lines = entry.filter((line) => !line.fenced)
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!TABLE_ROW.test(line.text)) {
      index++
      continue
    }

    const separator = lines[index + 1]
    if (!separator || !TABLE_SEPARATOR.test(separator.text)) {
      index++
      continue
    }

    const body: BodyLine[] = []
    let cursor = index + 2
    while (cursor < lines.length && TABLE_ROW.test(lines[cursor].text)) {
      body.push(lines[cursor])
      cursor++
    }

    const named = body.filter((row) => NAMED_CELL.test(firstCell(row.text)))
    if (
      body.length >= CATALOG_ROW_CHECKPOINT &&
      named.length / body.length >= CATALOG_NAMED_RATIO
    ) {
      findings.push({ line: line.number, rows: body.length })
    }

    index = cursor
  }

  return findings
}

/**
 * Finds the markers narrating a change rather than describing the domain.
 * Fenced blocks are skipped and displayed spans masked, since a pinned install
 * line or a heading anchor is shown text, and a date stamping a measurement is dropped.
 */
function provenance(lines: readonly BodyLine[]): ProvenanceFinding[] {
  // Each pattern emits markers grouped by kind, so the column is carried to sort left to right.
  const found: { finding: ProvenanceFinding; column: number }[] = []

  for (const line of lines) {
    if (line.fenced) continue

    const text = maskDisplayed(line.text)

    for (const { kind, pattern } of PROVENANCE) {
      for (const match of text.matchAll(pattern)) {
        if (kind === 'date' && stampsMeasurement(line.text, match.index)) {
          continue
        }

        found.push({
          finding: { line: line.number, kind, text: match[0] },
          column: match.index,
        })
      }
    }
  }

  return found
    .sort((a, b) => a.finding.line - b.finding.line || a.column - b.column)
    .map((each) => each.finding)
}

/**
 * Reads the clause in front of a date for a verb that stamps a measurement.
 * The clause rather than the line, since a measurement and a later change date
 * sit side by side often enough that a line-wide read would clear the second.
 */
function stampsMeasurement(text: string, index: number): boolean {
  const before = text.slice(0, index)
  const boundary = before.search(SENTENCE_END)
  const clause = boundary === -1 ? before : before.slice(boundary + 1)

  return STAMPING.test(clause) || STAMPING_RUN.test(clause)
}

/**
 * Finds which required sections the entry declares. A heading at any level
 * counts, since a split domain titles its overview file for the section, and
 * fenced blocks are skipped, since a quoted standard declares nothing.
 */
function declaredSections(
  lines: readonly BodyLine[],
  required: readonly string[],
): string[] {
  const found = new Set<string>()

  for (const line of lines) {
    if (line.fenced) continue

    const match = line.text.match(HEADING_TEXT)
    if (match && required.includes(match[1])) found.add(match[1])
  }

  return required.filter((section) => found.has(section))
}

const H2_TEXT = /^##\s+(.+?)\s*$/

/**
 * Finds the H2 headings outside the allowed set. H2 only, since the set closes
 * the sections of an entry and says nothing of its H3 items, and fenced
 * blocks are skipped so a quoted template declares nothing.
 */
function otherSections(
  lines: readonly BodyLine[],
  allowed: readonly string[],
  retired: readonly string[],
): string[] {
  if (allowed.length === 0) return []

  const found: string[] = []

  for (const line of lines) {
    if (line.fenced) continue

    const match = line.text.match(H2_TEXT)
    if (match && !allowed.includes(match[1]) && !retired.includes(match[1])) {
      found.push(match[1])
    }
  }

  return found
}

const HEADING_LEVEL = /^(#{1,6})\s+(.+?)\s*$/
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/
const INDENTED = /^\s+\S/
const FOLDER_TITLE = /^`[^`]+`$/

interface FolderHeading {
  readonly line: number
  readonly text: string
  bullets: number
  paragraphs: number
}

/**
 * Finds where the entry breaks the section shape. Bullets count at any indent,
 * a continuation line belongs to its item, and a cap reports once per heading.
 * `Other folders` and the development entry's `Scripts` H3 are exempt from the caps.
 */
function shapeIssues(
  rel: string,
  lines: readonly BodyLine[],
  retired: readonly string[],
): ShapeIssue[] {
  const issues: ShapeIssue[] = []
  const exempt = new Set([OTHER_FOLDERS])
  if (isDevelopmentEntry(rel)) exempt.add(SCRIPTS_HEADING)
  let section: string | undefined
  let gotchas: { line: number; bullets: number } | undefined
  let folder: FolderHeading | undefined
  let inItem = false
  let inParagraph = false
  let afterBlank = false
  let afterTable = false
  let deferred = false

  const settleDeferred = (): void => {
    if (deferred && folder) folder.paragraphs++
    deferred = false
  }

  const closeFolder = (): void => {
    settleDeferred()
    if (folder && !exempt.has(folder.text)) {
      if (folder.paragraphs > LAYOUT_PARAGRAPH_CAP) {
        issues.push({
          line: folder.line,
          kind: 'layout-paragraphs',
          text: folder.text,
          count: folder.paragraphs,
        })
      }
      if (folder.bullets > LAYOUT_BULLET_CAP) {
        issues.push({
          line: folder.line,
          kind: 'layout-bullets',
          text: folder.text,
          count: folder.bullets,
        })
      }
    }
    folder = undefined
  }

  const closeGotchas = (): void => {
    if (gotchas && gotchas.bullets > GOTCHA_CAP) {
      issues.push({
        line: gotchas.line,
        kind: 'gotcha-count',
        text: 'Gotchas',
        count: gotchas.bullets,
      })
    }
    gotchas = undefined
  }

  for (const line of lines) {
    if (line.fenced) continue

    const heading = line.text.match(HEADING_LEVEL)
    if (heading) {
      const level = heading[1].length
      const text = heading[2]
      inItem = false
      inParagraph = false
      afterBlank = false
      afterTable = false

      if (level <= 2) {
        closeFolder()
        closeGotchas()
        section = level === 2 ? text : undefined
        if (level === 2 && retired.includes(text)) {
          issues.push({ line: line.number, kind: 'retired-section', text })
        }
        if (section === 'Gotchas') gotchas = { line: line.number, bullets: 0 }
        continue
      }

      if (section === 'Gotchas') {
        issues.push({ line: line.number, kind: 'gotcha-heading', text })
      } else if (section === 'Layout' && level === 3) {
        closeFolder()
        folder = { line: line.number, text, bullets: 0, paragraphs: 0 }
        if (!FOLDER_TITLE.test(text) && !exempt.has(text)) {
          issues.push({ line: line.number, kind: 'layout-heading', text })
        }
      } else if (section === 'Layout') {
        issues.push({ line: line.number, kind: 'layout-depth', text })
      }
      continue
    }

    if (line.text.trim() === '') {
      inParagraph = false
      afterBlank = true
      continue
    }

    if (LIST_ITEM.test(line.text)) {
      inItem = true
      inParagraph = false
      afterBlank = false
      afterTable = false
      deferred = false
      if (gotchas) gotchas.bullets++
      if (folder) folder.bullets++
      continue
    }

    if (folder && TABLE_ROW.test(line.text)) {
      settleDeferred()
      inItem = false
      inParagraph = false
      afterBlank = false
      afterTable = true
      continue
    }

    const continues = inItem && (!afterBlank || INDENTED.test(line.text))
    afterBlank = false
    if (continues) continue

    inItem = false
    if (inParagraph) continue
    inParagraph = true

    if (gotchas) {
      issues.push({
        line: line.number,
        kind: 'gotcha-paragraph',
        text: line.text.trim(),
      })
    }
    if (folder) {
      settleDeferred()
      if (afterTable) deferred = true
      else folder.paragraphs++
    }
    afterTable = false
  }

  closeFolder()
  closeGotchas()

  return issues.sort((a, b) => a.line - b.line)
}

/**
 * Finds the references naming a sibling entry by bare filename. A bare name
 * resolves against the reader's folder, so a split strands it silently, and a
 * match is a reference by construction. Fenced and ignore-marked lines are skipped.
 */
function bareReferences(
  lines: readonly BodyLine[],
  siblings: readonly string[],
): BareReferenceFinding[] {
  if (siblings.length === 0) return []

  const named = new Set(siblings)
  const findings: BareReferenceFinding[] = []

  for (const line of lines) {
    if (line.fenced || line.text.includes(IGNORE_MARKER)) continue

    for (const match of line.text.matchAll(BARE_NAME)) {
      if (named.has(match[1])) {
        findings.push({ line: line.number, name: match[1] })
      }
    }
  }

  return findings
}

/**
 * Measures one entry, scanning for provenance only when a standard claims it.
 * The caller passes jurisdiction and sibling names rather than deriving them
 * from `rel`, since a path prefix hardcodes what `--folder` exists to override.
 */
export function measureEntry(
  rel: string,
  source: string,
  governsContent = true,
  siblings: readonly string[] = [],
  required: readonly string[] = governsContent ? REQUIRED_SECTIONS : [],
  allowed: readonly string[] = [],
  retired: readonly string[] = governsContent
    ? RETIRED_SECTIONS_BY_FOLDER.context
    : [],
): EntryReport {
  const lines = bodyLines(source)

  return {
    rel,
    lines: documentHeight(source),
    catalogTables: catalogTables(lines),
    provenance: governsContent ? provenance(lines) : [],
    bareReferences: bareReferences(lines, siblings),
    sections: declaredSections(lines, required),
    otherSections: otherSections(lines, allowed, retired),
    shape: governsContent ? shapeIssues(rel, lines, retired) : [],
    stub: isStubSeed(source),
    governed: governsContent,
    lengthExempt: lengthExemption(rel, source),
  }
}

/**
 * Names each entry past the checkpoint with the standard's three questions
 * answered as far as anything measures them. Only accumulated history is
 * mechanical, and an entry outside the governed folder answers nothing.
 */
export function lengthFindings(
  entries: readonly EntryReport[],
): LengthFinding[] {
  return entries
    .filter((entry) => entry.lines > LENGTH_CHECKPOINT)
    .sort((a, b) => b.lines - a.lines)
    .map((entry) => ({
      rel: entry.rel,
      lines: entry.lines,
      causes: [
        { question: 'domain', state: 'unanswered' },
        { question: 'reproduced', state: 'unanswered' },
        historyCause(entry),
      ] satisfies LengthCause[],
      exempt: entry.lengthExempt,
    }))
}

function historyCause(entry: EntryReport): LengthCause {
  if (!entry.governed) return { question: 'history', state: 'unanswered' }

  return entry.provenance.length > 0
    ? { question: 'history', state: 'yes', markers: entry.provenance.length }
    : { question: 'history', state: 'no' }
}

/**
 * Measures every entry in the audited folders, except a generated `index.md`
 * whose body is rewritten on every regen. Jurisdiction is applied here, so the
 * JSON record and the printed run agree on which entries a content rule reached.
 */
export async function measureFolders(
  root: string,
  folders: readonly AuditedFolder[],
): Promise<EntryReport[]> {
  const reports: EntryReport[] = []

  for (const folder of folders) {
    const names = matchesSiblings(folder)
      ? folder.entries.map((path) => basename(path))
      : []

    for (const path of folder.entries) {
      const self = basename(path)

      reports.push(
        measureEntry(
          relative(root, path),
          await readFile(path, 'utf8'),
          governsContent(folder),
          names.filter((name) => name !== self),
          requiredSections(folder),
          allowedSections(folder),
          retiredSections(folder),
        ),
      )
    }
  }

  return reports
}

/** Reports whether the folder's standard is the one carrying the exclusion. */
export function governsContent(folder: AuditedFolder): boolean {
  return folder.name === PROVENANCE_FOLDER
}

/** Names the sections the folder's standard requires, empty where it states none. */
export function requiredSections(folder: AuditedFolder): readonly string[] {
  return Object.hasOwn(REQUIRED_SECTIONS_BY_FOLDER, folder.name)
    ? REQUIRED_SECTIONS_BY_FOLDER[folder.name]
    : []
}

/** Names the H2 sections the folder's standard allows, empty where it states no set. */
export function allowedSections(folder: AuditedFolder): readonly string[] {
  return Object.hasOwn(ALLOWED_SECTIONS_BY_FOLDER, folder.name)
    ? ALLOWED_SECTIONS_BY_FOLDER[folder.name]
    : []
}

/** Names the H2 sections the folder's standard retired, empty where it retired none. */
export function retiredSections(folder: AuditedFolder): readonly string[] {
  return Object.hasOwn(RETIRED_SECTIONS_BY_FOLDER, folder.name)
    ? RETIRED_SECTIONS_BY_FOLDER[folder.name]
    : []
}

/**
 * Reports whether a bare sibling name here is a reference by construction.
 * A split folder's entries are named for sub-areas, so a match points at it
 * alone, while the `.claude/` folder's common nouns are exempt to avoid firing on correct prose.
 */
export function matchesSiblings(folder: AuditedFolder): boolean {
  return governsContent(folder) && folder.nested
}

/**
 * Names what does not declare the sections the standard requires. A split
 * folder's entries answer for the folder between them and the `.claude/` folder's
 * each answer for themselves. A domain owning no paths may omit Layout, so this never gates.
 */
export function missingSections(
  root: string,
  folders: readonly AuditedFolder[],
  entries: readonly EntryReport[],
): SectionFinding[] {
  const byRel = new Map(entries.map((entry) => [entry.rel, entry]))
  const findings: SectionFinding[] = []

  for (const folder of folders) {
    const required = requiredSections(folder)
    if (required.length === 0 || folder.entries.length === 0) continue

    const shortOf = (declared: readonly string[]): string[] =>
      required.filter((name) => !declared.includes(name))

    // A stub owes no sections, so it is dropped before either branch or it would answer for siblings.
    const reports = folder.entries
      .map((path) => byRel.get(relative(root, path)))
      .filter((entry) => entry !== undefined)
      .filter((entry) => !entry.stub)

    if (reports.length === 0) continue

    if (folder.nested && governsContent(folder)) {
      const missing = shortOf(reports.flatMap((entry) => entry.sections))
      if (missing.length > 0) findings.push({ rel: folder.rel, missing })
      continue
    }

    for (const entry of reports) {
      const missing = shortOf(entry.sections)
      if (missing.length > 0) findings.push({ rel: entry.rel, missing })
    }
  }

  return findings
}

/**
 * Names each entry carrying an H2 outside its folder's closed set. Per entry
 * rather than per folder, unlike `missingSections`, since an extra section is
 * a fact about its own file, and a stub seed is dropped as there.
 */
export function extraSections(
  entries: readonly EntryReport[],
): ExtraSectionFinding[] {
  return entries
    .filter((entry) => !entry.stub && entry.otherSections.length > 0)
    .map((entry) => ({ rel: entry.rel, headings: entry.otherSections }))
}

export interface ShapeFinding {
  /** Repo-relative path of the entry breaking the shape. */
  readonly rel: string
  /** Whether the entry sits where the shape gates under `--gate`. */
  readonly gated: boolean
  /** Every break in the entry, never empty. */
  readonly issues: readonly ShapeIssue[]
}

/**
 * Names each entry breaking the section shape, and whether it gates. The caller's
 * predicate decides where, since rebuilt folders are named from the repository
 * root and `measureFolders` holds audit-root paths. A stub seed is dropped.
 */
export function shapeFindings(
  entries: readonly EntryReport[],
  isGated: (rel: string) => boolean,
): ShapeFinding[] {
  return entries
    .filter((entry) => !entry.stub && entry.shape.length > 0)
    .map((entry) => ({
      rel: entry.rel,
      gated: isGated(entry.rel),
      issues: entry.shape,
    }))
}
