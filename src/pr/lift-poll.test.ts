import { describe, expect, it } from 'vitest'
import { nextPollMs } from '@/pr/lift'

describe('nextPollMs', () => {
  it('should grow a 30s gap by half', () => {
    expect(nextPollMs(30_000)).toBe(45_000)
  })

  it('should stop growing at two minutes', () => {
    expect(nextPollMs(101_250)).toBe(120_000)
  })

  it('should hold a gap already at the cap', () => {
    expect(nextPollMs(120_000)).toBe(120_000)
  })

  it('should keep a first gap past the cap rather than shrink it', () => {
    expect(nextPollMs(300_000)).toBe(300_000)
  })
})
