import { describe, expect, it } from 'vitest'
import {
  README_ONLY_MARKER,
  README_PARAPHRASE_MARKER,
  readmeCitationsIn,
  uncitedReadmeSections,
} from '@/web/readme-citations'

describe('readmeCitationsIn', () => {
  it('should parse a single quoted phrase', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      '// README.md: "keeps one authoritative copy"\n',
    )

    expect(citations).toEqual([
      {
        file: 'web/src/content/copy.ts',
        line: 1,
        kind: 'quoted',
        text: '// README.md: "keeps one authoritative copy"',
        phrases: ['keeps one authoritative copy'],
      },
    ])
  })

  it('should parse two space-separated phrases off one anchor', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      '// README.md: "first phrase" "second phrase"\n',
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]?.phrases).toEqual(['first phrase', 'second phrase'])
  })

  it('should flag a bare line-number citation', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      "// README.md:23, the reader's problem\n",
    )

    expect(citations).toEqual([
      {
        file: 'web/src/content/copy.ts',
        line: 1,
        kind: 'bare',
        text: "// README.md:23, the reader's problem",
        phrases: [],
      },
    ])
  })

  it('should flag a bare two-number citation', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      '// README.md:46, 49\n',
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]?.kind).toBe('bare')
  })

  it('should flag a bare range citation', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      '// README.md:58-66, condensed\n',
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]?.kind).toBe('bare')
  })

  it('should mute a citation carrying the paraphrase marker on its own line', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      `// README.md: ${README_PARAPHRASE_MARKER}: condensed from a bullet list\n`,
    )

    expect(citations).toEqual([
      {
        file: 'web/src/content/copy.ts',
        line: 1,
        kind: 'paraphrase',
        text: `// README.md: ${README_PARAPHRASE_MARKER}: condensed from a bullet list`,
        phrases: [],
      },
    ])
  })

  it('should mute a citation when the marker sits on the line above', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      `// ${README_PARAPHRASE_MARKER}: condensed from a bullet list\n// README.md: further explanation\n`,
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]?.kind).toBe('paraphrase')
  })

  it('should still check a quoted phrase on a line that also carries the marker', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      `// README.md: ${README_PARAPHRASE_MARKER}: "borrowed verbatim" the rest is synthesized\n`,
    )

    expect(citations).toEqual([
      {
        file: 'web/src/content/copy.ts',
        line: 1,
        kind: 'quoted',
        text: `// README.md: ${README_PARAPHRASE_MARKER}: "borrowed verbatim" the rest is synthesized`,
        phrases: ['borrowed verbatim'],
      },
    ])
  })

  it('should still check a quoted phrase when the marker sits on the line above', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      `// ${README_PARAPHRASE_MARKER}: condensed from a bullet list\n// README.md: "some phrase"\n`,
    )

    expect(citations).toHaveLength(1)
    expect(citations[0]?.kind).toBe('quoted')
    expect(citations[0]?.phrases).toEqual(['some phrase'])
  })

  it('should read nothing from a line mentioning README.md with no colon', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      'carrying the `README.md` line it derives from\n',
    )

    expect(citations).toEqual([])
  })

  it('should read nothing from a file carrying no anchor at all', () => {
    const citations = readmeCitationsIn(
      'web/src/content/copy.ts',
      'export const hero = {}\n',
    )

    expect(citations).toEqual([])
  })
})

describe('uncitedReadmeSections', () => {
  it('should pass a section whose heading a phrase quotes', () => {
    const readme = '# canon\n\n## Install it\n\nRun one command.\n'

    expect(uncitedReadmeSections(readme, ['Install it'])).toEqual([])
  })

  it('should pass a section a phrase cites only through its body', () => {
    const readme =
      '## Five roles\n\nYou talk to the orchestrator that starts them.\n'

    expect(
      uncitedReadmeSections(readme, ['the orchestrator that starts them']),
    ).toEqual([])
  })

  it('should report an unmarked section no phrase falls inside, by heading and line', () => {
    const readme =
      '# canon\n\n## Cited\n\nQuoted body.\n\n## Contributing\n\nIssues are welcome.\n'

    expect(uncitedReadmeSections(readme, ['Quoted body'])).toEqual([
      { heading: 'Contributing', line: 7 },
    ])
  })

  it('should not credit a section with a phrase that sits in the next one', () => {
    const readme = '## First\n\nNothing here.\n\n## Second\n\nQuoted body.\n'

    expect(uncitedReadmeSections(readme, ['Quoted body'])).toEqual([
      { heading: 'First', line: 1 },
    ])
  })

  it('should pass a section marked README-only with a reason on the first line under its heading', () => {
    const readme = `## Contributing\n\n<!-- ${README_ONLY_MARKER}: the landing has no contributing section -->\n\nIssues are welcome.\n`

    expect(uncitedReadmeSections(readme, [])).toEqual([])
  })

  it('should report a section whose README-only marker names no reason', () => {
    const readme = `## Contributing\n\n<!-- ${README_ONLY_MARKER}: -->\n\nIssues are welcome.\n`

    expect(uncitedReadmeSections(readme, [])).toEqual([
      { heading: 'Contributing', line: 1 },
    ])
  })

  it('should not let a marker further down the body cover the section', () => {
    const readme = `## Contributing\n\nIssues are welcome.\n\n<!-- ${README_ONLY_MARKER}: too late -->\n`

    expect(uncitedReadmeSections(readme, [])).toEqual([
      { heading: 'Contributing', line: 1 },
    ])
  })

  it('should read a heading-shaped line inside a code fence as body', () => {
    const readme = '## Cited\n\n```bash\n## not a heading\n```\n'

    expect(uncitedReadmeSections(readme, ['Cited'])).toEqual([])
  })

  it('should report nothing for text above the first section', () => {
    const readme = '# canon\n\nAn opening nobody quotes.\n'

    expect(uncitedReadmeSections(readme, [])).toEqual([])
  })
})
