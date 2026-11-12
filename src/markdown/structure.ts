import { type BodyLine, visibleText } from '@/markdown/scan'

export const HEADING = /^#{1,6}\s/

/**
 * A section marker holding its line alone, which is the signpost a document
 * uses where its own template asks for bold rather than a heading.
 *
 * `claude/skills/plan-feature/references/plan.md` marks its sections this way,
 * so without the break a conforming plan reads as one run and every plan
 * reports past the depth checkpoint. Moving the template to headings was the
 * alternative, and it clears no plan already written.
 *
 * The marker starts at column zero and fills the line, since a bold sentence
 * opener is emphasis and an indented one labels a list item. A false break
 * shortens every run around it until the measure stops reporting, so it is the
 * dearer error, and a missed break costs one unbroken run.
 *
 * A colon ends most markers, but `review-pr` writes colon-less ones and a bold
 * path heading per file, so two signals stand in where the colon is absent. A
 * label that is one whole code span breaks at any width, since a bold sentence
 * is never a single span. `MARKER_WIDTH` is read off the review bodies and the
 * records tree, where most colon-less labels sit at or under 20 visible
 * characters and the 21 to 30 band holds lines nobody can classify on sight,
 * such as `One change across four files.`. Terminal punctuation separates
 * nothing. A 48-character hand-written marker stays unbroken, since raising
 * the ceiling to reach it re-enters that band.
 *
 * Neither signal caps the colon form, which is its own evidence of a label and
 * reaches genuine markers between 31 and 50 characters.
 */
const BOLD_LINE = /^\*\*([^*]+)\*\*\s*$/
const SPAN_LABEL = /^`[^`]+`$/
const MARKER_WIDTH = 20

export const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+/
export const TABLE_ROW = /^\s*\|/
export const TABLE_SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/
export const BLOCKQUOTE = /^\s*>/

/**
 * A sentence ends on terminal punctuation followed by the start of another
 * sentence or by the end of the paragraph.
 *
 * Requiring a capital after the space keeps a version pin or a decimal from
 * splitting a sentence. An abbreviation before a capital still over-reports by
 * one, which is why this reports rather than gates. A backtick also opens a
 * sentence, since a command name is lowercase, at the price of reading a span
 * opening a mid-paragraph fragment as a start.
 */
const SENTENCE_END = /[.!?]["'’”)\]]*(?=\s+(?:["'“([]*[A-Z]|`)|\s*$)/g

/**
 * Checkpoints the structural measures run against.
 *
 * These are the definition rather than a fallback. Parsing each number out of
 * `claude/skills/markdown-craft/references/markdown.md` was the alternative,
 * and it put a parser contract on prose authored for people. The standard
 * still states every number, so moving one is an edit to both.
 *
 * `cadence`, `spread`, and `opener` come from the `## Rhythm` section of the
 * `write-human` skill: sentences within roughly five words are one cadence, an
 * opener repeating three times is a pattern, and a paragraph needs a third
 * sentence before either says anything.
 */
export const CHECKPOINTS = {
  run: 40,
  peerBullet: 130,
  bullet: 200,
  paragraph: 350,
  sentences: 4,
  renderWidth: 80,
  cadence: 3,
  spread: 5,
  opener: 2,
  ceiling: 300,
} as const

/**
 * The reading a cadence rate is compared against, rather than a checkpoint.
 *
 * A count with nothing beside it reads as a finding, and the two counts the
 * cadence step reports have no range a reader can place them in: twelve flat
 * paragraphs out of forty says the same as two without one. Naming that a
 * healthy range differs by surface states that a range exists rather than what
 * it looks like, so the reading travels with the command.
 *
 * This is an observation rather than a rule, which is why it sits apart from
 * `CHECKPOINTS`. Nothing compares a run against it and no exit code reads it. A
 * project whose corpus is entirely terse reference prose is expected to sit
 * above the high end, and that is the measure working.
 *
 * Read across 483 markdown files at `6c273324` on 2026-08-20. A number here
 * goes stale against the corpus it describes with nothing comparing the two, so
 * re-measure before moving one.
 */
export const BASELINE = {
  /** Share of every measured paragraph sitting at or under the spread checkpoint. */
  flatShare: 8,
  /** Measured paragraphs a file needs before its own rate means anything. */
  floor: 10,
  low: 0,
  median: 6,
  high: 21,
} as const

/**
 * Columns a source line wraps at when rendered.
 *
 * Nothing in this repository sets a line width and entries are authored one
 * line per bullet, so the rendered width is the viewer's rather than the file's.
 */
