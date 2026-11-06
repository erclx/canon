import { describe, expect, it } from 'vitest'
import { findHeadingCase } from '@/markdown/heading-case'

describe('findHeadingCase', () => {
  it('should report a heading with a capitalized word after the first', () => {
    const found = findHeadingCase('## Key Changes\n')

    expect(found).toEqual([
      { line: 1, text: 'Key Changes', words: ['Changes'] },
    ])
  })

  it('should report a frontmatter title the same way', () => {
    const found = findHeadingCase('---\ntitle: Key Changes\n---\n\nBody.\n')

    expect(found).toEqual([
      { line: 2, text: 'Key Changes', words: ['Changes'] },
    ])
  })

  it('should not report a sentence case heading', () => {
    expect(findHeadingCase('## MCP servers\n')).toEqual([])
  })

  it('should not report an all-caps token or a plural acronym', () => {
    expect(findHeadingCase('## Run the CLI and the APIs\n')).toEqual([])
  })

  it('should treat a leading code span as the first word', () => {
    expect(findHeadingCase('## `canon sync` flags\n')).toEqual([])
    expect(findHeadingCase('## `canon sync` Flags\n')).toHaveLength(1)
  })

  it('should not report a capital inside a code span', () => {
    expect(findHeadingCase('## Run `Foo Bar` first\n')).toEqual([])
  })

  it('should take the first word after a numeral as the first', () => {
    expect(findHeadingCase('## 1. Summary\n')).toEqual([])
  })

  it('should check sentence case from the word after a phase label', () => {
    expect(findHeadingCase('# v171.8: The colon check\n')).toEqual([])
    expect(
      findHeadingCase('---\ntitle: v171.8: The colon check\n---\n\nBody.\n'),
    ).toEqual([])
  })

  it('should report a title case heading after a phase label', () => {
    const found = findHeadingCase('# v171.8: The Colon Check\n')

    expect(found).toEqual([
      {
        line: 1,
        text: 'v171.8: The Colon Check',
        words: ['Colon', 'Check'],
      },
    ])
  })

  it('should not read a version without a dot as a phase label', () => {
    const found = findHeadingCase('## v2 support: Notes\n')

    expect(found.map((hit) => hit.words)).toEqual([['Notes']])
  })

  it('should leave a heading with no label as it was', () => {
    expect(findHeadingCase('## The colon check\n')).toEqual([])
  })

  it('should not report a heading inside a fence', () => {
    expect(findHeadingCase('```md\n## Key Changes\n```\n')).toEqual([])
  })
})
