import { type BodyLine, visibleText } from '@/markdown/scan'

export const HEADING = /^#{1,6}\s/

/**
 * A section marker holding its line alone, the signpost a document uses where
 * its template asks for bold rather than a heading. A colon form has no width
 * cap, and a colonless label breaks as a code span or within `MARKER_WIDTH`.
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
 * sentence or the paragraph end. A capital after the space keeps a version pin
 * or decimal whole, and an abbreviation before a capital over-reports by one.
 */
const SENTENCE_END = /[.!?]["'’”)\]]*(?=\s+(?:["'“([]*[A-Z]|`)|\s*$)/g

/**
 * Checkpoints the structural measures run against. These are the definition
 * rather than parsed from the markdown standard, which would put a parser
 * contract on prose, so the standard states every number and moving one edits both.
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
  docsCeiling: 200,
} as const

/**
 * The reading a cadence rate is compared against, rather than a checkpoint. It
 * is an observation, so nothing compares a run against it and no exit code reads
 * it. A number here goes stale against its corpus, so re-measure before moving one.
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
  /**
   * Rendered lines a consumer guide under `docs/` may reach, lower than
   * `ceiling` since a person reads it rather than an agent loading it on demand.
   */
  readonly docsCeiling: number
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
 * One measured paragraph, carrying both cadence numbers, since a paragraph
 * reported for a narrow spread is usually worth reading for its openers too and
 * two finding types would name the same line twice.
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
 * Both numbers are advisory, since a healthy range differs by surface, so the
 * counts are compared against the stated range and the two worst paragraphs are named.
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
 * Height a source line occupies once wrapped. A blank line renders as the gap it
 * is, and the width is measured against what renders, since a link shows its
 * anchor text and a source measure over-counts where a reader's travel matters.
 */
export function renderedHeight(text: string, width = RENDER_WIDTH): number {
  return Math.max(1, Math.ceil(visibleText(text).length / width))
}

/**
 * Height a whole source occupies once wrapped, frontmatter and fenced blocks
 * included, since a session pays for every line it loads. The context audit's
 * length reading and the document ceiling both count through here.
 */
export function documentHeight(source: string, width = RENDER_WIDTH): number {
  return source
    .replace(/\n$/, '')
    .split('\n')
    .reduce((sum, text) => sum + renderedHeight(text, width), 0)
}

/**
 * Reports whether a run is the peer list the standard exempts. Every non-blank
 * line has to be a list item at one indent, since prose or a nested level means
 * the block is no longer a flat set, and the average bullet decides, not the count.
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
 * Reports whether a run is a table, the second shape the checkpoint cannot fix,
 * since a heading dropped inside splits it in two. Every non-blank line has to
 * be a row and a delimiter is required, as pipe lines without one render as paragraph text.
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
 * Reports whether a line is a section marker rather than emphasis. `BOLD_LINE`
 * fixes the shape and a colonless label answers to `SPAN_LABEL` or `MARKER_WIDTH`.
 * Both read visible text, so a linked path reaches the span test at all.
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
 * Measures the longest run of lines no signpost breaks, in rendered lines. A
 * heading or section marker breaks a run, fenced lines leave the count without
 * ending it, and blank lines count, since they are distance a reader travels.
 */
export function longestRun(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): { length: number; line: number } {
  let longest = 0
  let longestLine = 0
  let run: BodyLine[] = []

  const close = (): void => {
    // Report the run's first non-blank line, and never a run of blanks, which is the gap between headings.
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
 * Finds the bullets carrying more than a decision, nested ones included. A
 * nested item is measured on its own, continuation lines fold in, and a fenced
 * line closes the bullet. It is measured without its marker, as the gate does.
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

    // Structure is read off the raw line, since an autolink-only line masks to blank and would close the bullet.
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

    // An indented line not past the marker's indent belongs to a parent or nothing, so it ends a nested item.
    if (open && lead > 0 && lead <= open.indent) {
      close()
      continue
    }

    // The joining space a wrapped line would have carried, so folding two lines measures one unwrapped line.
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
 * Splits a paragraph into the sentences terminal punctuation closes. A trailing
 * span no punctuation closes is dropped, which keeps this and the count below one
 * definition, since such a span is a fragment rather than a sentence.
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
 * Splits the body into its prose paragraphs, each a run of consecutive lines. A
 * heading, list item, table row, blockquote, blank line, and fence end one, and
 * both paragraph measures walk this, since two walks would drift apart.
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
 * Finds the prose paragraphs past either half of the standard's checkpoint. The
 * weight half is its own number rather than borrowed from the bullet checkpoint,
 * so either moves without dragging the other.
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
 * The word a sentence opens on, lowercased and stripped of punctuation. A code
 * span yields the command inside it, which is the word a reader hears, and casing
 * is dropped since a repeated opener is a repetition whatever its capital.
 */
function openingWord(sentence: string): string {
  const [first = ''] = sentence.split(/\s+/)
  return first.replace(WORD_EDGE, '').toLowerCase()
}

/**
 * Measures one paragraph's spread and its most repeated opener. Words are
 * counted off the text a reader is shown, and sentence boundaries do not move
 * with that masking, since the pattern requires whitespace after the punctuation.
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

  // A paragraph closing no sentence has no spread rather than a negative one, and the floor drops it.
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
 * word, the layer a ban list cannot reach. It stops at what is countable, since
 * taggers misread fronted participles, and a paragraph under the floor is skipped.
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
 * The file's worst paragraph on one measure, earliest line breaking a tie. Only
 * paragraphs already past their checkpoint are passed in, so a healthy file names
 * nothing rather than its least healthy paragraph.
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