export const RENDER_WIDTH: number = CHECKPOINTS.renderWidth

export interface Checkpoints {
  readonly run: number
  readonly peerBullet: number
  readonly bullet: number
  readonly paragraph: number
  readonly sentences: number
  readonly renderWidth: number
  /** Sentences a paragraph needs before its cadence is measured at all. */
  readonly cadence: number
  /** Words between the longest and shortest sentence, at or under which the paragraph reads as one cadence. */
  readonly spread: number
  /** Times one opening word may open a sentence in a paragraph before it is a pattern. */
  readonly opener: number
  /**
   * Rendered lines a whole document may reach, read by the Document ceiling
   * gate stage rather than by any exit code of the audit.
   */
  readonly ceiling: number
}

export interface BulletFinding {
  readonly line: number
  /** Weight as folded, so a report says how far past the checkpoint it sits. */
  readonly characters: number
}

export interface ParagraphFinding {
  readonly line: number
  readonly sentences: number
  readonly characters: number
}

/**
 * One measured paragraph, carrying both cadence numbers rather than one.
 *
 * A paragraph reported for a narrow spread is usually worth reading for its
 * openers too, and splitting the two into separate finding types would name the
 * same line twice with half the picture on each.
 */
export interface CadenceFinding {
  readonly line: number
  readonly sentences: number
  /** Words between the longest and shortest sentence. */
  readonly spread: number
  /** Times the most repeated opening word opens a sentence here. */
  readonly repeats: number
  /** The opening word behind `repeats`, lowercased and stripped of punctuation. */
  readonly opener: string
}

/**
 * A file's cadence distribution, reported rather than listed finding by finding.
 *
 * Both numbers are advisory in a way even the weight checkpoints are not. A
 * healthy range differs by surface, so terse reference prose and a page written
 * for a reader sit at different spreads and one range applied across the corpus
 * would report the surfaces that are correct. The counts are what a reader
 * compares against the stated range, and the two worst paragraphs are where
 * they open the file.
 */
export interface CadenceReport {
  /** Paragraphs carrying at least the floor sentence count. */
  readonly measured: number
  /** Measured paragraphs at or under the spread checkpoint. */
  readonly flat: number
  /** Measured paragraphs past the opener checkpoint. */
  readonly repeating: number
  /** Narrowest paragraph among the flat ones, or undefined when none is flat. */
  readonly flattest: CadenceFinding | undefined
  /** Most repetitive paragraph among the repeating ones, or undefined when none repeats. */
  readonly mostRepeated: CadenceFinding | undefined
}

export interface StructureReport {
  readonly rel: string
  /** Rendered lines at the render width, not source lines. */
  readonly longestRun: number
  /** First line of the longest run, or 0 when the file has no run at all. */
  readonly longestRunLine: number
  readonly heavyBullets: readonly BulletFinding[]
  readonly heavyParagraphs: readonly ParagraphFinding[]
  readonly cadence: CadenceReport
}

/**
 * Height a source line occupies once wrapped.
 *
 * A blank line renders as the gap it is rather than as nothing, which keeps it
 * the distance the source measure already counted it as.
 *
 * The width is measured against what renders, since a rendered line shows a
 * link's anchor text rather than its destination and a source measure
 * over-counts exactly where this rule cares how far a reader travels.
 */
export function renderedHeight(text: string, width = RENDER_WIDTH): number {
  return Math.max(1, Math.ceil(visibleText(text).length / width))
}

/**
 * Height a whole source occupies once wrapped, frontmatter and fenced blocks
 * included.
 *
 * Nothing is excluded because a session pays for every line it loads, which is
 * what separates this from the depth measure. The context audit's length
 * reading and the document ceiling both count through here, so the two report
 * one unit.
 */
export function documentHeight(source: string, width = RENDER_WIDTH): number {
  return source
    .replace(/\n$/, '')
    .split('\n')
    .reduce((sum, text) => sum + renderedHeight(text, width), 0)
}

/**
 * Reports whether a run is the peer list the standard exempts.
 *
 * Every non-blank line has to be a list item at one indent. Prose mixed into
 * the run or a nested level inside it ends the exemption, because either one
 * means the block is no longer a flat set a reader can skim. Bullet count says
 * nothing on its own, since a catalog of one-liners and a wall of paragraphs
 * reach the same count and read nothing alike, so the average bullet decides.
 */
