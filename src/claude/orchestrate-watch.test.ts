import { describe, expect, it } from 'vitest'

import {
  initialState,
  pass,
  type Read,
  type Worker,
  type WatchState,
} from '../../claude/skills/role-orchestrator/scripts/watch'

const buildWorker = (overrides: Partial<Worker> = {}): Worker => ({
  branch: 'feat/thing',
  dwellMs: 1000,
  name: 'worker-one',
  status: 'busy',
  ...overrides,
})

const ok = <T>(value: T): Read<T> => ({ isOk: true, value })
const failed: Read<never> = { isOk: false }

// Seeds the baseline the way a first pass does, so a case starts from a watch
// that already knows its workers.
const seed = (workers: Worker[], pulls: string[] = []): WatchState =>
  pass(initialState(), ok(pulls), ok(workers)).state

describe('pass', () => {
  it('should print nothing for a worker whose only change is its dwell', () => {
    const state = seed([buildWorker({ dwellMs: 1000 })])

    const next = pass(state, ok([]), ok([buildWorker({ dwellMs: 4000 })]))

    expect(next.lines).toEqual([])
  })

  it('should print a worker whose status changed', () => {
    const state = seed([buildWorker({ status: 'busy' })])

    const next = pass(state, ok([]), ok([buildWorker({ status: 'idle' })]))

    expect(next.lines).toEqual(['WORKER worker-one\tfeat/thing\tidle\t1000'])
  })

  it('should print a worker that leaves the roster', () => {
    const state = seed([buildWorker()])

    const next = pass(state, ok([]), ok([]))

    expect(next.lines).toEqual(['WORKER-GONE worker-one'])
  })

  it('should print nothing on the first pass', () => {
    const next = pass(
      initialState(),
      ok(['PR-OPEN #1 feat/a title']),
      ok([buildWorker()]),
    )

    expect(next.lines).toEqual([])
  })

  it('should print a pull request that opens after the first pass', () => {
    const state = seed([], ['PR-OPEN #1 feat/a title'])

    const next = pass(
      state,
      ok(['PR-OPEN #1 feat/a title', 'PR-OPEN #2 feat/b other']),
      ok([]),
    )

    expect(next.lines).toEqual(['PR-OPEN #2 feat/b other'])
  })

  it('should keep the baseline of a read that failed', () => {
    const state = seed([buildWorker()], ['PR-OPEN #1 feat/a title'])

    const broken = pass(state, failed, failed)
    const recovered = pass(
      broken.state,
      ok(['PR-OPEN #1 feat/a title']),
      ok([buildWorker()]),
    )

    expect(broken.lines).toEqual([
      'watch: the open pull request list failed to load, so none is classified this pass',
      'watch: the session roster failed to load, so no worker is classified this pass',
    ])
    expect(recovered.lines).toEqual([])
  })

  it('should not report a recovered source as wholly new when the other one was seen first', () => {
    const first = pass(initialState(), failed, ok([buildWorker()]))

    const second = pass(
      first.state,
      ok(['PR-OPEN #1 feat/a title']),
      ok([buildWorker()]),
    )

    expect(second.lines).toEqual([])
  })

  describe('stall', () => {
    const waiting = (dwellMs: number): Worker =>
      buildWorker({
        dwellMs,
        name: 'Update session markdown and check runnable commands (3)',
        status: 'waiting',
      })

    it('should print a stall once per stall with the name intact', () => {
      const state = seed([waiting(10_000)])

      const first = pass(state, ok([]), ok([waiting(301_000)]))
      const second = pass(first.state, ok([]), ok([waiting(361_000)]))

      expect(first.lines).toEqual([
        'WORKER-STOPPED Update session markdown and check runnable commands (3) feat/thing 301s',
      ])
      expect(second.lines).toEqual([])
    })

    it('should print a second stall after the worker stops waiting between them', () => {
      const state = seed([waiting(10_000)])
      const stalled = pass(state, ok([]), ok([waiting(301_000)]))
      const resumed = pass(
        stalled.state,
        ok([]),
        ok([buildWorker({ name: waiting(0).name, status: 'busy' })]),
      )

      const again = pass(resumed.state, ok([]), ok([waiting(305_000)]))

      expect(
        again.lines.filter((line) => line.startsWith('WORKER-STOPPED')),
      ).toEqual([
        'WORKER-STOPPED Update session markdown and check runnable commands (3) feat/thing 305s',
      ])
    })

    it('should print an unmeasurable row once', () => {
      const state = seed([waiting(5000)])

      const first = pass(state, ok([]), ok([waiting(-1)]))
      const second = pass(first.state, ok([]), ok([waiting(-1)]))

      expect(first.lines).toEqual([
        'WORKER-UNMEASURABLE Update session markdown and check runnable commands (3) feat/thing',
      ])
      expect(second.lines).toEqual([])
    })
  })
})
