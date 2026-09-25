import { describe, expect, it } from 'vitest'
import { bodyLines } from '@/markdown/scan'
import {
  BASELINE,
  CHECKPOINTS,
  type Checkpoints,
  documentHeight,
  measureStructure,
  RENDER_WIDTH,
} from '@/markdown/structure'

const FRONTMATTER = '---\ntitle: CI\ndescription: A domain\n---\n\n'

/** Bullet counts the exempt catalog and the reported wall both hit. */
const PEER_COUNT = 55

/** Characters a bullet averages in each of the two shapes the corpus holds. */
const CATALOG_BULLET = 94
const PARAGRAPH_BULLET = 394

const RUN_CHECKPOINT = CHECKPOINTS.run
const BULLET_CHECKPOINT = CHECKPOINTS.bullet
const PARAGRAPH_CHECKPOINT = CHECKPOINTS.paragraph

function measure(source: string) {
  return measureStructure('ci.md', bodyLines(source), CHECKPOINTS)
}

function prose(count: number): string {
  return Array.from({ length: count }, (_, index) => `Line ${index + 1}.`).join(
    '\n',
  )
}

function bullets(count: number, indent = ''): string {
  return Array.from(
    { length: count },
    (_, index) => `${indent}- Item ${index + 1}`,
  ).join('\n')
}

function weightedBullets(count: number, width: number): string {
  return Array.from({ length: count }, (_, index) =>
    `- Item ${index + 1} `.padEnd(width, 'weight '),
  ).join('\n')
}

function table(rows: string[]): string {
  return ['| Name | Purpose |', '| --- | --- |', ...rows].join('\n')
}

function catalogRows(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `| \`canon cmd-${index}\` | Does a thing |`,
  )
}

/** A bullet of an exact character count, so a boundary case lands on it. */
function bullet(characters: number): string {
  return `- ${'w'.repeat(characters - 2)}`
}

/** Links whose destinations outweigh the anchor text a reader is shown. */
function links(count: number): string {
  return Array.from(
    { length: count },
    (_, index) =>
      `[text ${index}](https://x.test/a/very/long/destination/${index})`,
  ).join(' ')
}

/**
 * A paragraph whose sentences carry the stated word counts and opening words,
 * so spread and opener repetition vary independently of each other.
 */
function passage(
  lengths: readonly number[],
  openers?: readonly string[],
): string {
  return lengths
    .map((length, index) => {
      const opener = openers?.[index] ?? `Word${index}`
      const rest = Array.from({ length: length - 1 }, () => 'filler')
      return `${[opener, ...rest].join(' ')}.`
    })
    .join(' ')
}

/** Sentences of a stated length, so weight and count vary independently. */
function sentences(count: number, width = 20): string {
  return Array.from(
    { length: count },
    (_, index) => `S${index + 1} ${'w'.repeat(width)}.`,
  ).join(' ')
}

describe('CHECKPOINTS', () => {
  it('should ship the numbers the structural measures run against', () => {
    // Asserted rather than read back off `standards/markdown.md`, which is what
    // the parser this replaced did. The standard states each number for a
    // reader and no machine reads it, so a number moving in one place and not
    // the other is caught by whoever edits rather than by a stage.
    expect(CHECKPOINTS).toEqual({
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
    })
  })
})

describe('documentHeight', () => {
  it('counts a line past the render width as the lines it wraps to', () => {
    const source = `# Title\n\n${'a'.repeat(RENDER_WIDTH * 2 + 1)}\n`

    expect(documentHeight(source)).toBe(5)
  })
})

describe('BASELINE', () => {
  it('should ship the reading a cadence rate is compared against', () => {
    // Asserted the way `CHECKPOINTS` is, and for a different reason. No measure
    // reads these, so nothing else in the suite would notice one moving, and
    // the report prints all five straight into the legend a reader acts on.
    expect(BASELINE).toEqual({
      flatShare: 8,
      floor: 10,
      low: 0,
      median: 6,
      high: 21,
    })
  })

  it('should sit the median inside the range it is drawn from', () => {
    expect(BASELINE.median).toBeGreaterThanOrEqual(BASELINE.low)
    expect(BASELINE.median).toBeLessThanOrEqual(BASELINE.high)
  })
})

