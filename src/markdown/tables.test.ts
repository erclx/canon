import { describe, expect, it } from 'vitest'
import { bodyLines } from '@/markdown/scan'
import { codeSpans, tableFindings, unbrokenRun } from '@/markdown/tables'

function findingsIn(source: string) {
  return tableFindings(bodyLines(`${source}\n`))
}

function kindsIn(source: string): string[] {
  return findingsIn(source).map((finding) => finding.kind)
}

function table(rows: readonly string[]): string {
  return ['| A | B |', '| - | - |', ...rows].join('\n')
}

function rows(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `| a${i} | b${i} |`)
}

describe('tableFindings', () => {
  describe('cell length', () => {
    it('should pass a cell at 120 visible characters', () => {
      expect(findingsIn(table([`| ${'a'.repeat(120)} | b |`]))).toEqual([])
    })

    it('should report a cell at 121 characters on its row line', () => {
      expect(findingsIn(table([`| ${'a'.repeat(121)} | b |`]))).toEqual([
        { kind: 'table-cell', line: 3, value: 121, limit: 120 },
      ])
    })

    it('should count a link in a cell by its label alone', () => {
      const cell = `${'a'.repeat(110)} [label](${'x'.repeat(60)}.md)`
      expect(findingsIn(table([`| ${cell} | b |`]))).toEqual([])
    })

    it('should read an escaped pipe as one cell rather than two', () => {
      const cell = `${'a'.repeat(70)} \\| ${'b'.repeat(70)}`
      expect(findingsIn(table([`| ${cell} | c |`]))).toEqual([
        { kind: 'table-cell', line: 3, value: 143, limit: 120 },
      ])
    })

    it('should measure a header cell', () => {
      expect(
        kindsIn(`| ${'a'.repeat(121)} | B |\n| - | - |\n| a | b |`),
      ).toEqual(['table-cell'])
    })
  })

  describe('row count', () => {
    it('should pass a table of 8 body rows', () => {
      expect(findingsIn(table(rows(8)))).toEqual([])
    })

    it('should report 9 body rows at the header line, not counting the header', () => {
      expect(findingsIn(`# T\n\n${table(rows(9))}`)).toEqual([
        { kind: 'table-rows', line: 3, value: 9, limit: 8 },
      ])
    })
  })

  describe('list after a table', () => {
    it('should report a list directly under a table at the list line', () => {
      expect(findingsIn(`${table(rows(1))}\n- item`)).toEqual([
        { kind: 'table-then-list', line: 4, value: null, limit: null },
      ])
    })

    it('should report a list after a blank line under a table', () => {
      expect(kindsIn(`${table(rows(1))}\n\n1. item`)).toEqual([
        'table-then-list',
      ])
    })

    it('should pass a list behind a lead paragraph', () => {
      expect(findingsIn(`${table(rows(1))}\n\nThe lead.\n\n- item`)).toEqual([])
    })

    it('should pass a list behind a heading', () => {
      expect(findingsIn(`${table(rows(1))}\n\n## Next\n\n- item`)).toEqual([])
    })
  })

  describe('wide token', () => {
    it('should pass a code span with a 30-character run', () => {
      expect(findingsIn(table([`| \`${'a'.repeat(30)}\` | b |`]))).toEqual([])
    })

    it('should report a code span with a 31-character run', () => {
      expect(
        findingsIn(table([`| \`${'a'.repeat(31)} short\` | b |`])),
      ).toEqual([{ kind: 'table-token', line: 3, value: 31, limit: 30 }])
    })

    it('should leave a long run outside a code span alone', () => {
      expect(findingsIn(table([`| ${'a'.repeat(40)} | b |`]))).toEqual([])
    })
  })

  describe('what is not a table', () => {
    it('should never measure a table inside a fence', () => {
      const fenced = `\`\`\`md\n${table([...rows(9), `| ${'a'.repeat(130)} | b |`])}\n\`\`\`\n- item`
      expect(findingsIn(fenced)).toEqual([])
    })

    it('should never measure pipe lines with no delimiter row', () => {
      expect(findingsIn(`| ${'a'.repeat(130)} |\n| b |\n- item`)).toEqual([])
    })
  })
})

describe('codeSpans', () => {
  it('should return each span body, dropping link targets first', () => {
    expect(codeSpans('see `a b` and [`c`](`d`.md) then `e`')).toEqual([
      'a b',
      'c',
      'e',
    ])
  })
})

describe('unbrokenRun', () => {
  it('should measure the longest whitespace-free run', () => {
    expect(unbrokenRun('ab abcd-efg abc')).toBe(8)
  })
})
