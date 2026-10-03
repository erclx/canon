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
  it('carries every section the design standard fixes', () => {
    const document = renderDesignDocument()

    for (const heading of [
      '## Personality',
      '## Color',
      '## Typography',
      '## Spacing',
      '## Borders',
      '## Layout',
      '## Motion',
      '## Iconography',
    ]) {
      expect(document).toContain(heading)
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

    expect(document).toContain('#d5d4d1 ? verify')
    // The role column pads to the widest role in the table, so this width
    // moves whenever a longer role name is declared.
    expect(document).toContain('| background           | page canvas')
  })

  /**
   * The document has one reader that is not a person: the preview parses it
   * back. A render the parser cannot read would leave `canon design render`
   * reporting an empty record for a file full of values.
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
    expect(border?.['Value']).toEqual({ value: '#d5d4d1', tagged: true })
  })

  it('ends on a single trailing newline', () => {
    const document = renderDesignDocument()

    expect(document.endsWith('\n')).toBe(true)
    expect(document.endsWith('\n\n')).toBe(false)
  })
})
