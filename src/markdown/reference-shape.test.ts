import { describe, expect, it } from 'vitest'
import { referenceShapeFindings } from '@/markdown/reference-shape'

const MARKED = '---\ntitle: The tick\nkind: reference\n---\n'

function page(body: string, frontmatter = MARKED): string {
  return `${frontmatter}\n# The tick\n\n\`canon pr tick 12\`\n\n${body}\n`
}

const CONFORMING = [
  '## Output',
  '',
  'A record on stdout.',
  '',
  '## Refusals',
  '',
  '| Reason     | Meaning                     |',
  '| ---------- | --------------------------- |',
  '| `no-box`   | A box number is past the end |',
  '',
  '## See also',
  '',
  '- `canon pr evidence`',
].join('\n')

describe('referenceShapeFindings', () => {
  it('should pass a marked page holding only the three sections', () => {
    expect(referenceShapeFindings(page(CONFORMING))).toEqual([])
  })

  it('should report an H3 on a marked page with its line', () => {
    const source = page(`${CONFORMING}\n\n### Exit codes\n\nZero on success.`)

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'subsection', line: 24, text: 'Exit codes' },
    ])
  })

  it('should report an H2 outside the three sections', () => {
    const source = page(
      `## When a tick is cleared\n\nOn a new head.\n\n${CONFORMING}`,
    )

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'extra-section', line: 10, text: 'When a tick is cleared' },
    ])
  })

  it('should report a section that comes before one it should follow', () => {
    const source = page(
      '## See also\n\n- `canon pr evidence`\n\n## Output\n\nA record on stdout.',
    )

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'section-order', line: 14, text: 'Output' },
    ])
  })

  it('should report a section that repeats', () => {
    const source = page(`${CONFORMING}\n\n## See also\n\n- \`canon docs\``)

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'section-order', line: 24, text: 'See also' },
    ])
  })

  it('should pass a page that leaves a section out', () => {
    const source = page(
      '## Output\n\nA record.\n\n## See also\n\n- `canon docs`',
    )

    expect(referenceShapeFindings(source)).toEqual([])
  })

  it('should report a table whose first header cell names flags', () => {
    const source = page(
      `${CONFORMING}\n\n| Flag     | Meaning      |\n| -------- | ------------ |\n| \`--json\` | Add a record |`,
    )

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'flag-table', line: 24, text: 'Flag' },
    ])
  })

  it('should report a table whose first header cell is Options', () => {
    const source = page(
      `${CONFORMING}\n\n| Options | Meaning |\n| ------- | ------- |\n| \`--x\`   | A thing |`,
    )

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'flag-table', line: 24, text: 'Options' },
    ])
  })

  it('should read a heading inside a fence as an example', () => {
    const source = page(
      `${CONFORMING}\n\n\`\`\`markdown\n## Usage\n### Flags\n\`\`\``,
    )

    expect(referenceShapeFindings(source)).toEqual([])
  })

  it('should never measure a page without the marker, whatever its sections', () => {
    const source = page(
      `## Usage\n\n### Flags\n\n| Flag | Meaning |\n| ---- | ------- |\n| \`-x\` | X       |`,
      '---\ntitle: The tick\n---\n',
    )

    expect(referenceShapeFindings(source)).toEqual([])
  })

  it('should never measure a page carrying no frontmatter', () => {
    expect(referenceShapeFindings('# Page\n\n## Usage\n\n### Flags\n')).toEqual(
      [],
    )
  })

  it('should read a quoted marker as the same marker', () => {
    const source = page(
      '## Usage',
      '---\ntitle: The tick\nkind: "reference"\n---\n',
    )

    expect(referenceShapeFindings(source)).toEqual([
      { kind: 'extra-section', line: 10, text: 'Usage' },
    ])
  })
})
