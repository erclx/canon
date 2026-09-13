import { describe, expect, it } from 'vitest'
import { findBrokenLinks } from '@/markdown/links'
import { bodyLines } from '@/markdown/scan'

function fake(existing: readonly string[]) {
  const calls: string[] = []
  const exists = (path: string): boolean => {
    calls.push(path)
    return existing.includes(path)
  }
  return { exists, calls }
}

describe('findBrokenLinks', () => {
  it('should not report a link whose destination exists', () => {
    const { exists } = fake(['docs/agents/commands.md'])
    const found = findBrokenLinks(
      bodyLines('See [commands](docs/agents/commands.md).\n'),
      exists,
    )

    expect(found).toEqual([])
  })

  it('should report a link whose destination does not exist', () => {
    const { exists } = fake([])
    const found = findBrokenLinks(
      bodyLines('See [commands](docs/agents/commands.md).\n'),
      exists,
    )

    expect(found).toEqual([
      { line: 1, column: 15, destination: 'docs/agents/commands.md' },
    ])
  })

  it('should never pass a template placeholder destination to exists', () => {
    const { exists, calls } = fake([])
    const found = findBrokenLinks(
      bodyLines('See [an entry](canon/context/<domain>.md).\n'),
      exists,
    )

    expect(calls).toEqual([])
    expect(found).toEqual([])
  })

  it('should skip a destination opening with a URL scheme', () => {
    const { exists, calls } = fake([])
    const found = findBrokenLinks(
      bodyLines('See [docs](https://example.com/x).\n'),
      exists,
    )

    expect(calls).toEqual([])
    expect(found).toEqual([])
  })

  it('should skip a same-file anchor destination', () => {
    const { exists, calls } = fake([])
    const found = findBrokenLinks(bodyLines('See [above](#scope).\n'), exists)

    expect(calls).toEqual([])
    expect(found).toEqual([])
  })

  it('should skip a root-absolute destination', () => {
    const { exists, calls } = fake([])
    const found = findBrokenLinks(
      bodyLines('See [readme](/README.md).\n'),
      exists,
    )

    expect(calls).toEqual([])
    expect(found).toEqual([])
  })

  it('should skip a link masked out by sitting inside a code span', () => {
    const { exists, calls } = fake([])
    const found = findBrokenLinks(
      bodyLines('Not a link: `[commands](docs/agents/commands.md)`.\n'),
      exists,
    )

    expect(calls).toEqual([])
    expect(found).toEqual([])
  })

  it('should report a destination carrying a malformed encoding without throwing', () => {
    const { exists, calls } = fake([])
    const found = findBrokenLinks(
      bodyLines('See [bad](docs/agents/100%.md).\n'),
      exists,
    )

    expect(calls).toEqual([])
    expect(found).toEqual([
      { line: 1, column: 10, destination: 'docs/agents/100%.md' },
    ])
  })

  it('should not report a destination carrying one level of balanced parentheses that exists', () => {
    const { exists, calls } = fake(['docs/agents/file(1).md'])
    const found = findBrokenLinks(
      bodyLines('See [x](docs/agents/file(1).md).\n'),
      exists,
    )

    expect(calls).toEqual(['docs/agents/file(1).md'])
    expect(found).toEqual([])
  })

  it('should report a destination carrying balanced parentheses that does not exist', () => {
    const { exists } = fake([])
    const found = findBrokenLinks(
      bodyLines('See [x](docs/agents/file(1).md).\n'),
      exists,
    )

    expect(found).toEqual([
      { line: 1, column: 8, destination: 'docs/agents/file(1).md' },
    ])
  })
})
