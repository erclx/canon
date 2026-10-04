import { describe, expect, it } from 'vitest'
import { isStubSeed, stripSeedMarker } from '@/tooling/seed-marker'

function withFrontmatter(...fields: string[]): string {
  return ['---', ...fields, '---', '', '# Architecture', ''].join('\n')
}

describe('isStubSeed', () => {
  it('should read a file with no frontmatter as not a stub', () => {
    expect(isStubSeed('# Architecture\n')).toBe(false)
  })

  it('should read frontmatter without the field as not a stub', () => {
    expect(isStubSeed(withFrontmatter('title: Architecture'))).toBe(false)
  })

  it('should read the field set to true as a stub', () => {
    expect(
      isStubSeed(withFrontmatter('title: Architecture', 'stub: true')),
    ).toBe(true)
  })

  it('should read the field as a stub whatever its order in the block', () => {
    expect(
      isStubSeed(withFrontmatter('stub: true', 'title: Architecture')),
    ).toBe(true)
  })

  it('should read the field set to false as not a stub', () => {
    expect(isStubSeed(withFrontmatter('stub: false'))).toBe(false)
  })

  it('should read an unparsed value as not a stub, so a typo cannot silence the gate', () => {
    expect(isStubSeed(withFrontmatter('stub: yes'))).toBe(false)
  })

  it('should ignore the field outside the frontmatter block', () => {
    expect(isStubSeed('# Architecture\n\nstub: true\n')).toBe(false)
  })

  it('should ignore a frontmatter block that does not start the file', () => {
    expect(
      isStubSeed(`# Architecture\n\n${withFrontmatter('stub: true')}`),
    ).toBe(false)
  })
})

describe('stripSeedMarker', () => {
  it('should leave a file with no frontmatter untouched', () => {
    const source = '# Architecture\n'

    expect(stripSeedMarker(source)).toBe(source)
  })

  it('should leave frontmatter without the field untouched', () => {
    const source = withFrontmatter('title: Architecture')

    expect(stripSeedMarker(source)).toBe(source)
  })

  it('should remove the field and keep the other fields', () => {
    const source = withFrontmatter('title: Architecture', 'stub: true')

    expect(stripSeedMarker(source)).toBe(withFrontmatter('title: Architecture'))
  })

  it('should drop the block when the field was its only line', () => {
    expect(stripSeedMarker(withFrontmatter('stub: true'))).toBe(
      '# Architecture\n',
    )
  })

  it('should leave the body untouched when it mentions the field', () => {
    const source = [
      '---',
      'stub: true',
      '---',
      '',
      '# Architecture',
      '',
      'Set `stub: true` to exempt a seed.',
      '',
    ].join('\n')

    expect(stripSeedMarker(source)).toContain('Set `stub: true` to exempt')
  })

  it('should keep a dollar sequence in a kept field literal', () => {
    const source = withFrontmatter(
      'description: Budget $1 per run',
      'stub: true',
    )

    expect(stripSeedMarker(source)).toBe(
      withFrontmatter('description: Budget $1 per run'),
    )
  })

  it('should keep an ampersand sequence in a kept field literal', () => {
    const source = withFrontmatter('title: Sync $& merge', 'stub: true')

    expect(stripSeedMarker(source)).toBe(
      withFrontmatter('title: Sync $& merge'),
    )
  })

  it('should produce a file the reader no longer counts as a stub', () => {
    const stripped = stripSeedMarker(
      withFrontmatter('title: Architecture', 'stub: true'),
    )

    expect(isStubSeed(stripped)).toBe(false)
  })
})
