import { type BodyLine, visibleText } from '@/markdown/scan'

const HEADING = /^#{1,6}\s/

/**
 * A section marker holding its line alone, which is the signpost a document
 * uses where its own template asks for bold rather than a heading.
 *
 * `standards/plan.md` gives `## Summary` a heading and marks the four sections
 * below it this way, so a conforming plan read as one run from its first line
 * to its last and all seven live plans reported past the depth checkpoint, at
 * 106 to 166 rendered lines. A measure firing on a whole corpus says nothing
 * about it, and it costs more than silence, since a reader who learns to skip
 * the depth section skips it on the file where a deep run genuinely sits.
 *
 * Breaking on the marker clears two of those seven and moves the other five
 * onto the seams inside them, at 42 to 77 lines, which is the measure telling
 * a long section from a long file for the first time. Moving the template to
 * headings was the alternative and it clears no plan already written, leaving
 * each flagged until someone rewrites it.
 *
 * The marker starts at column zero and the whole line is the marker or none of
 * it is. A bold phrase opening a sentence is emphasis rather than a seam, and
 * an indented one is a label inside a list item, so both stay prose. This ships
 * as package data every project reads, where a missed break costs one unbroken
 * run and a false one shortens every run around it until the measure stops
 * reporting, which is the dearer of the two.
 *
 * A colon ends most markers and not all of them. `review-pr` writes
 * three colon-less ones into every body it posts and a bold path heading for
 * each file it reviews, so requiring the colon held a real seam out. Two
 * signals stand in where the colon is absent, because the shape a marker has to
 * be told from is a sentence set in bold and no one test separates both kinds
 * of marker from it.
 *
 * A label that is one whole code span breaks at any width. A path runs long and
 * a sentence set in bold is never a single span, so shape settles this half
 * where width cannot. Across 81 colon-less markers in the review bodies posted
 * on this repository, the 30 path headings run from 20 to 70 characters, and no
 * colon-less line in the records tree is a whole span at all, so the rule adds
 * reach without adding a false break.
 *
 * `MARKER_WIDTH` covers the rest and is read off the corpus rather than picked.
 * Of the remaining 51 markers in those review bodies, 50 sit at or under 20
 * visible characters, and so do 48 of the 94 colon-less lines in the records
 * tree at `9960a4d7`, every one of them a label. The 21 to 30 band above it
 * holds 8 lines nobody can classify on sight, where `One change across four
 * files.` reads as a sentence and `Rule plus a mechanical half` reads as a
 * seam, so the ceiling sits under that band rather than over it. That is where
 * the asymmetry above points, a false break being the dearer error. Terminal
 * punctuation separates nothing, since 45 of the 48 shortest colon-less lines
 * end in one.
 *
 * Both signals govern the colon-less shape alone. A colon is its own evidence
 * of a label, and capping the colon form as well takes the break back from four
 * markers between 31 and 50 characters that already have it, every one of them
 * a genuine section marker.
 *
 * One marker in that review corpus is reached by neither signal, a 48-character
 * heading a session wrote by hand rather than from the template. Widening to
 * catch it means raising the ceiling back through the band, so it is left as
 * the cheap error the asymmetry above already names.
 */
const BOLD_LINE = /^\*\*([^*]+)\*\*\s*$/
const SPAN_LABEL = /^`[^`]+`$/
const MARKER_WIDTH = 20

const LIST_ITEM = /^(\s*)([-*+]|\d+\.)\s+/
const TABLE_ROW = /^\s*\|/
const TABLE_SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/
const BLOCKQUOTE = /^\s*>/

/**
 * A sentence ends on terminal punctuation followed by the start of another
 * sentence or by the end of the paragraph.
 *
 * Requiring an opening capital after the space is what keeps a version pin and
 * a decimal from each reading as two sentences, since neither is followed by
 * one. An abbreviation ahead of a capitalized word still counts, which
 * over-reports by one on the sentence that carries it and is why this measure
 * reports rather than gates.
 *
 * A code span opens a sentence that carries no capital at all, since a command
 * name is lowercase and the requirement above would catch nothing there. The
 * backtick therefore stands alone rather than joining the delimiters a capital
 * follows, and the price is that a span opening a fragment mid-paragraph reads
 * as a sentence start.
 */
const SENTENCE_END = /[.!?]["'’”)\]]*(?=\s+(?:["'“(\[]*[A-Z]|`)|\s*$)/g

