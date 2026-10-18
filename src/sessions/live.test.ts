import { describe, expect, it } from 'vitest'
import { liveness, type LivenessProbes } from '@/sessions/live'
import type { SessionRecord } from '@/sessions/registry'

function record(fields: Partial<SessionRecord> = {}): SessionRecord {
  return {
    pid: 100,
    sessionId: 'id-100',
    cwd: '/repo',
    name: 'canon-aa',
    kind: 'interactive',
    status: 'idle',
    statusUpdatedAt: undefined,
    updatedAt: undefined,
    startedAt: 1,
    procStart: '5000',
    pidDomain: undefined,
    messagingSocketPath: undefined,
    ...fields,
  }
}

function probes(fields: Partial<LivenessProbes> = {}): LivenessProbes {
  return {
    procStartOf: () => null,
    responds: () => false,
    ...fields,
  }
}

describe('liveness', () => {
  it('should confirm a session whose start time matches the running process', () => {
    const state = liveness(record(), probes({ procStartOf: () => '5000' }))

    expect(state).toEqual({ alive: true, confidence: 'confirmed' })
  })

  it('should reject a pid whose start time disagrees with the record', () => {
    const state = liveness(record(), probes({ procStartOf: () => '9999' }))

    expect(state).toEqual({ alive: false, confidence: 'confirmed' })
  })

  it('should fall back to the signal probe where start times cannot be read', () => {
    const state = liveness(record(), probes({ responds: () => true }))

    expect(state).toEqual({ alive: true, confidence: 'unverified' })
  })

  it('should report a dead pid as dead on the fallback path', () => {
    const state = liveness(record(), probes({ responds: () => false }))

    expect(state).toEqual({ alive: false, confidence: 'unverified' })
  })

  it('should fall back where the record stamped no start time', () => {
    const state = liveness(
      record({ procStart: undefined }),
      probes({ procStartOf: () => '5000', responds: () => true }),
    )

    expect(state).toEqual({ alive: true, confidence: 'unverified' })
  })

  describe('from another pid namespace', () => {
    const foreign = {
      pidDomain: 'linux:abc:pid:[4026532999]',
      messagingSocketPath: '/run/user/1000/cc-socks/100.sock',
    }
    const own = { ownDomain: () => 'pid:[4026532221]' }

    it('should read a record with a present socket as live and unverified', () => {
      const state = liveness(
        record(foreign),
        probes({ ...own, socketExists: () => true }),
      )

      expect(state).toEqual({
        alive: true,
        confidence: 'unverified',
        foreign: true,
      })
    })

    it('should read a record whose socket is gone as dead', () => {
      const state = liveness(
        record(foreign),
        probes({ ...own, socketExists: () => false }),
      )

      expect(state).toEqual({
        alive: false,
        confidence: 'unverified',
        foreign: true,
      })
    })

    it('should read a record naming no socket as dead without probing', () => {
      const state = liveness(
        record({ ...foreign, messagingSocketPath: undefined }),
        probes({
          ...own,
          socketExists: () => {
            throw new Error('probed')
          },
        }),
      )

      expect(state.alive).toBe(false)
    })

    it('should not probe the pid, which names nothing here', () => {
      const state = liveness(
        record(foreign),
        probes({
          ...own,
          socketExists: () => true,
          procStartOf: () => '9999',
          responds: () => false,
        }),
      )

      expect(state.alive).toBe(true)
    })

    it('should keep the pid path for a record from the reader namespace', () => {
      const state = liveness(
        record({ ...foreign, pidDomain: 'linux:abc:pid:[4026532221]' }),
        probes({ ...own, procStartOf: () => '9999', socketExists: () => true }),
      )

      expect(state).toEqual({ alive: false, confidence: 'confirmed' })
    })

    it('should call no record foreign where the reader namespace is unreadable', () => {
      const state = liveness(
        record(foreign),
        probes({ ownDomain: () => null, responds: () => true }),
      )

      expect(state).toEqual({ alive: true, confidence: 'unverified' })
    })
  })
})