function isScannablePeerList(
  run: readonly BodyLine[],
  checkpoint: number,
): boolean {
  const indents = new Set<number>()
  let items = 0
  let characters = 0

  for (const line of run) {
    const text = line.text.trim()
    if (text === '') continue

    const match = line.text.match(LIST_ITEM)
    if (!match) return false
    indents.add(match[1].length)
    items++
    characters += visibleText(text).length
  }

  if (indents.size !== 1) return false

  return characters / items < checkpoint
}

/**
 * Reports whether a run is a table, the second shape the checkpoint cannot fix.
 *
 * The peer list above is exempt because it is already navigable. A table is
 * exempt for the other reason: the remedy does not exist. A heading dropped
 * inside one splits the table into two tables rather than breaking the run.
 *
 * Every non-blank line has to be a row, and a delimiter is required rather than
 * assumed. A run holding a table between paragraphs is genuinely mixed and a
 * heading breaks it at a seam either side, and a stack of lines opening with a
 * pipe and no delimiter renders as paragraph text.
 */
function isTableRun(run: readonly BodyLine[]): boolean {
  let separators = 0

  for (const line of run) {
    if (line.text.trim() === '') continue
    if (!TABLE_ROW.test(line.text)) return false
    if (TABLE_SEPARATOR.test(line.text)) separators++
  }

  return separators > 0
}

/**
 * Reports whether a line is a section marker rather than emphasis.
 *
 * `BOLD_LINE` fixes the shape, and a colon-less label then answers to
 * `SPAN_LABEL` or to `MARKER_WIDTH`, per the record above. Both read visible
 * text, which reduces a link to its anchor text and leaves a backticked path
 * counted whole, the same reading `isScannablePeerList` takes. The reduction is
 * what lets a linked path reach the span test at all, since the markup around
 * it would fail the pattern the destination is still attached.
 */
export function isSectionMarker(text: string): boolean {
  const marker = text.match(BOLD_LINE)
  if (!marker) return false

  const label = marker[1]
  if (label.endsWith(':')) return true

  const visible = visibleText(label)

  return SPAN_LABEL.test(visible) || visible.length <= MARKER_WIDTH
}

/**
 * Measures the longest run of lines no signpost breaks, in rendered lines.
 *
 * A heading breaks a run and so does a section marker, which is the same
 * signpost written the way a template asked for it. `isSectionMarker` above
 * fixes which lines qualify.
 *
 * Fenced lines are skipped rather than treated as breaks, per the standard:
 * they leave the count without ending the run, so prose either side of an
 * example still measures as the one stretch a reader scrolls through. Blank
 * lines do count, since the checkpoint is about how far a reader travels
 * between signposts and a blank line is distance like any other.
 *
 * Height is what a reader travels, and source lines only stand in for it while
 * lines stay short. A file authored one line per bullet puts a paragraph on
 * each, so a block of fifteen bullets measures as fifteen and renders past
 * sixty. Wrapping every line at a stated width is what closes that gap.
 */
export function longestRun(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): { length: number; line: number } {
  let longest = 0
  let longestLine = 0
  let run: BodyLine[] = []

  const close = (): void => {
    // The reported line is the run's first non-blank one, since that is what an
    // editor should open. A run of nothing but blank lines is the gap between
    // two headings rather than a stretch a reader travels, so it never counts.
    const first = run.find((line) => line.text.trim() !== '')

    if (
      first &&
      !isScannablePeerList(run, checkpoints.peerBullet) &&
      !isTableRun(run)
    ) {
      const height = run.reduce(
        (sum, line) => sum + renderedHeight(line.text, checkpoints.renderWidth),
        0,
      )

      if (height > longest) {
        longest = height
        longestLine = first.number
      }
    }
    run = []
  }

  for (const line of lines) {
    if (line.fenced) continue

    if (HEADING.test(line.text) || isSectionMarker(line.text)) {
      close()
      continue
    }

    run.push(line)
  }

  close()

  return { length: longest, line: longestLine }
}

/**
 * Finds the bullets carrying more than a decision, nested ones included.
 *
 * A nested item is measured on its own and never folded into its parent, since
 * the checkpoint asks what one bullet carries and a child carries its own. Lines
 * continuing a bullet do fold in, so a heavy bullet cannot fall under the
 * checkpoint by being wrapped across two source lines. A fenced line closes the
 * open bullet, which keeps a bullet from absorbing the example below it.
 *
 * A bullet is measured without its list marker, the way the `bullet-length`
 * gate measures it, so the count and the gate agree at the checkpoint.
 */
export function heavyBullets(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): BulletFinding[] {
  return foldBullets(lines, checkpoints).map(({ line, characters }) => ({
    line,
    characters,
  }))
}