/**
 * Checkpoints the structural measures run against.
 *
 * These are the definition rather than a fallback. Reading each number out of
 * the sentence `standards/markdown.md` states it in was the alternative, and it
 * put a parser contract on a document authored for people, where a rewording
 * degraded a number and the report had to carry a legend saying which one. The
 * standard still states every number for a reader, and moving one is an edit to
 * both.
 *
 * The last three come from the `## Rhythm` section of the `write-human` skill
 * rather than from a standard. That skill states what good rhythm is and this
 * measures against the statement, so the numbers are read off the sentences
 * that already carry them: a longest and shortest sentence within roughly five
 * words of each other is one cadence, an opening word repeating twice is
 * coincidence and three times is a pattern, and both rules are written about a
 * paragraph, which needs a third sentence before either says anything.
 */
export const CHECKPOINTS = {
  run: 40,
  peerBullet: 130,
  bullet: 400,
  paragraph: 700,
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
function isSectionMarker(text: string): boolean {
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
 * Finds the top-level bullets carrying more than a decision.
 *
 * A nested item is left out rather than folded into its parent, since the
 * checkpoint asks what one bullet carries and a child carries its own. Lines
 * continuing a bullet do fold in, so a heavy bullet cannot fall under the
 * checkpoint by being wrapped across two source lines. A fenced line closes the
 * open bullet, which keeps a bullet from absorbing the example below it.
 */
export function heavyBullets(
  lines: readonly BodyLine[],
  checkpoints: Checkpoints,
): BulletFinding[] {
  const findings: BulletFinding[] = []
  let open: BulletFinding | null = null

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

    // Structure is read off the raw line and only the weight is masked. A line
    // carrying nothing but an autolink has no visible text at all, and reading
    // its masked form as blank would close the bullet it continues.
    if (item) {
      close()
      if (item[1].length === 0) {
        open = { line: line.number, characters: visibleText(text).length }
      }
      continue
    }

    if (text === '' || HEADING.test(line.text) || TABLE_ROW.test(line.text)) {
      close()
      continue
    }

    // The joining space a wrapped line would have carried, so folding two
    // source lines measures what one unwrapped line would have.
    if (open)
      open = {
        ...open,
        characters: open.characters + visibleText(text).length + 1,
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
 * The two numbers coincide today because paragraph and bullet weight measure
 * one population, sharing a median near 170 characters with no gap behind
 * either candidate. They are separate checkpoints regardless, so either moves
 * without dragging the other.
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
 * rules `write-human` states that this does not implement. Reporting them wrong
 * is worse than not reporting them, since they name the exact failure this
 * exists to measure.
 *
 * That was a prediction and it has now been measured, against two parsers
 * rather than against the idea of one. Both ran over 11,389 paragraph sentences
 * across 503 markdown files at `c7e92612` on 2026-08-20, and they disagree by
 * a factor of four on a number one of them has to be wrong about.
 *
 * `compromise` reported 2 percent. It tags a fronted past participle as a
 * finite past-tense verb, so all twelve of those sentences in
 * `.claude/ARCHITECTURE.md` read as carrying one, eleven opening `Measured at`
 * and one `Overturned by`, which is the exact shape the measure exists to
 * catch. It is not even consistent with itself there: `Measured at` tags a verb
 * and `Measured against` tags an adjective.
 *
 * `wink-pos-tagger` reported 9 percent and fixes that class, tagging the
 * participle `VBN`. Roughly three quarters of what it flags is still wrong:
 * hand-classifying every 21st of the 1,071 flagged sentences put 12 of 51
 * genuinely verbless. Two classes split the other 39 almost evenly and neither
 * is a tuning problem. Nineteen are imperatives, which this instructional
 * corpus is full of and whose verb tags as a proper noun as often as a verb.
 * Twenty are ordinary declaratives whose predicate is noun-ambiguous and tags
 * as a noun outright, so `Each maps to a skill.` and `Nothing checks either
 * one.` both report verbless. This corpus is built from exactly those words:
 * reports, answers, checks, maps, holds, names, carries, records, measures.
 *
 * Separating them needs to know which token is the predicate, which is syntax
 * rather than a tag. Neither tagger carries one and nothing was found worth
 * taking for a number nothing gates on, so the rule the deferral set is met and
 * still returns no: a parse was tried, twice, and neither produced a number
 * worth printing beside two that hold.
 *
 * Where a shape sits is a different question and is already answered. A heading
 * fragment, a list item, and a table cell are all legitimately verbless and
 * none of them reaches this measure, because `paragraphBlocks` ends a paragraph
 * on each. That exclusion is structural and needs no grammar. The imperative is
 * the one that sits in paragraph prose, and it is what neither parser could
 * separate out.
 *
 * A paragraph under the floor is skipped rather than scored. A two-sentence
 * configuration note has no spread worth reading, and the opener rule is
 * written about a third sentence turning a coincidence into a pattern, so
 * neither measure says anything before the floor is reached.
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
