import { describe, expect, it } from 'vitest'
import { type ChecksGate, lift } from '@/pr/lift'
import { makeApi } from '@/pr/fixtures/lift-api'

// The checks the base does not require never gate, so each case reads only how the record names them.
describe('lift over non-required checks', () => {
  describe('advisory checks', () => {
    const advisoryFailing: ChecksGate = {
      state: 'passing',
      isConflicted: false,
      advisory: ['🍎 macOS Unit Tests'],
    }

    it('should lift past a failing advisory check and name it in the record', async () => {
      const { api, calls } = makeApi({ checks: [advisoryFailing] })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'lifted',
        isOk: true,
        advisory: ['🍎 macOS Unit Tests'],
      })
      expect(calls.marks).toEqual(['PR_node'])
    })

    it('should read clear under --check and name the failing advisory check', async () => {
      const { api } = makeApi({ checks: [advisoryFailing] })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'clear',
        advisory: ['🍎 macOS Unit Tests'],
      })
    })

    // A non-required check still going never gates, so the draft still lifts, and the record names it.
    it('should lift past a non-required check still running and name it in the record', async () => {
      const { api, calls } = makeApi({
        checks: [
          {
            state: 'passing',
            isConflicted: false,
            advisory: [],
            running: ['🍎 macOS Unit Tests'],
          },
        ],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'lifted',
        isOk: true,
        running: ['🍎 macOS Unit Tests'],
      })
      expect(calls.marks).toEqual(['PR_node'])
    })

    it('should read clear under --check and name a non-required check still running', async () => {
      const { api } = makeApi({
        checks: [
          {
            state: 'passing',
            isConflicted: false,
            advisory: [],
            running: ['🍎 macOS Unit Tests'],
          },
        ],
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'clear',
        isOk: true,
        running: ['🍎 macOS Unit Tests'],
      })
    })

    it('should carry no running field when nothing outside the required set runs', async () => {
      const { api } = makeApi({
        checks: [
          { state: 'passing', isConflicted: false, advisory: [], running: [] },
        ],
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).not.toHaveProperty('running')
    })

    it('should carry no advisory field when none failed', async () => {
      const { api } = makeApi({
        checks: [{ state: 'passing', isConflicted: false, advisory: [] }],
      })

      const record = await lift(api, { isCheck: false, waitSeconds: 60 })

      expect(record).not.toHaveProperty('advisory')
    })
  })

  describe('ready pull request', () => {
    const ready = { pull: { isDraft: false } }

    it('should carry a failing advisory check on already-ready', async () => {
      const { api } = makeApi({
        ...ready,
        checks: [
          { state: 'passing', isConflicted: false, advisory: ['🍎 macOS'] },
        ],
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'already-ready',
        advisory: ['🍎 macOS'],
      })
    })

    it('should name a non-required check still running on already-ready', async () => {
      const { api } = makeApi({
        ...ready,
        checks: [
          {
            state: 'passing',
            isConflicted: false,
            advisory: [],
            running: ['🍎 macOS'],
          },
        ],
      })

      const record = await lift(api, { isCheck: true, waitSeconds: 60 })

      expect(record).toMatchObject({
        reason: 'already-ready',
        isOk: true,
        running: ['🍎 macOS'],
      })
    })
  })
})
