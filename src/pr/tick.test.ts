import { describe, expect, it } from 'vitest'

import { renderEvidenceBody } from '@/pr/evidence'
import { tickBoxes } from '@/pr/tick'

const HEAD = 'abcdef1234567890'

const CHECKLIST = [
  '- [ ] hero settles',
  '- [ ] nav wraps',
  '- [ ] calm (taste)',
].join('\n')

function bodyWith(checklist: string | undefined): string {
  return renderEvidenceBody([], 'o/r', 'aaaa000', HEAD, undefined, checklist)
}

describe('tickBoxes', () => {
  it('should tick and stamp the named boxes only', () => {
    const result = tickBoxes(bodyWith(CHECKLIST), [2], HEAD)

    expect(result.kind).toBe('ticked')
    if (result.kind !== 'ticked') return
    expect(result.body).toContain('- [ ] hero settles\n')
    expect(result.body).toContain('- [x] nav wraps · passed at `abcdef1`\n')
  })

  it('should leave every line outside the named box as it was', () => {
    const body = bodyWith(CHECKLIST)
    const result = tickBoxes(body, [1], HEAD)

    expect(result.kind).toBe('ticked')
    if (result.kind !== 'ticked') return
    const changed = result.body
      .split('\n')
      .filter((line, index) => line !== body.split('\n')[index])
    expect(changed).toEqual(['- [x] hero settles · passed at `abcdef1`'])
  })

  it('should return the same body when a box is ticked twice at one head', () => {
    const once = tickBoxes(bodyWith(CHECKLIST), [1], HEAD)
    if (once.kind !== 'ticked') throw new Error('expected a tick')

    expect(tickBoxes(once.body, [1], HEAD)).toEqual(once)
  })

  it('should restamp a box ticked at an earlier head', () => {
    const once = tickBoxes(bodyWith(CHECKLIST), [1], '1111111aaaa')
    if (once.kind !== 'ticked') throw new Error('expected a tick')
    const again = tickBoxes(once.body, [1], HEAD)

    expect(again.kind === 'ticked' && again.body).toContain(
      '- [x] hero settles · passed at `abcdef1`',
    )
  })

  it('should refuse a box past the end of the checklist', () => {
    expect(tickBoxes(bodyWith(CHECKLIST), [4], HEAD)).toEqual({
      kind: 'refused',
      reason: 'no-box',
    })
  })

  it('should refuse a taste box named among passed ones', () => {
    expect(tickBoxes(bodyWith(CHECKLIST), [1, 3], HEAD)).toEqual({
      kind: 'refused',
      reason: 'taste-box',
    })
  })

  it('should refuse a body with no checklist', () => {
    expect(tickBoxes(bodyWith(undefined), [1], HEAD)).toEqual({
      kind: 'refused',
      reason: 'no-checklist',
    })
  })
})
