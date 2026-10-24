import { readFile } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import { BARE_NAME, IGNORE_MARKER } from '@/context/citations'
import type { AuditedFolder } from '@/context/folders'
import { type BodyLine, bodyLines, maskDisplayed } from '@/markdown/scan'
import { documentHeight } from '@/markdown/structure'
import { isStubSeed } from '@/tooling/seed-marker'

/**
 * Checkpoint quoted from the standard stating it. It is not a cap.
 *
 * Entry length rests on one entry per domain, which is a domain fact, so
 * `claude/skills/context-fold/references/context.md` keeps it. Depth and bullet weight read the same over
 * any markdown file, so they are stated at the attribute tier and measured by
 * `canon markdown audit` rather than here.
 */
/**
 * Every reason `canon context audit` refuses for.
 *
 * `no-folders` is the one ordinary absence: a project that never adopted
 * `canon/context/`, and holds no `.canon/diagrams/`
 * folder an older install left, names no corpus this audit can measure, the
 * same state `no-skills` reads for the skill corpora. The other four are a malformed invocation or a checkout git
 * cannot read, which stay a break rather than an absence.
 */
export type ContextAuditRefusal =
  | 'conflicting-options'
  | 'bad-folder-list'
  | 'no-folders'
  | 'no-citation-scope'
  | 'no-git'

export const LENGTH_CHECKPOINT = 150

/**
 * A table this size or larger whose first column mostly names artifacts reads
 * as a catalog that grows a row per shipped thing, which is the shape the
 * standard routes to a bullet list. Below it, a table is small enough that a
 * reflow rewrites little.
 */
export const CATALOG_ROW_CHECKPOINT = 6

/** Share of first cells that must name an artifact for a table to qualify. */
const CATALOG_NAMED_RATIO = 0.6

/**
 * Required sections per audited folder name, each in the order its standard
 * states them.
 *
 * The lists are held here rather than read out of the standards, the way the
 * four checkpoints above quote their numbers. A parser over a standard's prose
 * would decide which sections are required from the wording around them, so it
 * fails on a rewrite of that wording rather than on a defect in an entry.
 *
 * These names do not generalize the way a length threshold does, which is why
 * each list is keyed on the folder whose standard states it. `context.md`
 * requires an overview and a layout. A
 * diagram entry declares a heading per kind and its standard requires none.
 */
export const REQUIRED_SECTIONS_BY_FOLDER: Readonly<
  Record<string, readonly string[]>
> = {
  context: ['Overview', 'Layout'],
}

/**
 * The closed set of H2 sections per audited folder name, which a required
 * section belongs to. An entry carrying another H2 is a finding under
 * `--gate`, since the set is what makes a context entry cheap to find a fact
 * in: a domain's folders go one level down as H3 items under `Layout`.
 *
 * Held beside the required lists for the same reason they are held here, and
 * keyed on the folder whose standard states it.
 */
export const ALLOWED_SECTIONS_BY_FOLDER: Readonly<
  Record<string, readonly string[]>
> = {
  context: ['Overview', 'Layout', 'Gotchas'],
}

/**
 * H2 sections the standard once allowed and now forbids, per audited folder.
 *
 * Kept apart from the extra sections because every unrebuilt entry still
 * carries one, and an extra section gates under `--gate` everywhere. A retired
 * section is a shape finding instead, which gates only where the folder was
 * rebuilt, per `SHAPE_GATED_FOLDERS`.
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
 * Whether an entry path is the development entry, being the flat entry or any
 * entry directly under a `development/` folder, since a split folder names its
 * scripts entry by project, as `local-loop` here and `local` in another. The
 * standard exempts the `Scripts` H3 for that entry alone, so the path is what
 * tells.
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
 *
 * The standard admits a rejected alternative and its reasoning while refusing
 * the provenance attached to it, and these three are what a session reaches for
 * when it records the second: when a change landed, which change carried it,
 * and which release labelled it. A marker is a judgment rather than a defect,
 * so this is measured and reported and never gates.
 *
 * The change pattern matches any digit count rather than the three-plus this
 * used to require, since a project young enough to sit in single or double
 * digits, `PR #7`, went entirely unread under the old floor. Widening it reads
 * a change reference wherever a document is scanned as prose, so `provenance`
 * masks a line's displayed spans first, which is what keeps a heading's own
 * auto-derived link destination, `(#7-open-questions)`, from reading as a
 * change number: `#7` there names the heading, not a pull request.
 *
 * The release pattern accepts three segments without a leading `v`, since the
 * standard cuts a release label rather than a spelling of one and `a CLI at
 * 0.83.0` names a release exactly as `v0.83.0` does. Two segments still require
 * the `v`, because an unprefixed pair is a dollar cost or a duration far more
 * often than a release in a corpus that records what its own runs cost. What
 * the widening reaches by accident is another tool's version, which the
 * standard asks nobody to cut, and those report rather than being excluded:
 * an exclusion keyed on a nearby tool name goes stale with nothing saying so.
 */
