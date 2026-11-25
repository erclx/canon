import { describe, expect, it } from 'vitest'
import {
  isInert,
  readCarry,
  readMergeCarry,
  readRebaseCarry,
  readUiCarry,
  type RebaseRead,
} from '@/pr/carry'
import type { ChangedRead } from '@/pr/lift'

const DRIVEN = '1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TIP = '2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function changedRead(read: ChangedRead | undefined) {
  return async (): Promise<ChangedRead | undefined> => read
}

function rebaseRead(read: RebaseRead | undefined) {
  return async (): Promise<RebaseRead | undefined> => read
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
    'e2e/capture/board/chrome.ts',
    'web/e2e/capture/cases.ts',
    'e2e/screenshot.ts',
    'web/e2e/capture-types.ts',
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
    'e2e/capture/board/page.tsx',
    'e2e/capture/board/style.css',
    'e2e/helpers/login.ts',
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

  it('should carry across a source change the predicate lets through', async () => {
    const read = changedRead({
      isAncestor: true,
      paths: ['src/capture/render.ts', 'src/gesture.ts'],
    })

    const carry = await readCarry(read, DRIVEN, TIP, (path) =>
      path.startsWith('src/take/'),
    )

    expect(carry).toEqual({ kind: 'carried', carriedFrom: DRIVEN })
  })

  it('should move on a path the predicate names however inert it reads', async () => {
    const read = changedRead({ isAncestor: true, paths: ['README.md'] })

    const carry = await readCarry(read, DRIVEN, TIP, () => true)

    expect(carry).toEqual({ kind: 'moved', drivenPaths: ['README.md'] })
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

describe('readUiCarry', () => {
  function reads(
    changed: ChangedRead | undefined,
    rebased?: RebaseRead,
    unmerged?: readonly string[],
  ): Parameters<typeof readUiCarry>[0] {
    return {
      readChanged: changedRead(changed),
      readRebased: rebaseRead(rebased),
      readUnmerged: async () => unmerged,
    }
  }

  it('should carry across a push of tests and markdown', async () => {
    const carry = await readUiCarry(
      reads({ isAncestor: true, paths: ['README.md'] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({
      kind: 'carried',
      carriedFrom: DRIVEN,
      carriedAcross: 'push',
    })
  })

  it('should carry across a rebase whose differing paths are inert', async () => {
    const carry = await readUiCarry(
      reads(
        { isAncestor: false, paths: [] },
        { differingPaths: ['README.md'], ownPaths: ['README.md'] },
      ),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({
      kind: 'carried',
      carriedFrom: DRIVEN,
      carriedAcross: 'rebase',
    })
  })

  it('should move on a rebase that changed a driven path', async () => {
    const carry = await readUiCarry(
      reads(
        { isAncestor: false, paths: [] },
        {
          differingPaths: ['README.md', 'src/App.tsx'],
          ownPaths: ['README.md', 'src/App.tsx'],
        },
      ),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'moved', drivenPaths: ['src/App.tsx'] })
  })

  it('should read behind when the rebase comparison could not be read', async () => {
    const carry = await readUiCarry(
      reads({ isAncestor: false, paths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'behind' })
  })

  it('should read failed when the gap could not be read', async () => {
    const carry = await readUiCarry(reads(undefined), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'failed' })
  })

  describe('across a merge of the base', () => {
    const MERGED = {
      isAncestor: true,
      paths: ['src/main-only.ts', 'src/App.tsx'],
    }

    it('should carry when the merge brought only paths the branch never wrote', async () => {
      const carry = await readUiCarry(
        reads(MERGED, { differingPaths: [], ownPaths: ['src/card.ts'] }, []),
        DRIVEN,
        TIP,
      )

      expect(carry).toEqual({
        kind: 'carried',
        carriedFrom: DRIVEN,
        carriedAcross: 'merge',
      })
    })

    it('should move on a path both sides wrote, however cleanly it merged', async () => {
      const carry = await readUiCarry(
        reads(
          MERGED,
          { differingPaths: [], ownPaths: ['src/App.tsx', 'src/card.ts'] },
          [],
        ),
        DRIVEN,
        TIP,
      )

      expect(carry).toEqual({ kind: 'moved', drivenPaths: ['src/App.tsx'] })
    })

    it('should carry when the path both sides wrote is inert', async () => {
      const carry = await readUiCarry(
        reads(
          { isAncestor: true, paths: ['README.md', 'src/main-only.ts'] },
          { differingPaths: ['README.md'], ownPaths: ['README.md'] },
          [],
        ),
        DRIVEN,
        TIP,
      )

      expect(carry).toMatchObject({ kind: 'carried', carriedAcross: 'merge' })
    })

    it('should name each differing and each shared path of a merge once, sorted', async () => {
      const carry = await readUiCarry(
        reads(
          MERGED,
          {
            differingPaths: ['src/App.tsx', 'src/sneaked.ts'],
            ownPaths: ['src/App.tsx', 'src/main-only.ts', 'src/sneaked.ts'],
          },
          [],
        ),
        DRIVEN,
        TIP,
      )

      expect(carry).toEqual({
        kind: 'moved',
        drivenPaths: ['src/App.tsx', 'src/main-only.ts', 'src/sneaked.ts'],
      })
    })

    it('should name every changed path on a branch commit beside the merge', async () => {
      const carry = await readUiCarry(
        reads(MERGED, { differingPaths: [], ownPaths: [] }, [TIP]),
        DRIVEN,
        TIP,
      )

      expect(carry).toEqual({ kind: 'moved', drivenPaths: MERGED.paths })
    })

    it('should name every changed path when the commits of a merge could not be listed', async () => {
      const carry = await readUiCarry(
        reads(MERGED, { differingPaths: [], ownPaths: [] }),
        DRIVEN,
        TIP,
      )

      expect(carry).toEqual({ kind: 'moved', drivenPaths: MERGED.paths })
    })

    it('should read behind when the comparison across a merge could not be read', async () => {
      const carry = await readUiCarry(reads(MERGED, undefined, []), DRIVEN, TIP)

      expect(carry).toEqual({ kind: 'behind' })
    })
  })
})

describe('readRebaseCarry', () => {
  it('should carry when the branch diff is equal at both commits', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({ differingPaths: [], ownPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'rebased', carriedFrom: DRIVEN })
  })

  it('should refuse a differing inert path by default', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({ differingPaths: ['README.md'], ownPaths: ['README.md'] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'changed', differingPaths: ['README.md'] })
  })

  it('should carry across a differing inert path the predicate lets through', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({
        differingPaths: ['README.md', 'src/a.test.ts'],
        ownPaths: ['README.md', 'src/a.test.ts'],
      }),
      DRIVEN,
      TIP,
      (path) => !isInert(path),
    )

    expect(carry).toEqual({ kind: 'rebased', carriedFrom: DRIVEN })
  })

  it('should name only the differing driven paths', async () => {
    const carry = await readRebaseCarry(
      rebaseRead({
        differingPaths: ['README.md', 'src/App.tsx'],
        ownPaths: ['README.md', 'src/App.tsx'],
      }),
      DRIVEN,
      TIP,
      (path) => !isInert(path),
    )

    expect(carry).toEqual({ kind: 'changed', differingPaths: ['src/App.tsx'] })
  })

  it('should carry nothing when the comparison could not be read', async () => {
    const carry = await readRebaseCarry(rebaseRead(undefined), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'unread' })
  })
})

describe('readMergeCarry', () => {
  function reads(
    unmerged: readonly string[] | undefined,
    rebased?: RebaseRead,
  ): Parameters<typeof readMergeCarry>[0] {
    return {
      readUnmerged: async () => unmerged,
      readRebased: rebaseRead(rebased),
    }
  }

  it('should carry across merges of the base with the branch diff equal', async () => {
    const carry = await readMergeCarry(
      reads([], { differingPaths: [], ownPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'merged', carriedFrom: DRIVEN })
  })

  it('should name the differing paths when a merge changed the branch diff', async () => {
    const carry = await readMergeCarry(
      reads([], { differingPaths: ['README.md'], ownPaths: ['README.md'] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'changed', differingPaths: ['README.md'] })
  })

  it('should refuse a commit of the branch even with the diff equal', async () => {
    const carry = await readMergeCarry(
      reads([TIP], { differingPaths: [], ownPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'unmerged' })
  })

  it('should carry nothing when the commits could not be listed', async () => {
    const carry = await readMergeCarry(
      reads(undefined, { differingPaths: [], ownPaths: [] }),
      DRIVEN,
      TIP,
    )

    expect(carry).toEqual({ kind: 'unread' })
  })

  it('should carry nothing when the comparison could not be read', async () => {
    const carry = await readMergeCarry(reads([]), DRIVEN, TIP)

    expect(carry).toEqual({ kind: 'unread' })
  })
})
