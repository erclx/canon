import { describe, expect, it } from 'vitest'
import { type EvidenceGate, evidenceGate } from '@/pr/lift'
import type { ReviewRow } from '@/pr/review-scope'

const HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'
const MOVED = '1111111111111111111111111111111111111111'

function twoWidths(fields: Partial<EvidenceGate> = {}): EvidenceGate {
  return {
    isSettled: true,
    owed: [],
    hasDrivableBox: true,
    owedWidths: [390, 1280],
    ...fields,
  }
}

function reelWaiver(reason: string): ReviewRow {
  return {
    body: `## UI review closed\n\n- **Waived reel:** ${reason}\n<!-- review-ui: head=${HEAD} -->`,
  }
}

describe('evidenceGate at several widths', () => {
  it('should owe the gate default width when no named width survives the class filter', () => {
    const gate = evidenceGate(
      twoWidths({ owedWidths: [], defaultWidth: 390 }),
      [],
      HEAD,
    )

    expect(gate).toMatchObject({ reason: 'reel-unsettled', reelWidths: [390] })
  })

  it('should refuse reel-unsettled naming the width no reel covers', () => {
    const gate = evidenceGate(
      twoWidths({ reels: [{ width: 1280, head: HEAD.slice(0, 7) }] }),
      [],
      HEAD,
    )

    expect(gate).toEqual({
      gate: 'evidence',
      isOk: false,
      reason: 'reel-unsettled',
      reelWidths: [390],
    })
  })

  it('should settle once the uncovered width carries a skip no builder can change', () => {
    const gate = evidenceGate(
      twoWidths({
        reels: [{ width: 1280, head: HEAD.slice(0, 7) }],
        reelSkips: new Map([[390, 'no-visible-change']]),
      }),
      [],
      HEAD,
    )

    expect(gate).toEqual({
      gate: 'evidence',
      isOk: true,
      reelSkip: 'no-visible-change',
    })
  })

  it('should refuse both widths on a bare deferred skip, beside a waiver it ignores', () => {
    const gate = evidenceGate(
      twoWidths({ reelSkip: 'deferred: behind #1' }),
      [reelWaiver('hover-only tooltip')],
      HEAD,
    )

    expect(gate).toEqual({
      gate: 'evidence',
      isOk: false,
      reason: 'reel-unsettled',
      reelSkip: 'deferred: behind #1',
      reelWidths: [390, 1280],
      reelWaiverRefused: 'hover-only tooltip',
    })
  })

  it('should settle every width a waiver reaches over a waivable skip', () => {
    const gate = evidenceGate(
      twoWidths({ reelSkip: 'wrong-state: beat 1' }),
      [reelWaiver('hover-only tooltip')],
      HEAD,
    )

    expect(gate).toEqual({
      gate: 'evidence',
      isOk: true,
      reelSkip: 'wrong-state: beat 1',
      reelWaived: 'hover-only tooltip',
    })
  })

  it('should let a width skip govern its width over the bare skip', () => {
    const gate = evidenceGate(
      twoWidths({
        reelSkip: 'deferred: behind #1',
        reelSkips: new Map([[390, 'no-visible-change']]),
      }),
      [],
      HEAD,
    )

    expect(gate).toMatchObject({
      reason: 'reel-unsettled',
      reelWidths: [1280],
    })
  })

  it('should judge each width on its own carry', () => {
    const reels = [
      { width: 390, head: MOVED },
      { width: 1280, head: HEAD.slice(0, 7) },
    ]

    const carried = evidenceGate(
      twoWidths({ reels }),
      [],
      HEAD,
      new Map([[390, MOVED]]),
    )
    const notCarried = evidenceGate(twoWidths({ reels }), [], HEAD)

    expect({ carried, notCarried }).toEqual({
      carried: { gate: 'evidence', isOk: true, reelCarriedFrom: MOVED },
      notCarried: {
        gate: 'evidence',
        isOk: false,
        reason: 'reel-unsettled',
        reelHead: MOVED,
        reelWidths: [390],
      },
    })
  })

  it('should name where a reel was filmed when every width settles on a carry', () => {
    const gate = evidenceGate(
      twoWidths({
        reels: [
          { width: 390, head: MOVED },
          { width: 1280, head: MOVED },
        ],
      }),
      [],
      HEAD,
      new Map([
        [390, MOVED],
        [1280, MOVED],
      ]),
    )

    expect(gate).toEqual({
      gate: 'evidence',
      isOk: true,
      reelCarriedFrom: MOVED,
    })
  })

  it('should owe the default width when the record names no owed width', () => {
    const gate = evidenceGate(
      twoWidths({
        owedWidths: [],
        reels: [{ width: 390, head: HEAD.slice(0, 7) }],
      }),
      [],
      HEAD,
    )

    expect(gate).toMatchObject({
      reason: 'reel-unsettled',
      reelWidths: [1280],
    })
  })
})