describe('longestRun', () => {
  it('should report the longest run of lines no heading breaks', () => {
    const source = `${FRONTMATTER}# CI\n\n${prose(60)}\n\n## Layout\n\n${prose(5)}\n`

    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should point at the first non-blank line of the longest run', () => {
    const source = `${FRONTMATTER}# CI\n\n${prose(60)}\n`

    expect(measure(source).longestRunLine).toBe(8)
  })

  it('should let a heading of any level break a run', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n#### Seam\n\n${half}\n`

    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should let a section marker on its own line break a run', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Risks:**\n\n${half}\n`

    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should still report a long section two markers sit either side of', () => {
    const source = `${FRONTMATTER}# CI\n\n**Constraints:**\n\n${prose(60)}\n\n**Risks:**\n\n${prose(2)}\n`

    // The case separating this fix from one that disables the measure. Every
    // plan in the folder cleared the checkpoint on the marker break, so without
    // a deep run reported between two markers, a corpus reading clean says
    // nothing about whether the checkpoint still discriminates.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to an indented section marker', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n  **Risks:**\n\n${half}\n`

    // An indented marker is a label inside a list item rather than a document
    // seam. A false break shortens every run around it, which is the direction
    // that quietly stops the measure reporting.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should let a short bold section marker carrying no colon break a run', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Testing**\n\n${half}\n`

    // The fixture that proved the narrow pattern held this shape out, kept in
    // place asserting the other direction. `review-pr` writes this
    // marker into every body it posts, so the break is a shipped seam rather
    // than a hypothetical one.
    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to a bold sentence past the marker width', () => {
    const half = prose(30)
    const sentence = '**The pass found four things, and it took one read.**'
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${sentence}\n\n${half}\n`

    // The half of the widening that keeps the measure reporting. A colon-less
    // bold line is a marker or a sentence set in bold, and a false break
    // shortens every run around it until the measure stops reporting.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to a bold phrase inside the ambiguous band', () => {
    const half = prose(30)
    const band = '**Two seeds and a behavior line**'
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${band}\n\n${half}\n`

    // 29 characters, from the 21 to 30 band the corpus cannot classify on
    // sight. The ceiling sits under that band rather than over it, since a
    // false break is the dearer error of the two.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should let a bold path label break a run past the marker width', () => {
    const half = prose(30)
    const path = '**`src/markdown/structure.ts`**'
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${path}\n\n${half}\n`

    // 27 characters, so width alone holds it out. `review-pr` heads each
    // file it reviews this way and those paths run to 70 characters, which is
    // the reach the span test buys that no ceiling can.
    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should break on a section marker carrying trailing whitespace', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Risks:**  \n\n${half}\n`

    // Column zero is what the pattern anchors, so a trailing space cannot cost
    // a break the author wrote.
    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to a bold phrase sharing its line with prose', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Emphasis:** and the sentence carries on.\n\n${half}\n`

    // Emphasis opening a sentence is not a seam, and this measure ships as
    // package data every project reads, so the pattern demands the whole line.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should not count a heading that is markdown inside a fenced block', () => {
    const source = `${FRONTMATTER}# CI\n\n${prose(20)}\n\n\`\`\`markdown\n## Not a real heading\n\n### Nor this\n\`\`\`\n\n${prose(20)}\n`

    // The fence neither breaks the run nor adds to it, so the two prose
    // stretches measure as the single run a reader scrolls through.
    expect(measure(source).longestRun).toBe(43)
  })

  it('should keep a four-backtick block closed against the three inside it', () => {
    const inner = `\`\`\`markdown\n## Not a real heading\n\`\`\``
    const source = `${FRONTMATTER}# CI\n\n${prose(20)}\n\n\`\`\`\`markdown\n${inner}\n\`\`\`\`\n\n${prose(20)}\n`

    // A walker toggling on any backtick run reads the inner closing fence as an
    // opening and inverts the rest of the file, which is what reported ten
    // closing fences as bare during intake.
    expect(measure(source).longestRun).toBe(43)
  })

  it('should exempt a run whose lines are all list items at one level', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullets(60)}\n`

    expect(measure(source).longestRun).toBe(0)
  })

  it('should count a wrapped line as the rows it renders', () => {
    const source = `${FRONTMATTER}# CI\n\n${'x'.repeat(RENDER_WIDTH * 3)}\n`

    // The blank line after the heading is one row and the long line is three.
    expect(measure(source).longestRun).toBe(4)
  })

  it('should wrap a link-heavy line at the width its anchor text renders', () => {
    const source = `${FRONTMATTER}# CI\n\n${links(10)}\n`

    // Raw the line wraps seven times. A rendered line shows anchor text rather
    // than destinations, so the run is the blank line plus the one row it fills.
    expect(links(10).length).toBeGreaterThan(RENDER_WIDTH * 6)
    expect(measure(source).longestRun).toBe(2)
  })

  it('should exempt a flat catalog of short peers', () => {
    const source = `${FRONTMATTER}# CI\n\n${weightedBullets(PEER_COUNT, CATALOG_BULLET)}\n`

    expect(measure(source).longestRun).toBe(0)
  })

  it('should report paragraph bullets at the count the catalog is exempt at', () => {
    const source = `${FRONTMATTER}# CI\n\n${weightedBullets(PEER_COUNT, PARAGRAPH_BULLET)}\n`

    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should report a bullet block whose source lines stay under the checkpoint', () => {
    const source = `${FRONTMATTER}# CI\n\n${weightedBullets(15, PARAGRAPH_BULLET)}\n`

    // Fifteen bullets and a blank line are sixteen source lines, so only the
    // rendered measure reaches the checkpoint.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should end the exemption when the list nests a second level', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullets(30)}\n${bullets(30, '  ')}\n`

    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should end the exemption when prose is mixed into the list', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullets(30)}\nA sentence between them.\n${bullets(30)}\n`

    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should exempt a run whose lines are all table rows', () => {
    const source = `${FRONTMATTER}# CI\n\n${table(catalogRows(45))}\n`

    expect(measure(source).longestRun).toBe(0)
  })

  it('should end the table exemption when prose sits either side of it', () => {
    const source = `${FRONTMATTER}# CI\n\n${prose(2)}\n\n${table(catalogRows(45))}\n\n${prose(2)}\n`

    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should refuse the table exemption to piped lines carrying no delimiter', () => {
    const source = `${FRONTMATTER}# CI\n\n${catalogRows(45).join('\n')}\n`

    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })
})

