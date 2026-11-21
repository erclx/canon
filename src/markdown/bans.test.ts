import { describe, expect, it } from 'vitest'
import { BAN_SETS, emptyBanSets } from '@/markdown/bans'
import { bodyLines, scanBans } from '@/markdown/scan'

/**
 * The one set the audit measures, asserted rather than snapshotted so a
 * widening or a narrowing fails here and names what moved.
 */
const CHARACTERS = ['—', ';']

describe('BAN_SETS', () => {
  it('should ship the characters the punctuation rule states and nothing else', () => {
    expect(BAN_SETS).toEqual({ characters: CHARACTERS })
  })

  it('should report one hit for each character the audit measures', () => {
    const lines = bodyLines(
      CHARACTERS.map((term) => `A ${term} line.`).join('\n'),
    )

    const found = scanBans(lines, BAN_SETS)

    expect(found.map((hit) => hit.term)).toEqual(CHARACTERS)
  })

  it('should report nothing for a word or spelling the audit used to ban', () => {
    // The words moved to `write-human` as guidance, so a line carrying both reports clean.
    const lines = bodyLines('We leverage it and just check the behaviour.')

    expect(scanBans(lines, BAN_SETS)).toEqual([])
  })
})

describe('emptyBanSets', () => {
  it('should name no set when the characters carry a term', () => {
    expect(emptyBanSets()).toEqual([])
  })

  it('should name the characters when they arrived empty', () => {
    // Absent is not empty, since a scan with no terms would report a clean file looking for nothing.
    expect(emptyBanSets({ characters: [] })).toEqual(['characters'])
  })
})