const PROVENANCE: readonly { kind: ProvenanceKind; pattern: RegExp }[] = [
  { kind: 'date', pattern: /\b\d{4}-\d{2}-\d{2}\b/g },
  { kind: 'change', pattern: /#\d+\b/g },
  { kind: 'release', pattern: /\b(?:v\d+\.\d+(?:\.\d+)?|\d+\.\d+\.\d+)\b/g },
]

/**
 * Verbs that read the date behind them as stamping a measurement.
 *
 * `claude/skills/context-fold/references/context.md` cuts a date attached to a change and permits one
 * stamping a measurement, so a pattern matching every ISO date reports against
 * a rule that admits half of what it finds. Separating the two needs the clause
 * rather than the token, since `measured on 2026-08-19` and `overturned on
 * 2026-08-19` differ only in the verb.
 *
 * These five are unambiguous wherever they appear in the clause, which is what
 * lets them match at any distance from the date. `Measured across the corpus on
 * 2026-08-14` puts four words between the two, and no line in the corpus uses
 * any of them as a noun a change date could attach to.
 *
 * The set is closed and drawn from what the corpus already writes, so a
 * phrasing nobody enumerated goes unmatched. That direction is the safe one: an
 * unmatched date falls back to the change marker it is today, which reports one
 * date too many rather than clearing one the standard cuts. Widening the set is
 * how a missed phrasing is fixed, and a date the clause cannot place is never a
 * third state, because the length finding already spends `unanswered` on the
 * two questions nothing measures at all.
 */
const STAMPING = /\b(?:measured|verified|driven|passed|fired)\b/i

/**
 * The noun form, which has to sit against the date to count.
 *
 * `A run on 2026-08-14` stamps a measurement and `Runs on #632 and #634 landed
 * 2026-08-02` dates a change, and the two differ only in what follows the noun.
 * Requiring the connector and then the date immediately is what separates them,
 * so this is anchored to the end of the clause where `STAMPING` is not.
 */
const STAMPING_RUN = /\b(?:an?\s+)?runs?\s+(?:on|at|in)\s+$/i

/** Sentence boundary, so a clause is read rather than the whole line. */
const SENTENCE_END = /[.!?:;]\s(?=[^.!?:;]*$)/

/**
 * The folder whose standard carries the exclusion above.
 *
 * Two measures narrow here rather than one: provenance and the required
 * sections. The name is the first of them because it was the first, and it
 * stays because renaming a constant the
 * JSON record publishes as `checkpoints.provenanceFolder` breaks every consumer
 * reading that field for a gain of one word.
 *
 * `claude/skills/context-fold/references/context.md` opens its scope by handing figures to the
 * `draw-figure` skill, so a marker reported in a diagrams entry would cite a
 * rule that entry's own standard routes elsewhere. The length and table
 * checkpoints are quoted from the same standard and keep reaching every audited
 * folder, because a threshold on how far a reader travels generalizes across
 * entry types while a rule about what an entry may say does not.
 *
 * What gates here is a rule only this standard states. Bullet weight does not,
 * since `claude/skills/markdown-craft/references/markdown.md` owns that checkpoint across document types and
 * its remedy sends the overflow to prose, which any entry type can act on.
 * `claude/skills/context-fold/references/context.md` specializes that remedy for an entry carrying
 * decisions, and specializing a rule narrows the advice rather than the measure.
 *
 * Restating the exclusion in the sibling standards was the alternative for what
 * gates here. It duplicates one knowledge item across three surfaces, which the
 * root instruction file forbids, and pointing is not available because the
 * surface they would point at is the one disclaiming them.
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
 * Each way an entry breaks the section shape the context standard states.
 *
 * `retired-section` is a `Decisions` H2. The three `gotcha-*` kinds are a
 * `Gotchas` section past its bullet cap, holding a heading, or holding a
 * paragraph. The three `layout-*` kinds are a Layout H3 titled neither a path
 * nor `Other folders`, a folder H3 past its bullet or paragraph cap, and a
 * heading below H3 under `Layout`.
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
   * Rendered lines across the whole file, counting frontmatter and fenced
   * blocks. It counts through `documentHeight` in `src/markdown/structure.ts`,
   * which shares `renderedHeight` with the depth checkpoint and with the
   * document ceiling, since all three sit beside each other in the standard
   * and a reader compares them.
   *
   * Fences are counted here and excluded there. The depth measure skips one so
   * an example cannot break the run around it, and a file measure has no run to
   * protect. Excluding them here would change which entries report by one and
   * would not reach the case that motivates it: the most fenced entry in the
   * corpus runs 20 percent fenced and sits past the checkpoint either way.
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
   * Whether a content rule reached this entry, which is what parts an empty
   * `provenance` list that was measured from one that was never scanned. The
   * length finding reads it, since reporting a clean history for an entry
   * outside the governed folder answers a question nothing asked.
   */
  readonly governed: boolean
}