describe('heavyBullets', () => {
  it('should report a top-level bullet past the character checkpoint', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullet(BULLET_CHECKPOINT + 1)}\n`

    expect(measure(source).heavyBullets).toEqual([
      { line: 8, characters: BULLET_CHECKPOINT + 1 },
    ])
  })

  it('should leave a bullet at the checkpoint unreported', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullet(BULLET_CHECKPOINT)}\n`

    expect(measure(source).heavyBullets).toEqual([])
  })

  it('should leave a nested bullet unreported', () => {
    const source = `${FRONTMATTER}# CI\n\n- Parent\n  ${bullet(BULLET_CHECKPOINT + 1)}\n`

    expect(measure(source).heavyBullets).toEqual([])
  })

  it('should ignore a bullet that is an example inside a fenced block', () => {
    const source = `${FRONTMATTER}# CI\n\n\`\`\`markdown\n${bullet(BULLET_CHECKPOINT + 1)}\n\`\`\`\n`

    expect(measure(source).heavyBullets).toEqual([])
  })

  it('should measure a link-heavy bullet against the text a reader sees', () => {
    const item = `- ${links(10)}`
    const source = `${FRONTMATTER}# CI\n\n${item}\n`

    expect(item.length).toBeGreaterThan(BULLET_CHECKPOINT)
    expect(measure(source).heavyBullets).toEqual([])
  })

  it('should fold a continuation line into the bullet it belongs to', () => {
    const half = Math.ceil((BULLET_CHECKPOINT + 1) / 2)
    const source = `${FRONTMATTER}# CI\n\n${bullet(half)}\n${'w'.repeat(half)}\n`

    // Neither source line reaches the checkpoint on its own, so a wrapped
    // bullet only reports once the two are measured as the one bullet they are.
    expect(measure(source).heavyBullets).toEqual([
      { line: 8, characters: half * 2 + 1 },
    ])
  })
})

