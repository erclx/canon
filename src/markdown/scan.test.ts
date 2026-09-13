import { describe, expect, it } from 'vitest'
import {
  type BanSets,
  bodyLines,
  linesOutsideFences,
  maskDisplayed,
  scanBans,
  visibleText,
} from '@/markdown/scan'

const BANS: BanSets = {
  characters: ['—', ';'],
  words: ['simply', 'leverage', 'just'],
  spellings: ['organise', 'colour', 'behaviour'],
}

function scan(source: string) {
  return scanBans(bodyLines(source), BANS)
}

function terms(source: string): string[] {
  return scan(source).map((found) => found.term)
}

describe('bodyLines', () => {
  it('should keep the original line number after dropping frontmatter', () => {
    const [line] = bodyLines('---\ntitle: X\n---\n\n# Heading\n').filter(
      (each) => each.text !== '',
    )

    expect(line.number).toBe(5)
  })

  it('should read a frontmatter block inside a fenced template as body', () => {
    const source = '# Heading\n\n```markdown\n---\ntitle: X\n---\n```\n'

    const lines = bodyLines(source)

    expect(lines[0].text).toBe('# Heading')
    expect(lines.filter((line) => line.fenced)).toHaveLength(5)
  })

  it('should close a four-backtick block only on a run of its own length', () => {
    const source = '````markdown\n```\ninner\n```\n````\n\nOutside.\n'

    const lines = bodyLines(source)

    expect(lines.filter((line) => line.fenced)).toHaveLength(5)
    expect(lines.at(-1)?.fenced).toBe(false)
  })

  it('should leave an unterminated fence swallowing the rest of the file', () => {
    const source = '# Heading\n\n```ts\nconst x = 1\n\nMore prose.\n'

    // Under-reporting a malformed file beats reporting its remainder as
    // content, since the remainder is whatever the unclosed block holds.
    expect(bodyLines(source).filter((line) => line.fenced)).toHaveLength(4)
  })

  it('should leave the fence block undefined outside every fence', () => {
    const lines = bodyLines('Before.\n```ts\nconst x = 1\n```\nAfter.\n')

    // Counting from one is what keeps the outside answer from reading as a
    // block a consumer can compare against.
    expect(lines.map((line) => line.fenceBlock)).toEqual([
      undefined,
      1,
      1,
      1,
      undefined,
    ])
  })

  it('should number an indented block and the unindented one behind it apart', () => {
    const source = '  ```bash\n  a\n  ```\n```bash\nb\n```\n'

    // Nothing sits between the two, so the fenced mark reads them as one run.
    expect(bodyLines(source).map((line) => line.fenceBlock)).toEqual([
      1, 1, 1, 2, 2, 2,
    ])
  })

  it('should number an unindented block and the indented one behind it apart', () => {
    const source = '```bash\na\n```\n  ```bash\n  b\n  ```\n'

    expect(bodyLines(source).map((line) => line.fenceBlock)).toEqual([
      1, 1, 1, 2, 2, 2,
    ])
  })
})

describe('linesOutsideFences', () => {
  it('should keep frontmatter, which is content to a record validator', () => {
    const kept = linesOutsideFences('---\ntitle: X\n---\n\nBody.\n')

    expect(kept).toContain('title: X')
  })

  it('should drop a fenced block and both of its delimiters', () => {
    const kept = linesOutsideFences(
      'Before.\n```ts\nconst x = 1\n```\nAfter.\n',
    )

    expect(kept.filter((line) => line !== '')).toEqual(['Before.', 'After.'])
  })

  it('should drop both of two adjacent blocks, which it cannot tell apart', () => {
    // A caller reading this asks only whether a line is fenced, so the block
    // index has to leave it returning exactly what it returned before.
    const kept = linesOutsideFences(
      'Before.\n```ts\nconst x = 1\n```\n```sh\ncanon\n```\nAfter.\n',
    )

    expect(kept.filter((line) => line !== '')).toEqual(['Before.', 'After.'])
  })
})

describe('maskDisplayed', () => {
  it('should blank an inline code span while holding its width', () => {
    const masked = maskDisplayed('Use `a; b` here.')

    expect(masked).toHaveLength('Use `a; b` here.'.length)
    expect(masked).not.toContain(';')
  })

  it('should blank a double-backtick span holding a single backtick', () => {
    expect(maskDisplayed('Write ``a`b;`` now.')).not.toContain(';')
  })

  it('should blank a link destination and leave its anchor text', () => {
    const masked = maskDisplayed('See [the docs](https://x.test/a;b=1) now.')

    expect(masked).toContain('the docs')
    expect(masked).not.toContain(';')
  })

  it('should blank a whole destination carrying one level of balanced parentheses', () => {
    const masked = maskDisplayed('See [the docs](https://x.test/a(1);b) now.')

    expect(masked).toContain('the docs')
    expect(masked).not.toContain(';')
  })
})

