import { describe, expect, it } from 'vitest'
import { checkBehaviorRows } from '@/records/behavior'

const ROWS = [
  { surface: 'shell', behavior: 'The sidebar collapses below 768px' },
  { surface: 'shell', behavior: 'Escape closes the command menu' },
  { surface: 'board', behavior: 'A frame resizes from its corner grips' },
]

function cites(...groups: string[]): string[] {
  return groups.map((group) => `- \`canon/design/${group}/\`: built against`)
}

function section(...bullets: string[]): string[] {
  return ['', ...bullets, '']
}

describe('checkBehaviorRows', () => {
  it('should report the one row of a cited group the section does not name', () => {
    const findings = checkBehaviorRows(
      cites('shell'),
      section('- The sidebar collapses below 768px: here, `bun test shell`'),
      ROWS,
    )

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'behavior-unstated',
        subject: 'shell: Escape closes the command menu',
      }),
    ])
  })

  it('should pass when every row of a cited group is named', () => {
    const findings = checkBehaviorRows(
      cites('shell'),
      section(
        '- The sidebar collapses below 768px: here, `bun test shell`',
        '- Escape closes the command menu: out, the menu ships next row',
      ),
      ROWS,
    )

    expect(findings).toEqual([])
  })

  it('should report every row of a cited group when the section is absent', () => {
    const findings = checkBehaviorRows(cites('shell'), undefined, ROWS)

    expect(findings.map((found) => found.subject)).toEqual([
      'shell: The sidebar collapses below 768px',
      'shell: Escape closes the command menu',
    ])
  })

  it('should ignore the rows of a group no entry cites', () => {
    const findings = checkBehaviorRows(cites('board'), undefined, ROWS)

    expect(findings.map((found) => found.subject)).toEqual([
      'board: A frame resizes from its corner grips',
    ])
  })

  it('should owe no section for a cited group whose record has no rows', () => {
    expect(checkBehaviorRows(cites('canvas'), undefined, ROWS)).toEqual([])
  })

  it('should owe nothing when the record holds no rows', () => {
    expect(checkBehaviorRows(cites('shell'), undefined, [])).toEqual([])
  })

  it.each([
    ['bold', '- **Escape closes the command menu**: out, next row'],
    ['a trailing period', '- Escape closes the command menu.: out, next row'],
    ['a bold label', '- **Menu.** Escape closes the command menu: out, later'],
  ])('should match a row named with %s', (_form, bullet) => {
    const findings = checkBehaviorRows(
      cites('shell'),
      section(
        '- The sidebar collapses below 768px: here, `bun test shell`',
        bullet,
      ),
      ROWS,
    )

    expect(findings).toEqual([])
  })

  it.each([
    ['out', '- Escape closes the command menu: out,'],
    ['here', '- Escape closes the command menu: here'],
  ])('should report a row marked %s with nothing after it', (_mark, bullet) => {
    const findings = checkBehaviorRows(
      cites('shell'),
      section(
        '- The sidebar collapses below 768px: here, `bun test shell`',
        bullet,
      ),
      ROWS,
    )

    expect(findings).toEqual([
      expect.objectContaining({
        kind: 'behavior-unstated',
        subject: 'shell: Escape closes the command menu',
      }),
    ])
  })

  it('should read a cited path deeper than the group folder as its group', () => {
    const findings = checkBehaviorRows(
      ['- `canon/design/board/frame.html`: redrawn, the grips move'],
      undefined,
      ROWS,
    )

    expect(findings.map((found) => found.subject)).toEqual([
      'board: A frame resizes from its corner grips',
    ])
  })
})
