import { describe, expect, it } from 'vitest'
import { isInert, readCarry } from '@/pr/carry'
import type { ChangedRead } from '@/pr/lift'

const DRIVEN = '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TIP = '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function changedRead(read: ChangedRead | undefined) {
  return async (): Promise<ChangedRead | undefined> => read
}

describe('isInert', () => {
  it.each([
    'src/pr/lift.test.ts',
    'src/App.spec.tsx',
    'src/Button.stories.tsx',
    'src/__tests__/render.ts',
    'src/__snapshots__/card.snap',
    'README.md',
    'docs/guide.md',
    'docs/board.md',
    'canon/context/board/shell.md',
    '.claude/skills/internal-docs/SKILL.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    'evidence/board/light.png',
    'canon/design/board/frame.html',
  ])('should classify %s as inert', (path) => {
    expect(isInert(path)).toBe(true)
  })

  it.each([
    'src/gesture.ts',
    'src/App.tsx',
    'src/data/boards.json',
    'docs/page.mdx',
    'src/pages/about.md',
    'src/pages/about.mdx',
    'src/content/blog/a.md',
    'content/blog/post.md',
    'web/README.md',
    'vite.config.ts',
    'evidence/capture.ts',
  ])('should classify %s as driven', (path) => {
    expect(isInert(path)).toBe(false)
  })
})

describe('readCarry', () => {
  it('should read covered when the driven commit is the head', async () => {
    const carry = await readCarry(
      changedRead(undefined),
      DRIVEN.slice(0, 7),
      DRIVEN,
    )

    expect(carry).toEqual({ kind: 'covered' })
  })

  it('should carry across a gap of tests and markdown', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['src/gesture.test.ts', 'README.md'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'carried', carriedFrom: DRIVEN })
  })

  it('should carry across a gap of evidence captures alone', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['evidence/board/light.png', 'evidence/board/dark.png'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'carried', carriedFrom: DRIVEN })
  })

  it('should move on a gap touching a non-painted source file', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['src/gesture.ts', 'src/gesture.test.ts'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'moved', drivenPaths: ['src/gesture.ts'] })
  })

  it('should name only the driven paths of a mixed gap', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['CHANGELOG.md', 'src/Card.tsx', 'src/data.json'],
    })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({
      kind: 'moved',
      drivenPaths: ['src/Card.tsx', 'src/data.json'],
    })
  })

  it('should never carry from a commit the head does not descend from', async () => {
    const read = changedRead({ isAncestor: false, paths: [] })

    const carry = await readCarry(read, DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'not-ancestor' })
  })

  it('should read failed when the gap could not be read', async () => {
    const carry = await readCarry(changedRead(undefined), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'failed' })
  })
})
