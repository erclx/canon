import { describe, expect, it } from 'vitest'
import { measureDesignProse } from '@/design/budget'
import { formatTable, renderDesignDocument } from '@/design/document'
import { parseDesignDoc } from '@/design/parse'
import { TOKENS } from '@/design/tokens'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'vitest'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'design-document-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('formatTable', () => {
  it('pads every cell to the widest in its column', () => {
    expect(formatTable(['Role', 'Value'], [['background', '#000000']])).toBe(
      [
        '| Role       | Value   |',
        '| ---------- | ------- |',
        '| background | #000000 |',
      ].join('\n'),
    )
  })

  it('holds a column at three dashes where every cell is narrower', () => {
    expect(formatTable(['a'], [['b']])).toBe(
      ['| a   |', '| --- |', '| b   |'].join('\n'),
    )
  })
})

describe('renderDesignDocument', () => {
  it('opens with the review date in frontmatter', () => {
    expect(renderDesignDocument()).toMatch(
      /^---\nreviewed: \d{4}-\d{2}-\d{2}\n---\n\n# Design\n/,
    )
  })

  it('carries every section the design standard fixes', () => {
    const document = renderDesignDocument()

    for (const heading of [
      '## Overview',
      '## Colors',
      '## Typography',
      '## Spacing',
      '## Shapes',
      '## Layout',
      '## Motion',
      '## Iconography',
    ]) {
      expect(document).toContain(heading)
    }
  })

  it('orders the sections the way Google DESIGN.md orders those it shares', () => {
    const headings = renderDesignDocument()
      .split('\n')
      .filter((line) => line.startsWith('## '))

    expect(headings).toEqual([
      '## Overview',
      '## Colors',
      '## Typography',
      '## Spacing',
      '## Layout',
      '## Shapes',
      '## Motion',
      '## Iconography',
    ])
  })

  it('writes none of the headings the standard renamed', () => {
    const document = renderDesignDocument()

    for (const heading of ['## Personality', '## Color\n', '## Borders']) {
      expect(document).not.toContain(heading)
    }
  })

  it('says the module is the source and this file is not', () => {
    expect(renderDesignDocument()).toContain(
      'Rendered from `src/design/tokens.ts`',
    )
  })

  it('renders each rule list as bullets under its section', () => {
    const document = renderDesignDocument({
      ...TOKENS,
      motion: ['None.', 'Not even a fade.'],
    })

    expect(document).toContain('## Motion\n\n- None.\n- Not even a fade.')
  })

  it('renders a section with no rules as its table alone', () => {
    const document = renderDesignDocument({ ...TOKENS, spacingRules: [] })

    expect(document).toContain('## Spacing\n\n| Step')
  })

  it('holds every section inside the prose budget', () => {
    expect(measureDesignProse(renderDesignDocument())).toEqual([])
  })

  it('tags a cell the record marks and leaves the rest bare', () => {
    const document = renderDesignDocument()

    expect(document).toContain('| 1.45 ? verify |')
    // The role column pads to the widest role in the table, so this width
    // moves whenever a longer role name is declared.
    expect(document).toContain('| background       | page canvas')
  })

  /**
   * The document has one reader that is not a person: the preview parses it
   * back. A render the parser cannot read would leave the landing page's token
   * preview reporting an empty record for a file full of values.
   */
  it('round-trips through the parser the preview reads it with', () => {
    const path = join(root, 'DESIGN.md')
    writeFileSync(path, renderDesignDocument())

    const parsed = parseDesignDoc(path)

    expect(parsed.color).toHaveLength(TOKENS.color.length)
    expect(parsed.color[0]['Role'].value).toBe('background')
    expect(parsed.borders.at(-1)?.['Role'].value).toBe('marker')

    const border = parsed.color.find(
      (row) => row['Role'].value === 'light-border',
    )
    expect(border?.['Value']).toEqual({ value: '#ececea', tagged: false })

    const code = parsed.typography.find((row) => row['Role'].value === 'code')
    expect(code?.['Line height']).toEqual({ value: '1.45', tagged: true })
  })

  it('renders a role at the tablet and phone sizes of the step it takes', () => {
    const document = renderDesignDocument({
      ...TOKENS,
      typeScale: [
        { step: 'hero', size: '5.625rem', tablet: '4rem', phone: '2.5rem' },
      ],
      typography: [
        {
          role: 'hero',
          family: 'Geist',
          weight: '600',
          size: '5.625rem',
          lineHeight: '1',
          step: 'hero',
        },
      ],
    })

    expect(document).toContain(
      '| hero | Geist  | 600    | 5.625rem | 4rem   | 2.5rem |',
    )
  })

  it('repeats the size for a role whose step never shrinks', () => {
    const document = renderDesignDocument({
      ...TOKENS,
      typeScale: [{ step: 'body', size: '1rem' }],
      typography: [
        {
          role: 'body',
          family: 'Geist',
          weight: '400',
          size: '1rem',
          lineHeight: '1.5',
          step: 'body',
        },
      ],
    })

    expect(document).toContain(
      '| body | Geist  | 400    | 1rem | 1rem   | 1rem  |',
    )
  })

  it('shows the tablet size at phone for a step that shrinks only at tablet', () => {
    const document = renderDesignDocument({
      ...TOKENS,
      typeScale: [{ step: 'caption', size: '0.75rem', tablet: '0.6875rem' }],
      typography: [
        {
          role: 'caption',
          family: 'Geist',
          weight: '500',
          size: '0.75rem',
          lineHeight: '1.45',
          step: 'caption',
        },
      ],
    })

    expect(document).toContain('| 0.75rem | 0.6875rem | 0.6875rem |')
  })

  it('renders the shadows under Shapes by the property each is read through', () => {
    const document = renderDesignDocument({
      ...TOKENS,
      shadows: [{ role: 'ring', value: '0 0 0 1px #000000', when: 'edges' }],
    })
    const shapes = document.split('## Shapes')[1].split('## Motion')[0]

    expect(shapes).toContain(
      '| `--shadow-ring` | 0 0 0 1px #000000 | edges     |',
    )
  })

  it('renders the durations and easings under Motion as one table', () => {
    const document = renderDesignDocument({
      ...TOKENS,
      durations: [{ role: 'fade', value: '240ms', when: 'fades' }],
      easings: [{ role: 'draw', value: 'linear', when: 'draws' }],
    })
    const motion = document.split('## Motion')[1].split('## Iconography')[0]

    expect(motion).toContain('`--duration-fade`')
    expect(motion).toContain('`--ease-draw`')
  })

  it('leaves the borders parse to the borders table when shadows follow it', () => {
    const path = join(root, 'DESIGN.md')
    writeFileSync(
      path,
      renderDesignDocument({
        ...TOKENS,
        shadows: [{ role: 'ring', value: '0 0 0 1px #000000', when: 'edges' }],
      }),
    )

    expect(parseDesignDoc(path).borders).toHaveLength(TOKENS.borders.length)
  })

  it('ends on a single trailing newline', () => {
    const document = renderDesignDocument()

    expect(document.endsWith('\n')).toBe(true)
    expect(document.endsWith('\n\n')).toBe(false)
  })
})
