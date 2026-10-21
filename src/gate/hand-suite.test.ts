import { describe, expect, it } from 'vitest'
import { locksHandSuite, type VitestRun } from '@/gate/hand-suite'

function handRun(overrides: Partial<VitestRun> = {}): VitestRun {
  return {
    args: ['run'],
    ci: false,
    watch: false,
    heldLock: undefined,
    ...overrides,
  }
}

describe('a full hand-run suite', () => {
  it('should lock a bare run', () => {
    expect(locksHandSuite(handRun())).toBe(true)
  })

  it('should lock a bare run carrying only flags', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', '--reporter=dot', '--silent'] })),
    ).toBe(true)
  })
})

describe('a run that takes no lock', () => {
  it('should not lock a run filtered by path', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', 'src/gate/suite-lock.test.ts'] })),
    ).toBe(false)
  })

  it('should not lock a run filtered by a bare file stem', () => {
    expect(locksHandSuite(handRun({ args: ['run', 'suite-lock'] }))).toBe(false)
  })

  it('should not lock a run filtered by a directory', () => {
    expect(locksHandSuite(handRun({ args: ['run', 'src/gate/'] }))).toBe(false)
  })

  it('should not lock a run filtered by -t', () => {
    expect(locksHandSuite(handRun({ args: ['run', '-t', 'lock'] }))).toBe(false)
  })

  it('should not lock a run filtered by --testNamePattern=', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', '--testNamePattern=lock'] })),
    ).toBe(false)
  })

  it('should not lock under CI', () => {
    expect(locksHandSuite(handRun({ ci: true }))).toBe(false)
  })

  it('should not lock in watch mode', () => {
    expect(locksHandSuite(handRun({ args: [], watch: true }))).toBe(false)
  })

  it('should not lock a suite whose parent gate holds the lock', () => {
    expect(locksHandSuite(handRun({ heldLock: 'tests' }))).toBe(false)
  })
})
