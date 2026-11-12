import { describe, expect, it } from 'vitest'
import { E2E_FILTER, locksHandSuite, type VitestRun } from '@/gate/hand-suite'

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

describe('a run selecting the end-to-end suites', () => {
  it('should lock the bare end-to-end filter', () => {
    expect(locksHandSuite(handRun({ args: ['run', E2E_FILTER] }))).toBe(true)
  })

  it('should lock the filter beside a name filter argument', () => {
    expect(locksHandSuite(handRun({ args: ['run', E2E_FILTER, 'film'] }))).toBe(
      true,
    )
  })

  it('should lock the filter beside -t', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', '-t', 'x', E2E_FILTER] })),
    ).toBe(true)
  })

  it('should lock a path to an end-to-end file', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', 'src/film/film.e2e.test.ts'] })),
    ).toBe(true)
  })

  it('should not lock under CI', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', E2E_FILTER], ci: true })),
    ).toBe(false)
  })

  it('should not lock in watch mode', () => {
    expect(locksHandSuite(handRun({ args: [E2E_FILTER], watch: true }))).toBe(
      false,
    )
  })

  it('should not lock when the parent gate holds the lock', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', E2E_FILTER], heldLock: 'tests' })),
    ).toBe(false)
  })
})

describe('a run that excludes the end-to-end suites', () => {
  it('should not lock the gate scoped command with a spaced --exclude', () => {
    expect(
      locksHandSuite(
        handRun({
          args: [
            'related',
            '--run',
            '--exclude',
            `**/*${E2E_FILTER}.ts`,
            'src/gate/hand-suite.ts',
          ],
        }),
      ),
    ).toBe(false)
  })

  it('should not lock the gate scoped command with --exclude=', () => {
    expect(
      locksHandSuite(
        handRun({
          args: [
            'related',
            '--run',
            `--exclude=**/*${E2E_FILTER}.ts`,
            'src/gate/hand-suite.ts',
          ],
        }),
      ),
    ).toBe(false)
  })

  it('should lock an end-to-end filter beside an --exclude', () => {
    expect(
      locksHandSuite(handRun({ args: ['run', '--exclude', 'x', E2E_FILTER] })),
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