describe('heavyParagraphs', () => {
  it('should report a paragraph past the sentence checkpoint', () => {
    const source = `${FRONTMATTER}# CI\n\n${sentences(CHECKPOINTS.sentences + 1)}\n`

    const [found] = measure(source).heavyParagraphs
    expect(found.line).toBe(8)
    expect(found.sentences).toBe(CHECKPOINTS.sentences + 1)
  })

  it('should leave a paragraph at the sentence checkpoint unreported', () => {
    const source = `${FRONTMATTER}# CI\n\n${sentences(CHECKPOINTS.sentences)}\n`

    expect(measure(source).heavyParagraphs).toEqual([])
  })

  it('should report a short-sentence-count paragraph past the weight checkpoint', () => {
    const source = `${FRONTMATTER}# CI\n\n${sentences(2, PARAGRAPH_CHECKPOINT)}\n`

    // A sentence cap alone is satisfied by writing fewer and longer ones. The
    // heaviest paragraph measured across the corpus ran 1159 characters in two
    // sentences and passed every sentence count.
    const [found] = measure(source).heavyParagraphs
    expect(found.sentences).toBe(2)
    expect(found.characters).toBeGreaterThan(PARAGRAPH_CHECKPOINT)
  })

  it('should measure weight against its own checkpoint rather than the bullet one', () => {
    const lowered: Checkpoints = { ...CHECKPOINTS, paragraph: 120 }
    const source = `${FRONTMATTER}# CI\n\n${sentences(2, 80)}\n`

    // Lowering the paragraph number well under the bullet one is what shows
    // which of the two the paragraph measure reads, whatever the standard says.
    expect(measure(source).heavyParagraphs).toEqual([])
    expect(
      measureStructure('ci.md', bodyLines(source), lowered).heavyParagraphs,
    ).toHaveLength(1)
  })

  it('should measure a link-heavy paragraph against the text a reader sees', () => {
    // Sized from the checkpoint rather than fixed, since a raw length that has
    // to sit past it tests nothing on the run that moves the number.
    const paragraph = links(Math.ceil(PARAGRAPH_CHECKPOINT / 40))
    const source = `${FRONTMATTER}# CI\n\n${paragraph}\n`

    // Measured across the corpus this is the single largest correction: the
    // heaviest paragraph ran 1159 raw characters against 319 a reader is shown.
    expect(paragraph.length).toBeGreaterThan(PARAGRAPH_CHECKPOINT)
    expect(measure(source).heavyParagraphs).toEqual([])
  })

  it('should report the visible weight rather than the raw one', () => {
    const paragraph = `${links(10)} ${'w'.repeat(PARAGRAPH_CHECKPOINT)}`
    const source = `${FRONTMATTER}# CI\n\n${paragraph}\n`

    const [found] = measure(source).heavyParagraphs
    expect(found.characters).toBeGreaterThan(PARAGRAPH_CHECKPOINT)
    expect(found.characters).toBeLessThan(paragraph.length)
  })

  it('should fold the lines of a wrapped paragraph into one measure', () => {
    const half = 'w'.repeat(Math.ceil(PARAGRAPH_CHECKPOINT / 2))
    const source = `${FRONTMATTER}# CI\n\n${half}\n${half}\n`

    expect(measure(source).heavyParagraphs).toHaveLength(1)
  })

  it('should end a paragraph at a blank line', () => {
    const half = sentences(CHECKPOINTS.sentences - 1)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${half}\n`

    expect(measure(source).heavyParagraphs).toEqual([])
  })

  it('should leave a heavy bullet to the bullet measure rather than counting it twice', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullet(BULLET_CHECKPOINT + 1)}\n`

    expect(measure(source).heavyParagraphs).toEqual([])
    expect(measure(source).heavyBullets).toHaveLength(1)
  })

  it('should ignore a paragraph that is an example inside a fenced block', () => {
    const source = `${FRONTMATTER}# CI\n\n\`\`\`markdown\n${sentences(CHECKPOINTS.sentences + 3)}\n\`\`\`\n`

    expect(measure(source).heavyParagraphs).toEqual([])
  })

  it('should not read a version pin as the end of a sentence', () => {
    const source = `${FRONTMATTER}# CI\n\nThe pin is 0.63.1 for now.\n`

    expect(measure(source).heavyParagraphs).toEqual([])
  })

  it('should not read a decimal as the end of a sentence', () => {
    const source = `${FRONTMATTER}# CI\n\nThe cap is 4.5 for now.\n`

    expect(measure(source).heavyParagraphs).toEqual([])
  })

  it('should close a sentence where the next one opens on a code span', () => {
    const paragraph = [
      'The verb reads the standard.',
      '`canon markdown audit` reports the count.',
      '`canon records push` carries the folders.',
      '`canon indexes regen` rewrites the file.',
      '`canon claude sync` installs the skills.',
    ].join(' ')
    const source = `${FRONTMATTER}# CI\n\n${paragraph}\n`

    // A command name is lowercase, so a boundary resting on a capital alone
    // finds none of the four these spans open.
    const [found] = measure(source).heavyParagraphs
    expect(found.sentences).toBe(5)
  })
})

