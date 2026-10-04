import { describe, expect, it } from 'vitest'
import { stripFrontmatter } from '@/markdown/frontmatter'

describe('stripFrontmatter', () => {
  it('should drop a leading frontmatter block', () => {
    expect(stripFrontmatter('---\ntitle: X\n---\n# Body\n')).toBe('# Body\n')
  })

  it('should leave a document without frontmatter unchanged', () => {
    expect(stripFrontmatter('# Body\n')).toBe('# Body\n')
  })

  it('should keep a horizontal rule that appears below the first line', () => {
    expect(stripFrontmatter('# Body\n\n---\n\nMore\n')).toBe(
      '# Body\n\n---\n\nMore\n',
    )
  })

  it('should keep the text between two horizontal rules in a body', () => {
    const source =
      '# Title\n\nintro\n\n---\n\nsection two\n\n---\n\nsection three\n'

    expect(stripFrontmatter(source)).toBe(source)
  })

  it('should keep horizontal rules in a body that also has frontmatter', () => {
    const source = '---\ntitle: X\n---\n# Title\n\n---\n\ntwo\n\n---\n\nthree\n'

    expect(stripFrontmatter(source)).toBe(
      '# Title\n\n---\n\ntwo\n\n---\n\nthree\n',
    )
  })

  it('should drop a frontmatter block that carries no trailing newline', () => {
    expect(stripFrontmatter('---\ntitle: X\n---')).toBe('')
  })

  it('should keep an unterminated block, which is a body rather than frontmatter', () => {
    const source = '---\ntitle: X\n# Body\nmore\n'

    expect(stripFrontmatter(source)).toBe(source)
  })

  it('should keep a block that opens on the second line', () => {
    const source = '\n---\ntitle: X\n---\n# Body\n'

    expect(stripFrontmatter(source)).toBe(source)
  })
})
