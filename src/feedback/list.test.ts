import { describe, expect, it } from 'vitest'
import { listFlagProblem, listRecord } from '@/feedback/list'

function issue(number: number) {
  return {
    number,
    title: `report ${number}`,
    url: `https://github.com/erclx/canon/issues/${number}`,
  }
}

describe('listRecord', () => {
  it('should carry ok and the issues on a read', () => {
    const record = listRecord({ ok: true, issues: [issue(3210)] })

    expect(record).toEqual({ ok: true, issues: [issue(3210)] })
  })

  it('should carry an empty issues array on an empty queue', () => {
    expect(listRecord({ ok: true, issues: [] })).toEqual({
      ok: true,
      issues: [],
    })
  })

  it('should carry ok false, the reason, and a message on a refused read', () => {
    const record = listRecord({
      ok: false,
      reason: 'command-failed',
      detail: 'HTTP 401',
    })

    expect(record).toMatchObject({ ok: false, reason: 'command-failed' })
    expect(record.ok === false && record.message).toContain('HTTP 401')
  })

  it('should keep the gh detail out of the record as its own field', () => {
    const record = listRecord({ ok: false, reason: 'missing-binary' })

    expect(Object.keys(record).sort()).toEqual(['message', 'ok', 'reason'])
  })
})

describe('listFlagProblem', () => {
  it('should refuse --list beside --on', () => {
    expect(listFlagProblem({ list: true, on: '2801' })).toContain('--on')
  })

  it('should refuse --json without --list', () => {
    expect(listFlagProblem({ json: true })).toContain('--list')
  })

  it('should accept --list with --json', () => {
    expect(listFlagProblem({ list: true, json: true })).toBeUndefined()
  })

  it('should accept a filing run with neither flag', () => {
    expect(listFlagProblem({ on: '2801' })).toBeUndefined()
  })
})