/**
 * The three questions `claude/skills/context-fold/references/context.md` asks of an entry past the
 * checkpoint, in the order it states them.
 *
 * The standard calls no entry over the checkpoint wrong. It asks whether the
 * entry still covers a single domain, whether it has filled with content `ls`
 * or `--help` reproduces, and whether it has accumulated the history of its own
 * changes, then directs a fix at whichever is true. A report naming the count
 * alone leaves all three unasked, which is why the finding carries them.
 */
export type LengthQuestion = 'domain' | 'reproduced' | 'history'

/**
 * What the audit can say about one question for one entry.
 *
 * `unanswered` is a state rather than an omission. Two of the three questions
 * are judgments no measure settles, and dropping them would read as an entry
 * nothing found rather than one nothing checked.
 */
export type QuestionState = 'yes' | 'no' | 'unanswered'

export interface LengthCause {
  readonly question: LengthQuestion
  readonly state: QuestionState
  /**
   * Change markers behind a `yes`, and absent wherever nothing was counted. It
   * cites the provenance finding rather than restating it, so the two sections
   * of the report describe the same measurement once. A date stamping a
   * measurement never reaches that list, so an entry whose only dates are
   * measurement anchors answers `no` here.
   */
  readonly markers?: number
}

export interface LengthFinding {
  readonly rel: string
  readonly lines: number
  /** One entry per question in `LengthQuestion` order, never empty. */
  readonly causes: readonly LengthCause[]
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
 * Finds the tables whose rows name shipped artifacts.
 *
 * A bare table count reports mostly fixed comparison tables, where a reflow
 * costs nothing because no row is ever added. The reflow problem belongs to a
 * catalog that gains a row per artifact, and a first column carrying a path,
 * command, or link is what separates the two without reading the prose.
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
 *
 * Fenced blocks are skipped for the same reason the table scan skips them: a
 * sample command or a fixture inside an example is content the entry displays
 * rather than a claim it makes, and a version pinned in an install line is the
 * ordinary shape of one.
 *
 * Displayed spans are masked for the same reason. A code span quoting a hex
 * color, `#000`, and a link destination naming a heading's own anchor,
 * `(#7-open-questions)`, both read as text the entry shows rather than a claim
 * it makes, which is the same distinction the fence skip draws at the block
 * level.
 *
 * A date stamping a measurement is dropped rather than reported under a kind of
 * its own. One list with one meaning is what lets every consumer read it
 * without filtering: the report names what the standard cuts, and the length
 * finding counts the same thing. A separate kind would put the split in three
 * places and leave each free to read it differently.
 */
function provenance(lines: readonly BodyLine[]): ProvenanceFinding[] {
  // Scanning one pattern at a time emits a line's markers grouped by kind, so
  // the column is carried out of the match and sorted on. Without it a line
  // holding a date and two change numbers reports them in an order the reader
  // cannot find by scanning left to right.
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
 *
 * The clause rather than the line, because a sentence recording a measurement
 * and a later one dating a change sit side by side often enough that a
 * line-wide read would clear the second from the first. A date opening its own
 * line has no clause in front of it and stays a change marker, which is the
 * fallback rather than a separate answer.
 */
function stampsMeasurement(text: string, index: number): boolean {
  const before = text.slice(0, index)
  const boundary = before.search(SENTENCE_END)
  const clause = boundary === -1 ? before : before.slice(boundary + 1)

  return STAMPING.test(clause) || STAMPING_RUN.test(clause)
}

/**
 * Finds which required sections the entry declares.
 *
 * A heading at any level counts rather than the `##` the standard writes its
 * examples at. A domain that split into a folder puts its overview in a sibling
 * named for it, where the section is the `#` title and an `##` beneath it would
 * repeat the file's own name. All three split folders in this repository are
 * that shape, so matching `##` alone would report every one of them. Nothing is
 * titled for a required section without being about it, so the looser match
 * costs no precision.
 *
 * Fenced blocks are skipped for the reason the scans above skip them. A
 * standard quoted inside an example declares nothing about the entry quoting it.
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
 * Finds the H2 headings outside the allowed set.
 *
 * H2 only, since the set closes the sections of an entry and says nothing of
 * where its H3 items sit. Fenced blocks are skipped, so a template quoted
 * inside an example declares nothing about the entry quoting it.
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
 * Finds where the entry breaks the section shape.
 *
 * Bullets are counted at any indent and across any paragraph, so a list split
 * by a bold label or nested one level down still counts against the cap it
 * would otherwise slip under. A line continuing a list item, lazily or
 * indented after a blank, belongs to the item rather than opening a paragraph,
 * which is what keeps a wrapped bullet from reading as prose.
 *
 * A cap reports once per section or folder heading however far past it the
 * count runs, since the fix is one cut either way. `Other folders` is exempt
 * from both folder caps, its one-line bullets being held by the bullet run
 * limit `canon markdown audit` already gates. The development entry's `Scripts`
 * H3 is exempt from the heading rule and both caps the same way, its table
 * being a run-command surface rather than a folder.
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

  const closeFolder = (): void => {
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
      if (gotchas) gotchas.bullets++
      if (folder) folder.bullets++
      continue
    }

    if (TABLE_ROW.test(line.text)) {
      inItem = false
      inParagraph = false
      afterBlank = false
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
    if (folder) folder.paragraphs++
  }

  closeFolder()
  closeGotchas()

  return issues.sort((a, b) => a.line - b.line)
}

/**
 * Finds the references naming a sibling entry by bare filename.
 *
 * The standard asks for the path because a bare name resolves against whichever
 * folder the reader is in, so a folder split strands every inbound reference
 * and nothing reads the break. A path is checkable and a bare name is not,
 * which is what makes this the one form rule worth measuring.
 *
 * Matching stops at the sibling set, which reaches less than the rule does. The
 * standard governs a reference to any other entry, so a split entry naming one
 * that sits in a different folder is a violation this never sees. What the set
 * buys is that a name resolving inside the folder is a reference by
 * construction, where a bare filename matched anywhere would report every
 * sentence that happens to name a file. The entry's own name is out of the set
 * on separate grounds, since naming itself points at nothing a split can strand.
 *
 * Fenced blocks are skipped for the reason the scans above skip them, and a line
 * carrying the citation ignore marker is skipped because that marker already
 * means the line displays a name rather than pointing at one.
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
 *
 * The caller passes jurisdiction rather than deriving it from `rel`, because a
 * path prefix hardcodes what `--folder` exists to override and misses a domain
 * split into `context/<sub-area>/`. Sibling names arrive the same way and for
 * the same reason, since the folder an entry sits in is what holds them. The
 * required sections arrive apart from jurisdiction, since a folder can owe
 * sections under a standard that states no provenance rule.
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
  }
}

/**
 * Names each entry past the checkpoint with the standard's three questions
 * answered as far as anything measures them.
 *
 * Only accumulated history is mechanical, and it is already measured by the
 * provenance check, so this joins that count rather than counting again. What
 * it joins is a count of change markers, since a date stamping a measurement is
 * not one and an entry recording what its runs cost would otherwise report
 * accumulated history on the anchors dating those runs. The other two are read
 * by a person: whether an entry still covers one domain is a judgment about its
 * subject, and recognizing content `ls` or `--help` reproduces needs a reader
 * who knows what those emit.
 *
 * An entry outside the governed folder has no measured question at all, since
 * provenance is scoped to the standard stating it, and reporting `no` there
 * would answer from a scan that never ran.
 *
 * Sorted longest first, which is the order the report already printed and the
 * order the questions are worth asking in.
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
    }))
}

function historyCause(entry: EntryReport): LengthCause {
  if (!entry.governed) return { question: 'history', state: 'unanswered' }

  return entry.provenance.length > 0
    ? { question: 'history', state: 'yes', markers: entry.provenance.length }
    : { question: 'history', state: 'no' }
}

/**
 * Measures every entry in the audited folders. A generated `index.md` is not
 * among them, since its body is rewritten on every regen and no checkpoint
 * describes a catalog.
 *
 * Jurisdiction is applied here rather than at the report, so the JSON record
 * and the printed run agree on which entries a content rule reached.
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
 *
 * A split folder's entries are named for sub-areas of one domain, so a bare
 * name matching one of them points at it and nothing else. The folder named
 * under `.claude/` is where that stops holding, since its entries are named for
 * whole domains and a domain name is a common noun that a seed, a script, or
 * another tree spells the same way. Both false positives this measure was tuned
 * against sat there, naming a seed that shares a filename with the entry beside
 * them, and no signal in the name separates the two.
 *
 * What the exemption costs is the references a future split of the named folder
 * would strand, which are the ones this measure would most like to hold. It is
 * taken because a report firing on correct prose is what teaches a reader to
 * stop reading the section.
 */
export function matchesSiblings(folder: AuditedFolder): boolean {
  return governsContent(folder) && folder.nested
}

/**
 * Names what does not declare the sections the standard requires.
 *
 * Which unit answers depends on what the folder is. A split folder's entries
 * describe one domain between them and carry the overview and the layout in a
 * sibling named for them, so any one of them answers and a per-file rule there
 * would report every other child of all three shipped splits. The entries of
 * the folder named under `.claude/` are one domain each, so each answers for
 * itself. Rolling those up too was the first shape of this check, and it let a
 * single sibling stand in for thirteen domains it says nothing about.
 *
 * The judgment sits in the caller because the split case needs the folder's
 * other entries, which `measureFolders` holds and `measureEntry` does not. A
 * folder with no entries of its own is a split parent holding an index and
 * subfolders, and it has nothing to require a section of.
 *
 * The standard sanctions omitting `## Layout` from a domain owning no paths,
 * which no measure can tell from an entry that forgot it. An entry of that
 * shape therefore reports, which is a reason this is printed and never gated on.
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

    // A stub owes no sections, so it is dropped before either branch rather
    // than inside them. Leaving one in the split-folder aggregate would let a
    // skeleton answer for the siblings that do owe the sections.
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
 * Names each entry carrying an H2 outside its folder's closed set.
 *
 * Per entry rather than per folder, unlike `missingSections`: a split folder's
 * entries each answer for their own headings, since an extra section is a fact
 * about the file it sits in. A stub seed is dropped for the reason
 * `missingSections` drops one, a skeleton being exempt from the shape rather
 * than from being well formed.
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
 * Names each entry breaking the section shape, and whether it gates.
 *
 * Where it gates is the caller's predicate rather than a list read here, since
 * the folders rebuilt to the shape are named by path from the repository root
 * and `measureFolders` holds only paths from the audit root. A stub seed is
 * dropped for the reason `extraSections` drops one.
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
