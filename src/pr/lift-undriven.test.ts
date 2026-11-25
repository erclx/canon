import { describe, expect, it } from 'vitest'
import type { RebaseRead } from '@/pr/carry'
import { type ChangedRead, type GateResult, uiGate } from '@/pr/lift'
import { DEFAULT_PAINTED } from '@/pr/painted'
import type { ReviewRow } from '@/pr/review-scope'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
const MOVED = '1111111111111111111111111111111111111111'
const DROVE_NOTHING = '0 failed · 0 need your eyes · 0 passed · 9 not driven'
const PARTLY_DRIVEN = '0 failed · 0 need your eyes · 7 passed · 9 not driven'
const WAIVED_NINE = '- **Waived undriven:** 9: local only on a hosted preview'

/** A UI close at `head` carrying `lines` under its heading. */
function uiClosed(lines: readonly string[], head = HEAD): ReviewRow {
  return {
    body: `## UI review closed\n\n${lines.join('\n')}\n<!-- review-ui: head=${head} -->`,
  }
}

interface Reading {
  readonly reviews: readonly ReviewRow[]
  readonly hasDrivableBox?: boolean
  readonly changed?: ChangedRead
  readonly rebased?: RebaseRead
  readonly unmerged?: readonly string[]
}

function read(reading: Reading): Promise<GateResult> {
  return uiGate(
    {
      readChanged: async () => reading.changed,
      readRebased: async () => reading.rebased,
      readUnmerged: async () => reading.unmerged,
    },
    DEFAULT_PAINTED,
    reading.reviews,
    HEAD,
    reading.hasDrivableBox ?? true,
  )
}

const REFUSED = { gate: 'ui', isOk: false, reason: 'ui-undriven' }

describe('uiGate over undriven boxes', () => {
  it('should refuse a close that left some boxes undriven with no waiver', async () => {
    const gate = await read({ reviews: [uiClosed([PARTLY_DRIVEN])] })

    expect(gate).toEqual(REFUSED)
  })

  it('should pass a close whose waiver counts every box not driven', async () => {
    const gate = await read({
      reviews: [uiClosed([PARTLY_DRIVEN, WAIVED_NINE])],
    })

    expect(gate).toEqual({ gate: 'ui', isOk: true, undrivenWaived: 9 })
  })

  it('should refuse a waiver counting more boxes than were left undriven', async () => {
    const gate = await read({
      reviews: [
        uiClosed([PARTLY_DRIVEN, '- **Waived undriven:** 10: local only']),
      ],
    })

    expect(gate).toEqual(REFUSED)
  })

  it('should refuse a waiver whose count is stale', async () => {
    const gate = await read({
      reviews: [
        uiClosed([PARTLY_DRIVEN, '- **Waived undriven:** 8: local only']),
      ],
    })

    expect(gate).toEqual(REFUSED)
  })

  it('should refuse a waiver quoted inside a fenced block', async () => {
    const gate = await read({
      reviews: [uiClosed([PARTLY_DRIVEN, '```text', WAIVED_NINE, '```'])],
    })

    expect(gate).toEqual(REFUSED)
  })

  it('should refuse a pass that drove nothing, whatever it waives', async () => {
    const gate = await read({
      reviews: [uiClosed([DROVE_NOTHING, WAIVED_NINE])],
    })

    expect(gate).toEqual(REFUSED)
  })

  it('should pass a close with boxes not driven once no drivable box is left', async () => {
    const gate = await read({
      reviews: [uiClosed([PARTLY_DRIVEN])],
      hasDrivableBox: false,
    })

    expect(gate).toEqual({ gate: 'ui', isOk: true })
  })

  describe('whose waiver counts', () => {
    it('should not read a waiver off an older UI close', async () => {
      const gate = await read({
        reviews: [
          uiClosed([PARTLY_DRIVEN, WAIVED_NINE]),
          uiClosed([PARTLY_DRIVEN]),
        ],
      })

      expect(gate).toEqual(REFUSED)
    })

    it('should not read a waiver off a code review', async () => {
      const gate = await read({
        reviews: [
          uiClosed([PARTLY_DRIVEN]),
          {
            body: `## Review closed\n\n${WAIVED_NINE}\n<!-- review-pr: commit=${HEAD} read-at=2026-10-12T10:00:00Z -->`,
          },
        ],
      })

      expect(gate).toEqual(REFUSED)
    })

    it('should not read a waiver off a dismissed UI close', async () => {
      const gate = await read({
        reviews: [
          {
            ...uiClosed([PARTLY_DRIVEN, WAIVED_NINE]),
            state: 'DISMISSED',
          },
        ],
      })

      expect(gate).toEqual(REFUSED)
    })

    it('should carry a waiver with its close across an inert push', async () => {
      const gate = await read({
        reviews: [uiClosed([PARTLY_DRIVEN, WAIVED_NINE], MOVED)],
        changed: { isAncestor: true, paths: ['README.md'] },
      })

      expect(gate).toMatchObject({
        isOk: true,
        carriedFrom: MOVED,
        undrivenWaived: 9,
      })
    })

    it.each([
      [
        'rebase',
        { isAncestor: false, paths: [] },
        { differingPaths: [], ownPaths: ['src/App.tsx'] },
      ],
      [
        'merge',
        { isAncestor: true, paths: ['src/main-only.ts'] },
        { differingPaths: [], ownPaths: ['src/App.tsx'] },
      ],
    ] as const)(
      'should carry a waiver with its close across a %s of the base',
      async (carriedAcross, changed, rebased) => {
        const gate = await read({
          reviews: [uiClosed([PARTLY_DRIVEN, WAIVED_NINE], MOVED)],
          changed,
          rebased,
          unmerged: [],
        })

        expect(gate).toEqual({
          gate: 'ui',
          isOk: true,
          carriedFrom: MOVED,
          carriedAcross,
          undrivenWaived: 9,
        })
      },
    )

    it('should refuse an unwaived close before it reads a merge of the base', async () => {
      const gate = await read({
        reviews: [uiClosed([PARTLY_DRIVEN], MOVED)],
        changed: { isAncestor: true, paths: ['src/main-only.ts'] },
        rebased: { differingPaths: [], ownPaths: [] },
        unmerged: [],
      })

      expect(gate).toEqual(REFUSED)
    })
  })
})
