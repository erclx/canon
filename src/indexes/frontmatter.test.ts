import { describe, expect, it } from 'vitest'
import {
  parseFrontmatter,
  readField,
  readFrontmatterSource,
} from '@/indexes/frontmatter'

function buildSource(block: string, body = 'body\n'): string {
  return `---\n${block}\n---\n\n${body}`
}

describe('parseFrontmatter', () => {
  it('should keep the delimiters in raw so an index round-trips unchanged', () => {
    const source = buildSource('title: Docs\nsubtitle: One line')
    const parsed = parseFrontmatter(source)
    expect(parsed?.raw).toBe('---\ntitle: Docs\nsubtitle: One line\n---')
  })

  it('should return undefined when the source has no frontmatter block', () => {
    expect(parseFrontmatter('# Heading\n\nbody\n')).toBeUndefined()
  })

  it('should return undefined when the block is not a mapping', () => {
    expect(parseFrontmatter(buildSource('- one\n- two'))).toBeUndefined()
  })

  it('should return undefined rather than throw when the block will not parse', () => {
    const source = buildSource('title: Demo\ndescription: Demo: a colon')
    expect(parseFrontmatter(source)).toBeUndefined()
  })

  it('should preserve key order and comments in raw', () => {
    const source = buildSource('# note\nb: second\na: first')
    expect(parseFrontmatter(source)?.raw).toContain(
      '# note\nb: second\na: first',
    )
  })
})

describe('readFrontmatterSource', () => {
  it('should read a source with no block as absent', () => {
    expect(readFrontmatterSource('# Heading\n\nbody\n')).toEqual({
      kind: 'absent',
    })
  })

  it('should read a block that will not parse as invalid with the parser message', () => {
    const reading = readFrontmatterSource(
      buildSource("title: 'Trim the Board's ad page'\ndescription: Demo"),
    )
    expect(reading.kind).toBe('invalid')
    if (reading.kind === 'invalid') expect(reading.message).not.toBe('')
  })

  it('should read a block that is a list as invalid', () => {
    expect(readFrontmatterSource(buildSource('- one\n- two')).kind).toBe(
      'invalid',
    )
  })

  it('should read a doubled-quote apostrophe back as one apostrophe', () => {
    const reading = readFrontmatterSource(
      buildSource("title: 'Trim the Board''s ad page'\ndescription: Demo"),
    )
    expect(reading.kind).toBe('parsed')
    if (reading.kind === 'parsed') {
      expect(readField(reading.frontmatter, 'title')).toBe(
        "Trim the Board's ad page",
      )
    }
  })
})

describe('readField', () => {
  it('should strip the surrounding quotes a yaml scalar carries', () => {
    const parsed = parseFrontmatter(buildSource("subtitle: 'Quoted: value'"))
    expect(readField(parsed, 'subtitle')).toBe('Quoted: value')
  })

  it('should return undefined for a key the block does not define', () => {
    const parsed = parseFrontmatter(buildSource('title: Docs'))
    expect(readField(parsed, 'category')).toBeUndefined()
  })

  it('should coerce a boolean to a string so auto false is comparable', () => {
    const parsed = parseFrontmatter(buildSource('auto: false'))
    expect(readField(parsed, 'auto')).toBe('false')
  })

  it('should return undefined when the frontmatter is missing entirely', () => {
    expect(readField(undefined, 'title')).toBeUndefined()
  })
})
