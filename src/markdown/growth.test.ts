import { describe, expect, it } from 'vitest'
import { grownBlocks, normalizeProse } from '@/markdown/growth'

function sentence(words: number): string {
  return `${'word '.repeat(words)}end.`
}

describe('normalizeProse', () => {
  it('should drop a list marker, emphasis marks, and wrapping', () => {
    expect(normalizeProse('- **Label** one\n  two')).toBe('Label one two')
  })

  it('should leave the words themselves alone', () => {
    expect(normalizeProse('a `code` span, with words')).toBe(
      'a `code` span, with words',
    )
  })
})

describe('grownBlocks', () => {
  const long = sentence(150)

  it('should pass a long paragraph the base holds', () => {
    const base = normalizeProse(`# A\n\n${long}\n`)

    expect(grownBlocks(`# A\n\n${long}\n`, base)).toEqual([])
  })

  it('should fail a paragraph with one word added', () => {
    const base = normalizeProse(`# A\n\n${long}\n`)
    const found = grownBlocks(`# A\n\n${sentence(151)}\n`, base)

    expect(found.map((block) => block.kind)).toEqual(['paragraph'])
  })

  it('should pass a bullet whose only change is a bold label', () => {
    const bullet = `- ${sentence(60)}`
    const base = normalizeProse(`${bullet}\n`)
    const labelled = bullet.replace('- word', '- **word**')

    expect(grownBlocks(`${labelled}\n`, base)).toEqual([])
  })

  it('should pass a paragraph under the checkpoint however it changed', () => {
    expect(grownBlocks(`# A\n\n${sentence(20)}\n`, '')).toEqual([])
  })
})