describe('measureCadence', () => {
  it('should report a paragraph whose sentences are all one length as flat', () => {
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 10])}\n`

    const { measured, flat, flattest } = measure(source).cadence
    expect(measured).toBe(1)
    expect(flat).toBe(1)
    expect(flattest?.spread).toBe(0)
  })

  it('should leave a paragraph whose sentence lengths vary unreported', () => {
    const source = `${FRONTMATTER}# CI\n\n${passage([4, 12, 22])}\n`

    const { measured, flat, flattest } = measure(source).cadence
    expect(measured).toBe(1)
    expect(flat).toBe(0)
    expect(flattest).toBeUndefined()
  })

  it('should report a spread sitting exactly on the checkpoint', () => {
    const spread = CHECKPOINTS.spread
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 10 + spread])}\n`

    // The skill calls a longest and shortest sentence within roughly five words
    // of each other one cadence, so the checkpoint is the last flat value
    // rather than the first varied one.
    expect(measure(source).cadence.flat).toBe(1)
  })

  it('should leave a spread one word past the checkpoint unreported', () => {
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 11 + CHECKPOINTS.spread])}\n`

    expect(measure(source).cadence.flat).toBe(0)
  })

  it('should report a paragraph where one word opens three sentences', () => {
    const openers = ['The', 'The', 'The']
    const source = `${FRONTMATTER}# CI\n\n${passage([4, 12, 22], openers)}\n`

    const { repeating, mostRepeated } = measure(source).cadence
    expect(repeating).toBe(1)
    expect(mostRepeated?.opener).toBe('the')
    expect(mostRepeated?.repeats).toBe(3)
  })

  it('should leave two sentences opening alike unreported as coincidence', () => {
    const openers = ['The', 'The', 'Beta']
    const source = `${FRONTMATTER}# CI\n\n${passage([4, 12, 22], openers)}\n`

    const { repeating, mostRepeated } = measure(source).cadence
    expect(repeating).toBe(0)
    expect(mostRepeated).toBeUndefined()
  })

  it('should read an opener through the code span that carries it', () => {
    const openers = ['`canon`', '`canon`', '`canon`']
    const source = `${FRONTMATTER}# CI\n\n${passage([4, 12, 22], openers)}\n`

    // A sentence opening on a command name repeats as plainly as one opening on
    // a word, and the backticks are punctuation a reader does not hear.
    expect(measure(source).cadence.mostRepeated?.opener).toBe('canon')
  })

  it('should leave a paragraph under the sentence floor unmeasured', () => {
    const source = `${FRONTMATTER}# CI\n\n${passage([4, 22])}\n`

    // A two-sentence configuration note carries a spread of 18 words and says
    // nothing about cadence, which is the case the floor exists for.
    expect(measure(source).cadence).toEqual({
      measured: 0,
      flat: 0,
      repeating: 0,
      flattest: undefined,
      mostRepeated: undefined,
    })
  })

  it('should count the words a reader is shown rather than the source tokens', () => {
    const linked = 'Alpha <https://x.test/one> <https://x.test/two> omega.'
    const source = `${FRONTMATTER}# CI\n\n${linked} ${passage([2, 2])}\n`

    // Raw the linked sentence carries four tokens against two a reader reads,
    // which would report a spread the page does not have.
    expect(measure(source).cadence.flattest?.spread).toBe(0)
  })

  it('should name the narrowest paragraph as the file worst', () => {
    const wide = passage([8, 8, 12])
    const narrow = passage([9, 9, 9])
    const source = `${FRONTMATTER}# CI\n\n${wide}\n\n${narrow}\n`

    const { measured, flat, flattest } = measure(source).cadence
    expect(measured).toBe(2)
    expect(flat).toBe(2)
    expect(flattest?.line).toBe(10)
  })

  it('should ignore a paragraph that is an example inside a fenced block', () => {
    const source = `${FRONTMATTER}# CI\n\n\`\`\`markdown\n${passage([10, 10, 10])}\n\`\`\`\n`

    expect(measure(source).cadence.measured).toBe(0)
  })

  it('should leave a bullet to the bullet measure rather than reading its cadence', () => {
    const source = `${FRONTMATTER}# CI\n\n- ${passage([10, 10, 10])}\n`

    expect(measure(source).cadence.measured).toBe(0)
  })

  it('should keep a heading fragment out of the paragraph below it', () => {
    const source = `${FRONTMATTER}# CI\n\n## Facts before opinion\n\n${passage([10, 10, 10])}\n`

    // A heading is legitimately verbless and legitimately one length, so a
    // measure that let one join the paragraph under it would read the author's
    // own signpost as a defect in the prose.
    const { measured, flattest } = measure(source).cadence
    expect(measured).toBe(1)
    expect(flattest?.sentences).toBe(3)
  })

  it('should keep a table cell out of the paragraphs either side of it', () => {
    const rows = table(['| `canon one` | Facts before opinion |'])
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 10])}\n\n${rows}\n\n${passage([9, 9, 9])}\n`

    // A cell is written as a fragment by design. Both paragraphs measure, and
    // neither absorbs the row between them.
    const { measured, flat } = measure(source).cadence
    expect(measured).toBe(2)
    expect(flat).toBe(2)
  })

  it('should measure a paragraph of imperatives the way it measures any other', () => {
    const openers = ['Run', 'Check', 'Load']
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 10], openers)}\n`

    // The three shapes above are excluded by where they sit, which needs no
    // grammar. An imperative sits in ordinary paragraph prose and is separated
    // from a verbless clause by grammar alone, which is why the verbless share
    // stays unimplemented while these two measures ship. See `measureCadence`.
    const { measured, flat } = measure(source).cadence
    expect(measured).toBe(1)
    expect(flat).toBe(1)
  })
})
