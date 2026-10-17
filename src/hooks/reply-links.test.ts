import { describe, expect, it } from 'vitest'
import { findMissingReplyLinks } from '@/hooks/reply-links'

const ROOT = '/main'

/** Resolves true only for the paths a case lists, as a fake disk. */
const disk =
  (...present: string[]) =>
  (path: string): boolean =>
    present.includes(path)

const destinations = (reply: string, ...present: string[]): string[] =>
  findMissingReplyLinks(reply, ROOT, disk(...present)).map(
    (missing) => missing.destination,
  )

describe('findMissingReplyLinks', () => {
  it('should return a link whose path is on no disk', () => {
    expect(destinations('See [it](src/gone.ts).')).toEqual(['src/gone.ts'])
  })

  it('should pass a link whose path exists under the root', () => {
    expect(destinations('See [it](src/real.ts).', '/main/src/real.ts')).toEqual(
      [],
    )
  })

  it('should check an absolute destination as given', () => {
    expect(
      destinations('[a](/main/a.md) [b](/main/b.md)', '/main/a.md'),
    ).toEqual(['/main/b.md'])
  })

  describe('skips', () => {
    it.each([
      ['a placeholder', '[x](<path>)'],
      ['a glob', '[x](docs/*.md)'],
      ['a url', '[x](https://example.com)'],
      ['a mailto', '[x](mailto:a@b.c)'],
      ['an anchor', '[x](#heading)'],
      ['an empty destination', '[x]()'],
    ])('should skip %s', (_, reply) => {
      expect(destinations(reply)).toEqual([])
    })

    it('should skip a link inside a fenced block', () => {
      expect(destinations('```md\n[x](src/gone.ts)\n```')).toEqual([])
    })

    it('should skip a link inside an inline code span', () => {
      expect(destinations('Write `[x](src/gone.ts)` verbatim.')).toEqual([])
    })

    it('should skip a destination with a malformed percent escape', () => {
      expect(destinations('[x](src/100%.ts)')).toEqual([])
    })
  })

  describe('tails', () => {
    it.each([
      [':42', '[x](src/real.ts:42)'],
      [':42-50', '[x](src/real.ts:42-50)'],
      [':42:7', '[x](src/real.ts:42:7)'],
      ['#L42', '[x](src/real.ts#L42)'],
    ])('should strip a %s tail before the existence test', (_, reply) => {
      expect(destinations(reply, '/main/src/real.ts')).toEqual([])
    })
  })

  it('should decode a percent escape and keep parentheses and spaces', () => {
    const reply = '[x](notes/a%20b.md) [y](notes/c_(1).md)'

    expect(
      destinations(reply, '/main/notes/a b.md', '/main/notes/c_(1).md'),
    ).toEqual([])
  })

  it('should resolve a relative records path against the injected root', () => {
    const reply = '[plan](.canon/plans/feature-x.md)'

    expect(destinations(reply, '/main/.canon/plans/feature-x.md')).toEqual([])
    expect(destinations(reply, '/elsewhere/.canon/plans/feature-x.md')).toEqual(
      ['.canon/plans/feature-x.md'],
    )
  })

  it('should suggest the main-root path for a worktree records link', () => {
    const link = '/main/.claude/worktrees/w/.canon/plans/feature-x.md'

    const [missing] = findMissingReplyLinks(
      `[plan](${link})`,
      ROOT,
      disk('/main/.canon/plans/feature-x.md'),
    )

    expect(missing?.suggestion).toBe('/main/.canon/plans/feature-x.md')
  })

  it('should offer no suggestion when the main-root path is missing too', () => {
    const [missing] = findMissingReplyLinks(
      '[plan](/main/.claude/worktrees/w/.canon/plans/feature-x.md)',
      ROOT,
      disk(),
    )

    expect(missing?.suggestion).toBeUndefined()
  })

  it('should stat each distinct path once', () => {
    const seen: string[] = []
    const reply = Array.from({ length: 100 }, () => '[x](src/gone.ts)').join(
      ' ',
    )

    const missing = findMissingReplyLinks(reply, ROOT, (path) => {
      seen.push(path)
      return false
    })

    expect(seen).toEqual(['/main/src/gone.ts'])
    expect(missing).toHaveLength(1)
  })

  it('should return nothing for a reply with no link', () => {
    expect(destinations('Plain text with `code` and (parens).')).toEqual([])
  })
})
