import { describe, expect, it } from 'vitest'
import { densityFindings } from '@/markdown/density'
import { bodyLines } from '@/markdown/scan'

function findingsIn(source: string) {
  return densityFindings(bodyLines(`${source}\n`))
}

function kindsIn(source: string): string[] {
  return findingsIn(source).map((finding) => finding.kind)
}

/** A paragraph whose visible text is exactly `length` characters. */
function text(length: number): string {
  return 'a'.repeat(length)
}

function items(count: number, prefix = 'item'): string {
  return Array.from({ length: count }, (_, i) => `- ${prefix} ${i}`).join('\n')
}

describe('densityFindings', () => {
  describe('paragraph length', () => {
    it('should pass a paragraph at 350 characters', () => {
      expect(findingsIn(text(350))).toEqual([])
    })

    it('should report a paragraph at 351 characters with its line and length', () => {
      expect(findingsIn(`# Title\n\n${text(351)}`)).toEqual([
        expect.objectContaining({
          kind: 'paragraph-length',
          line: 3,
          value: 351,
          limit: 350,
        }),
      ])
    })

    it('should fold a paragraph wrapped across source lines', () => {
      expect(kindsIn(`${text(200)}\n${text(200)}`)).toEqual([
        'paragraph-length',
      ])
    })

    it('should count a link by its anchor text alone', () => {
      expect(findingsIn(`${text(340)} [anchor](${text(80)}.md)`)).toEqual([])
    })
  })

  describe('paragraphs in a row', () => {
    it('should pass two paragraphs in a row', () => {
      expect(findingsIn('One.\n\nTwo.')).toEqual([])
    })

    it('should report a third paragraph in a row once, at the first', () => {
      expect(findingsIn('# T\n\nOne.\n\nTwo.\n\nThree.\n\nFour.')).toEqual([
        expect.objectContaining({
          kind: 'paragraph-run',
          line: 3,
          value: 4,
          limit: 2,
        }),
      ])
    })

    it('should break the run on a table', () => {
      expect(
        findingsIn('One.\n\nTwo.\n\n| a |\n| - |\n| b |\n\nThree.'),
      ).toEqual([])
    })

    it('should break the run on a fenced block', () => {
      expect(findingsIn('One.\n\nTwo.\n\n```sh\nls\n```\n\nThree.')).toEqual([])
    })

    it('should break the run on a bold section marker', () => {
      expect(findingsIn('One.\n\nTwo.\n\n**Risks:**\n\nThree.')).toEqual([])
    })

    it('should break the run on a list', () => {
      expect(findingsIn('One.\n\nTwo.\n\n- item\n\nThree.')).toEqual([])
    })
  })

  describe('a paragraph inside a list item', () => {
    it('should never count as a paragraph or toward a run', () => {
      const source = 'One.\n\nTwo.\n\n- item\n\n  Inside.\n\n  Again.'

      expect(findingsIn(source)).toEqual([])
    })

    it('should count toward its bullet length', () => {
      const source = `- ${text(150)}\n\n  ${text(100)}`

      expect(findingsIn(source)).toEqual([
        expect.objectContaining({ kind: 'bullet-length', line: 1, value: 251 }),
      ])
    })
  })

  describe('bullet length', () => {
    it('should pass a bullet at 200 characters, not counting its marker', () => {
      expect(findingsIn(`- ${text(200)}`)).toEqual([])
    })

    it('should report a bullet at 201 characters', () => {
      expect(findingsIn(`- ${text(201)}`)).toEqual([
        expect.objectContaining({
          kind: 'bullet-length',
          line: 1,
          value: 201,
          limit: 200,
        }),
      ])
    })

    it('should fold a continuation line into its bullet', () => {
      expect(kindsIn(`- ${text(150)}\n  ${text(60)}`)).toEqual([
        'bullet-length',
      ])
    })

    it('should leave a nested item out of its parent', () => {
      expect(findingsIn(`- ${text(150)}\n  - ${text(150)}`)).toEqual([])
    })

    it('should report a nested item at its own line and leave its parent clean', () => {
      expect(findingsIn(`- ${text(20)}\n  - ${text(201)}`)).toEqual([
        expect.objectContaining({
          kind: 'bullet-length',
          line: 2,
          value: 201,
          limit: 200,
        }),
      ])
    })

    it('should pass a nested item at 200 characters', () => {
      expect(findingsIn(`- ${text(20)}\n  - ${text(200)}`)).toEqual([])
    })

    it('should fold a nested item continuation into the nested item', () => {
      expect(
        findingsIn(`- ${text(20)}\n  - ${text(150)}\n    ${text(60)}`),
      ).toEqual([expect.objectContaining({ line: 2, value: 211 })])
    })

    it('should measure each nested level once under a numbered step', () => {
      const source = `1. ${text(20)}\n   - ${text(201)}\n     - ${text(201)}`

      expect(findingsIn(source).map(({ line }) => line)).toEqual([2, 3])
    })

    it('should leave a paragraph under the parent after its nested list out of both', () => {
      const source = `- ${text(150)}\n  - ${text(20)}\n\n  ${text(100)}`

      expect(findingsIn(source)).toEqual([])
    })

    it('should keep an indented table row out of a nested item length', () => {
      const source = `- ${text(20)}\n  - ${text(150)}\n    | ${text(100)} |`

      expect(findingsIn(source)).toEqual([])
    })
  })

  describe('bullets in a row', () => {
    it('should pass a run of 5 plain bullets', () => {
      expect(findingsIn(items(5))).toEqual([])
    })

    it('should report a run of 6 plain bullets at its first line', () => {
      expect(findingsIn(`# T\n\n${items(6)}`)).toEqual([
        expect.objectContaining({
          kind: 'bullet-run',
          line: 3,
          value: 6,
          limit: 5,
        }),
      ])
    })

    it('should exempt a run whose every item opens with a bold label', () => {
      expect(findingsIn(items(8, '**Label.** text'))).toEqual([])
    })
  })

  describe('heading depth', () => {
    it('should pass an H3', () => {
      expect(kindsIn('### Three\n\nLead.')).toEqual([])
    })

    it('should report an H4 with its level', () => {
      expect(findingsIn('#### Four\n\nBody.')).toEqual([
        expect.objectContaining({
          kind: 'heading-depth',
          line: 1,
          value: 4,
          limit: 3,
        }),
      ])
    })

    it('should not count a heading inside a fenced block', () => {
      expect(findingsIn('```md\n#### Four\n```')).toEqual([])
    })
  })

  describe('H3 opening', () => {
    it('should pass an H3 opening with a paragraph', () => {
      expect(findingsIn('### Three\n\nLead.\n\n- item')).toEqual([])
    })

    it('should pass an H3 opening with a table', () => {
      expect(findingsIn('### Three\n\n| a |\n| - |\n| b |')).toEqual([])
    })

    it('should report an H3 opening with a list once', () => {
      expect(findingsIn('# T\n\n### Three\n\n- one\n- two')).toEqual([
        expect.objectContaining({ kind: 'h3-opening', line: 3 }),
      ])
    })

    it('should report an H3 opening with a code block', () => {
      expect(kindsIn('### Three\n\n```sh\nls\n```')).toEqual(['h3-opening'])
    })

    it('should report an H3 with nothing under it before the next heading', () => {
      expect(kindsIn('### Three\n\n### Next\n\nLead.')).toEqual(['h3-opening'])
    })
  })

  it('should order findings by line', () => {
    const source = `${items(6)}\n\n#### Four\n\n${text(351)}`

    expect(findingsIn(source).map((finding) => finding.line)).toEqual([
      1, 8, 10,
    ])
  })
})
