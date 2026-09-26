import { describe, expect, it } from 'vitest'
import { pendingNote, singleLine, upgradedMessage } from '@/commands/upgrade'

describe('upgradedMessage', () => {
  it('should report the version move when the reinstall changed it', () => {
    expect(upgradedMessage('4.10.0', '4.11.0')).toBe(
      'CLI upgraded 4.10.0 to 4.11.0.',
    )
  })

  it('should report no change when the reinstall left the version the same', () => {
    expect(upgradedMessage('4.11.0', '4.11.0')).toBe(
      'CLI reinstalled 4.11.0, unchanged.',
    )
  })
})

describe('pendingNote', () => {
  it('should name both versions when the checkout is ahead of what npm serves', () => {
    expect(pendingNote('5.0.0', '5.1.0')).toBe(
      'The checkout is at 5.1.0 and npm serves 5.0.0.',
    )
  })

  it('should report nothing when the checkout equals what npm serves', () => {
    expect(pendingNote('5.1.0', '5.1.0')).toBeUndefined()
  })

  it('should report nothing when the checkout is behind what npm serves', () => {
    expect(pendingNote('5.1.0', '5.0.0')).toBeUndefined()
  })

  it('should report nothing when there is no checkout', () => {
    expect(pendingNote('5.1.0', undefined)).toBeUndefined()
  })

  it('should report nothing when the checkout version does not parse', () => {
    expect(pendingNote('5.1.0', 'next')).toBeUndefined()
  })

  it('should report nothing when npm has served no version', () => {
    expect(pendingNote(undefined, '5.1.0')).toBeUndefined()
  })
})

describe('singleLine', () => {
  it('should swap a double quote for an apostrophe', () => {
    expect(
      singleLine('Unexpected token \'<\', "<html>..." is not valid JSON'),
    ).toBe("Unexpected token '<', '<html>...' is not valid JSON")
  })

  it('should collapse embedded newlines and repeated whitespace to one space', () => {
    expect(singleLine('line one\nline   two')).toBe('line one line two')
  })

  it('should leave ordinary text unchanged', () => {
    expect(singleLine('Installed 4.11.0, which is the newest published.')).toBe(
      'Installed 4.11.0, which is the newest published.',
    )
  })
})