interface FoldedBullet extends BulletFinding {
  /** The bullet's source lines joined by the space a wrap would have carried. */
  readonly text: string
  /** The width of the indent before the marker, which a continuation must pass. */
  readonly indent: number
}

/** The walk `heavyBullets` reports from. */
function foldBullets(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): FoldedBullet[] {
  const findings: FoldedBullet[] = []
  let open: FoldedBullet | null = null

  const close = (): void => {
    if (open && open.characters > checkpoints.bullet) findings.push(open)
    open = null
  }

  for (const line of lines) {
    if (line.fenced) {
      close()
      continue
    }

    const item = line.text.match(LIST_ITEM)
    const text = line.text.trim()
    const lead = line.text.length - line.text.trimStart().length

    // Structure is read off the raw line and only the weight is masked. A line
    // carrying nothing but an autolink has no visible text at all, and reading
    // its masked form as blank would close the bullet it continues.
    if (item) {
      close()
      open = {
        line: line.number,
        characters: visibleText(text.replace(LIST_ITEM, '')).length,
        text,
        indent: item[1].length,
      }
      continue
    }

    if (text === '' || HEADING.test(line.text) || TABLE_ROW.test(line.text)) {
      close()
      continue
    }

    // An indented line that does not pass the marker's indent belongs to a
    // parent or to nothing, so it ends a nested item rather than extending it.
    if (open && lead > 0 && lead <= open.indent) {
      close()
      continue
    }

    // The joining space a wrapped line would have carried, so folding two
    // source lines measures what one unwrapped line would have.
    if (open)
      open = {
        ...open,
        characters: open.characters + visibleText(text).length + 1,
        text: `${open.text} ${text}`,
      }
  }

  close()

  return findings
}

/**
 * Splits a paragraph into the sentences terminal punctuation closes.
 *
 * A trailing span no punctuation closes is dropped rather than returned, which
 * keeps this and the count below one definition. The pattern already matches a
 * paragraph's final period through its end-of-text alternative, so the only
 * span this drops is a paragraph genuinely ending without terminal punctuation,
 * which is a fragment rather than a sentence to either measure.
 */
function splitSentences(text: string): string[] {
  const sentences: string[] = []
  let start = 0

  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length
    sentences.push(text.slice(start, end).trim())
    start = end
  }

  return sentences
}

function countSentences(text: string): number {
  return splitSentences(text).length
}

/**
 * Splits the body into its prose paragraphs, each a run of consecutive lines.
 *
 * A heading, a list item, a table row, a blockquote, a blank line, and a fence
 * each end one, so a bullet is measured by `heavyBullets` alone and never
 * twice. Both paragraph measures walk this rather than one each, since two
 * walks deciding what a paragraph is would drift apart.
 */
function paragraphBlocks(lines: readonly BodyLine[]): BodyLine[][] {
  const blocks: BodyLine[][] = []
  let block: BodyLine[] = []

  const close = (): void => {
    if (block.length > 0) blocks.push(block)
    block = []
  }

  for (const line of lines) {
    const text = line.text.trim()
    const breaks =
      line.fenced ||
      text === '' ||
      HEADING.test(line.text) ||
      LIST_ITEM.test(line.text) ||
      TABLE_ROW.test(line.text) ||
      BLOCKQUOTE.test(line.text)

    if (breaks) {
      close()
      continue
    }

    block.push(line)
  }

  close()

  return blocks
}

/** Folds a paragraph's source lines into the one line they would have wrapped from. */
function paragraphText(block: readonly BodyLine[]): string {
  return block.map((line) => line.text.trim()).join(' ')
}

/**
 * Finds the prose paragraphs past either half of the standard's checkpoint.
 *
 * Both halves are stated in the standard and both are read from it. The weight
 * half was added there rather than borrowed from the bullet checkpoint, which
 * governs a different construct: one number feeding both would move the
 * paragraph rule whenever the bullet rule was changed, and an author reading
 * the sentence cap would find no weight rule to read at all.
 *
 * They are separate checkpoints, so either moves without dragging the other.
 */
export function heavyParagraphs(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): ParagraphFinding[] {
  const findings: ParagraphFinding[] = []

  for (const block of paragraphBlocks(lines)) {
    const text = paragraphText(block)
    const sentences = countSentences(text)
    const characters = visibleText(text).length

    if (
      sentences > checkpoints.sentences ||
      characters > checkpoints.paragraph
    ) {
      findings.push({ line: block[0].number, sentences, characters })
    }
  }

  return findings
}

/** Punctuation either side of a word, so an opener is compared on its letters. */
const WORD_EDGE = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

