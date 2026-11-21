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

/** A bullet whose text after its marker is an exact character count, so a boundary case lands on it. */
function bullet(characters: number, marker = '-'): string {
  return `${marker} ${'w'.repeat(characters)}`
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
    // Asserted rather than read off the standard, so a number moving in one place is caught.
    expect(CHECKPOINTS).toEqual({
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
    // No measure reads these, so this is the only check on one moving.
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

    // A deep run between two markers must still report, or a clean corpus proves nothing.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to an indented section marker', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n  **Risks:**\n\n${half}\n`

    // An indented marker labels a list item rather than a seam, and a false break shortens every run.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should let a short bold section marker carrying no colon break a run', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Testing**\n\n${half}\n`

    // The other direction, since `review-pr` writes this marker into every body it posts.
    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to a bold sentence past the marker width', () => {
    const half = prose(30)
    const sentence = '**The pass found four things, and it took one read.**'
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${sentence}\n\n${half}\n`

    // A colonless bold line may be a sentence set in bold, and a false break shortens every run.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to a bold phrase inside the ambiguous band', () => {
    const half = prose(30)
    const band = '**Two seeds and a behavior line**'
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${band}\n\n${half}\n`

    // Inside the band the corpus cannot classify on sight, the ceiling sits under it.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should let a bold path label break a run past the marker width', () => {
    const half = prose(30)
    const path = '**`src/markdown/structure.ts`**'
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n${path}\n\n${half}\n`

    // Width alone would hold it out, so the span test lets it break, as `review-pr` heads each file.
    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should break on a section marker carrying trailing whitespace', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Risks:**  \n\n${half}\n`

    // Column zero is what the pattern anchors, so a trailing space cannot cost a break.
    expect(measure(source).longestRun).toBeLessThan(RUN_CHECKPOINT)
  })

  it('should refuse the break to a bold phrase sharing its line with prose', () => {
    const half = prose(30)
    const source = `${FRONTMATTER}# CI\n\n${half}\n\n**Emphasis:** and the sentence carries on.\n\n${half}\n`

    // Emphasis opening a sentence is not a seam, so the pattern demands the whole line.
    expect(measure(source).longestRun).toBeGreaterThan(RUN_CHECKPOINT)
  })

  it('should not count a heading that is markdown inside a fenced block', () => {
    const source = `${FRONTMATTER}# CI\n\n${prose(20)}\n\n\`\`\`markdown\n## Not a real heading\n\n### Nor this\n\`\`\`\n\n${prose(20)}\n`

    // The fence neither breaks the run nor adds to it.
    expect(measure(source).longestRun).toBe(43)
  })

  it('should keep a four-backtick block closed against the three inside it', () => {
    const inner = `\`\`\`markdown\n## Not a real heading\n\`\`\``
    const source = `${FRONTMATTER}# CI\n\n${prose(20)}\n\n\`\`\`\`markdown\n${inner}\n\`\`\`\`\n\n${prose(20)}\n`

    // A walker toggling on any backtick run reads the inner closing fence as an opening.
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

    // A rendered line shows anchor text rather than destinations, so the run is one row plus the blank.
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

    // Fifteen bullets and a blank are sixteen source lines, so only the rendered measure reaches the checkpoint.
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

  it.each(['-', '1.'])(
    'should leave a bullet at the checkpoint after its %s marker unreported',
    (marker) => {
      const source = `${FRONTMATTER}# CI\n\n${bullet(BULLET_CHECKPOINT, marker)}\n`

      expect(measure(source).heavyBullets).toEqual([])
    },
  )

  it('should report a numbered bullet one character past the checkpoint', () => {
    const source = `${FRONTMATTER}# CI\n\n${bullet(BULLET_CHECKPOINT + 1, '1.')}\n`

    expect(measure(source).heavyBullets).toEqual([
      { line: 8, characters: BULLET_CHECKPOINT + 1 },
    ])
  })

  it('should report a nested bullet past the checkpoint at its own line', () => {
    const source = `${FRONTMATTER}# CI\n\n- Parent\n  ${bullet(BULLET_CHECKPOINT + 1)}\n`

    expect(measure(source).heavyBullets).toEqual([
      { line: 9, characters: BULLET_CHECKPOINT + 1 },
    ])
  })

  it('should leave a parent clean when only its nested bullet is heavy', () => {
    const source = `${FRONTMATTER}# CI\n\n- Parent\n  ${bullet(BULLET_CHECKPOINT + 1)}\n`

    expect(measure(source).heavyBullets.map(({ line }) => line)).not.toContain(
      8,
    )
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

    // Neither source line reaches the checkpoint alone, so a wrapped bullet reports as one.
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

    // A sentence cap alone is met by fewer, longer sentences, so the character weight catches them.
    const [found] = measure(source).heavyParagraphs
    expect(found.sentences).toBe(2)
    expect(found.characters).toBeGreaterThan(PARAGRAPH_CHECKPOINT)
  })

  it('should measure weight against its own checkpoint rather than the bullet one', () => {
    const lowered: Checkpoints = { ...CHECKPOINTS, paragraph: 120 }
    const source = `${FRONTMATTER}# CI\n\n${sentences(2, 80)}\n`

    // Lowering the paragraph number under the bullet one shows which of the two the measure reads.
    expect(measure(source).heavyParagraphs).toEqual([])
    expect(
      measureStructure('ci.md', bodyLines(source), lowered).heavyParagraphs,
    ).toHaveLength(1)
  })

  it('should measure a link-heavy paragraph against the text a reader sees', () => {
    // Sized from the checkpoint rather than fixed, so a raw length past it tests the run that moves it.
    const paragraph = links(Math.ceil(PARAGRAPH_CHECKPOINT / 40))
    const source = `${FRONTMATTER}# CI\n\n${paragraph}\n`

    // Measured across the corpus this is the single largest correction to the raw character count.
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

    // A command name is lowercase, so a boundary resting on a capital alone finds none of the four.
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

    // Sentences within roughly five words of each other are one cadence, so the checkpoint is the last flat value.
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

    // A sentence opening on a command name repeats as plainly as one opening on a word.
    expect(measure(source).cadence.mostRepeated?.opener).toBe('canon')
  })

  it('should leave a paragraph under the sentence floor unmeasured', () => {
    const source = `${FRONTMATTER}# CI\n\n${passage([4, 22])}\n`

    // A two-sentence configuration note says nothing about cadence, which is the case the floor exists for.
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

    // Raw the linked sentence carries four tokens against two a reader reads, which would report a false spread.
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

    // A heading is legitimately verbless and one length, so joining it to its paragraph would read as flat prose.
    const { measured, flattest } = measure(source).cadence
    expect(measured).toBe(1)
    expect(flattest?.sentences).toBe(3)
  })

  it('should keep a table cell out of the paragraphs either side of it', () => {
    const rows = table(['| `canon one` | Facts before opinion |'])
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 10])}\n\n${rows}\n\n${passage([9, 9, 9])}\n`

    // A cell is written as a fragment by design, so neither paragraph absorbs the row between them.
    const { measured, flat } = measure(source).cadence
    expect(measured).toBe(2)
    expect(flat).toBe(2)
  })

  it('should measure a paragraph of imperatives the way it measures any other', () => {
    const openers = ['Run', 'Check', 'Load']
    const source = `${FRONTMATTER}# CI\n\n${passage([10, 10, 10], openers)}\n`

    // These shapes are excluded by position, while the verbless share needs grammar. See `measureCadence`.
    const { measured, flat } = measure(source).cadence
    expect(measured).toBe(1)
    expect(flat).toBe(1)
  })
})
