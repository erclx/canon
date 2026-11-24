import { describe, expect, it } from 'vitest'
import { toEvidenceGate } from '@/commands/pr/gates'

describe('toEvidenceGate', () => {
  const CHECKLIST = [
    '- [ ] /board, 390: tap the card → the sheet opens',
    '- [ ] /board: click the card → the sheet opens',
    '- [ ] /board, 768: the column feels calm (taste)',
  ].join('\n')

  it('should read each reel, the skips by width, and the widths the drivable boxes owe', () => {
    const gate = toEvidenceGate({
      reason: 'settled',
      owed: [],
      checklist: CHECKLIST,
      drivable: 2,
      reels: [
        { link: 'https://x/reel-390.webp', head: 'abc1234', width: 390 },
        { link: 'https://x/reel-1280.webp', head: 'abc1234', width: 1280 },
      ],
      reelSkip: 'deferred: behind #1',
      reelSkips: [{ width: 390, skip: 'no-visible-change' }],
    })

    expect(gate).toEqual({
      isSettled: true,
      owed: [],
      hasDrivableBox: true,
      reels: [
        { width: 390, head: 'abc1234' },
        { width: 1280, head: 'abc1234' },
      ],
      reelSkip: 'deferred: behind #1',
      reelSkips: new Map([[390, 'no-visible-change']]),
      owedWidths: [390, 1280],
    })
  })

  it('should drop a reel carrying no width or no head rather than guess one', () => {
    const gate = toEvidenceGate({
      reason: 'settled',
      reels: [
        { link: 'https://x/reel.webp', head: 'abc1234' },
        { link: 'https://x/reel-390.webp', width: 390, head: '' },
        'not a reel',
      ],
    })

    expect(gate).not.toHaveProperty('reels')
  })

  it('should owe no width of a device class the project leaves out', () => {
    const gate = toEvidenceGate(
      { reason: 'settled', checklist: CHECKLIST, drivable: 2 },
      ['desktop'],
    )

    expect(gate?.owedWidths).toEqual([1280])
  })

  it('should owe no width when the record carries no checklist', () => {
    const gate = toEvidenceGate({ reason: 'owed', owed: ['evidence'] })

    expect(gate).toEqual({
      isSettled: false,
      owed: ['evidence'],
      hasDrivableBox: false,
    })
  })

  it('should read a record that is not a check as nothing', () => {
    expect(toEvidenceGate({ reason: 'ok' })).toBeUndefined()
  })
})