/**
 * The word a sentence opens on, lowercased and stripped of punctuation.
 *
 * A sentence opening on a code span yields the command inside it rather than a
 * backtick, which is the word a reader hears. Casing is dropped because an
 * opener repeating is a repetition whether or not one of the two sits mid-list
 * and lost its capital.
 */
function openingWord(sentence: string): string {
  const [first = ''] = sentence.split(/\s+/)
  return first.replace(WORD_EDGE, '').toLowerCase()
}

/**
 * Measures one paragraph's spread and its most repeated opener.
 *
 * Words are counted off the text a reader is shown, so a link contributes its
 * anchor text and a destination contributes nothing. The sentence boundaries do
 * not move with that masking, since the pattern requires whitespace after the
 * terminal punctuation and no destination or autolink carries any.
 */
function measureParagraph(block: readonly BodyLine[]): CadenceFinding {
  const sentences = splitSentences(visibleText(paragraphText(block)))
  const lengths = sentences.map(
    (sentence) => sentence.split(/\s+/).filter(Boolean).length,
  )

  const counts = new Map<string, number>()
  for (const sentence of sentences) {
    const word = openingWord(sentence)
    if (word !== '') counts.set(word, (counts.get(word) ?? 0) + 1)
  }

  let opener = ''
  let repeats = 0
  for (const [word, count] of counts) {
    if (count > repeats) {
      opener = word
      repeats = count
    }
  }

  // A paragraph closing no sentence at all has no spread rather than a
  // negative one, and the floor drops it before either number is read.
  const spread =
    lengths.length === 0 ? 0 : Math.max(...lengths) - Math.min(...lengths)

  return {
    line: block[0].number,
    sentences: sentences.length,
    spread,
    repeats,
    opener,
  }
}

/**
 * Reports how a file's prose is distributed across sentence length and opening
 * word, which is the layer the ban sets cannot reach.
 *
 * A banned-word list expresses negatives and every symptom this answers is the
 * absence of something, so no addition to that set catches a paragraph whose
 * sentences are all one length. The measure stops at what is countable. A
 * sentence's grammatical shape and whether it carries a finite verb are the two
 * rules `write-human` states that this does not implement, since reporting
 * them wrong names the exact failure this exists to measure.
 *
 * Two part-of-speech taggers were tried for the verb rule and rejected.
 * `compromise` tags a fronted past participle, `Measured at`, as a finite verb,
 * which is the exact shape the rule exists to catch. `wink-pos-tagger` fixes
 * that class, but about three quarters of what it flags is still wrong, split
 * between imperatives whose verb tags as a proper noun and declaratives whose
 * noun-ambiguous predicate, as in `Each maps to a skill.`, tags as a noun.
 * Separating those needs the predicate, which is syntax rather than a tag, and
 * no syntax parser was taken for a number nothing gates on.
 *
 * A heading fragment, a list item, and a table cell never reach this, since
 * `paragraphBlocks` ends a paragraph on each. A paragraph under the floor is
 * skipped, since the opener rule needs a third sentence to see a pattern.
 */
export function measureCadence(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): CadenceReport {
  const measured = paragraphBlocks(lines)
    .map(measureParagraph)
    .filter((finding) => finding.sentences >= checkpoints.cadence)

  const flat = measured.filter(
    (finding) => finding.spread <= checkpoints.spread,
  )
  const repeating = measured.filter(
    (finding) => finding.repeats > checkpoints.opener,
  )

  return {
    measured: measured.length,
    flat: flat.length,
    repeating: repeating.length,
    flattest: worst(flat, (finding) => -finding.spread),
    mostRepeated: worst(repeating, (finding) => finding.repeats),
  }
}

/**
 * The file's worst paragraph on one measure, earliest line breaking a tie.
 *
 * Only paragraphs already past their checkpoint are passed in, so a file
 * reading healthy names nothing rather than naming its least healthy paragraph,
 * which a reader would take for a finding.
 */
function worst(
  findings: readonly CadenceFinding[],
  rank: (finding: CadenceFinding) => number,
): CadenceFinding | undefined {
  return findings.reduce<CadenceFinding | undefined>(
    (held, finding) => (!held || rank(finding) > rank(held) ? finding : held),
    undefined,
  )
}

export function measureStructure(
  rel: string,
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): StructureReport {
  const run = longestRun(lines, checkpoints)

  return {
    rel,
    longestRun: run.length,
    longestRunLine: run.line,
    heavyBullets: heavyBullets(lines, checkpoints),
    heavyParagraphs: heavyParagraphs(lines, checkpoints),
    cadence: measureCadence(lines, checkpoints),
  }
}