describe('visibleText', () => {
  it('should reduce a link to the anchor text a reader is shown', () => {
    expect(visibleText('See [the docs](https://x.test/a/b/c) now.')).toBe(
      'See the docs now.',
    )
  })

  it('should drop a link destination whose opening bracket wrapped away', () => {
    expect(visibleText('](https://x.test/a) closes it.')).toBe(' closes it.')
  })

  it('should drop an autolink whole', () => {
    expect(visibleText('Read <https://x.test/a/b> today.')).toBe('Read  today.')
  })

  it('should keep a placeholder inside a code span, brackets and all', () => {
    // The autolink pattern reaches into a backticked path and takes the angle
    // brackets out of the middle of it, which counts less than the page shows.
    const text = 'See `canon/context/<domain>.md` for it.'

    expect(visibleText(text)).toBe(text)
  })

  it('should keep link syntax a code span is quoting rather than rendering', () => {
    const text = 'Write `[label](target)` in the file.'

    expect(visibleText(text)).toBe(text)
  })

  it('should still drop a link that sits after a code span', () => {
    expect(visibleText('Run `canon` then [the entry](docs/a.md) next.')).toBe(
      'Run `canon` then the entry next.',
    )
  })

  it('should drop a whole link whose destination carries balanced parentheses', () => {
    expect(visibleText('See [the docs](https://x.test/a(1);b) now.')).toBe(
      'See the docs now.',
    )
  })

  it('should keep an inline code span, which a reader reads', () => {
    // The ban scan blanks a code span so a standard quoting its own banned
    // character does not report itself. A backticked path is still text on the
    // page, so discounting it here would under-report a paragraph full of them.
    expect(visibleText('Open `src/markdown/scan.ts` next.')).toBe(
      'Open `src/markdown/scan.ts` next.',
    )
  })
})

describe('scanBans', () => {
  it('should report a banned character', () => {
    expect(terms('A clause; another.\n')).toEqual([';'])
  })

  it('should report a banned word in either casing', () => {
    expect(terms('Simply run it.\n')).toEqual(['simply'])
  })

  it('should report a banned spelling', () => {
    expect(terms('We organise the files.\n')).toEqual(['organise'])
  })

  it('should not report a word that merely ends in the banned suffix', () => {
    // The intake scanner matched `-ise` as a pattern and produced 46 bad hits
    // from words like these, which a closed set of whole words never reaches.
    expect(terms('The exercises and promises were revised.\n')).toEqual([])
  })

  it('should not report a banned word inside a longer one', () => {
    // `just` sits inside `adjustment`, which a substring match would report.
    expect(terms('The adjustment held.\n')).toEqual([])
  })

  it('should not report a banned word ending a hyphenated compound', () => {
    // A word boundary sits after a hyphen, so `\b` reported `just` out of
    // `auto-just`. A compound is one word to the reader who wrote it.
    expect(terms('The auto-just setting held.\n')).toEqual([])
  })

  it('should not report a banned word opening a hyphenated compound', () => {
    expect(terms('The just-in-time path held.\n')).toEqual([])
  })

  it('should still report a banned word standing on its own', () => {
    // The boundary is tightened either side, so the plain hit has to survive it.
    expect(terms('Just run it.\n')).toEqual(['just'])
  })

  it('should report a banned spelling inside a hyphenated compound', () => {
    // A word ban reads a compound as the one word it is, and a spelling ban
    // targets the orthography sitting inside it. `behaviour-driven` is the
    // usual spelling of BDD and the likeliest route a British spelling takes in.
    expect(terms('We run behaviour-driven development.\n')).toEqual([
      'behaviour',
    ])
  })

  it('should report a banned spelling opening a hyphenated compound', () => {
    expect(terms('A colour-blind palette.\n')).toEqual(['colour'])
  })

  it('should report nothing inside frontmatter', () => {
    expect(terms('---\ntitle: Simply; a title\n---\n\nBody.\n')).toEqual([])
  })

  it('should report nothing inside a fenced block', () => {
    expect(terms('# H\n\n```ts\nconst a = 1; // simply\n```\n')).toEqual([])
  })

  it('should report nothing inside either of two adjacent blocks', () => {
    // The ban half of `canon markdown audit` fails a push, so the exclusion this
    // scan walks around has to survive the walker learning about blocks.
    expect(
      terms(
        '# H\n\n```ts\nconst a = 1; // simply\n```\n```sh\ncanon --colour\n```\n',
      ),
    ).toEqual([])
  })

  it('should report nothing inside an inline code span', () => {
    expect(terms('The `a; b` operator and `simply` flag.\n')).toEqual([])
  })

  it('should point at the column the term sits in', () => {
    const [found] = scan('Ab; cd.\n')

    expect(found).toMatchObject({ line: 1, column: 2, kind: 'character' })
  })

  it('should sort findings by line then column', () => {
    const found = scan('Simply; go.\n\nWe organise it.\n')

    expect(found.map((each) => [each.line, each.term])).toEqual([
      [1, 'simply'],
      [1, ';'],
      [3, 'organise'],
    ])
  })
})
