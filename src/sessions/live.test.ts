import { spawn } from 'node:child_process'
import { lstatSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { liveness, type LivenessProbes, SYSTEM_PROBES } from '@/sessions/live'
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

describe('system listens probe', () => {
  let dir: string
  let server: Server | null

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'canon-listens-'))
    server = null
  })

  afterEach(async () => {
    await new Promise((done) => (server ? server.close(done) : done(null)))
    rmSync(dir, { recursive: true, force: true })
  })

  function listen(path: string, onConnection?: () => void): Promise<void> {
    server = createServer(onConnection)
    return new Promise((done) => server?.listen(path, done))
  }

  function probe(path: string): Promise<boolean> {
    const listens = SYSTEM_PROBES.listens
    if (listens === undefined) throw new Error('system probes carry no listens')
    return listens(path, 250)
  }

  it('should accept a socket with a live listener', async () => {
    const path = join(dir, 'live.sock')
    await listen(path)

    expect(await probe(path)).toBe(true)
  })

  it('should refuse a socket inode left behind by a killed listener', async () => {
    const path = join(dir, 'stale.sock')
    const child = spawn(
      process.execPath,
      [
        '-e',
        `require('node:net').createServer().listen(${JSON.stringify(path)}, () => console.log('ready'))`,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    await new Promise((ready) => child.stdout.once('data', ready))
    const exited = new Promise((done) => child.once('exit', done))
    child.kill('SIGKILL')
    await exited

    expect(lstatSync(path).isSocket()).toBe(true)
    expect(await probe(path)).toBe(false)
  })

  it('should refuse a path that does not exist', async () => {
    expect(await probe(join(dir, 'missing.sock'))).toBe(false)
  })

  it('should resolve for a listener that accepts and never closes', async () => {
    const path = join(dir, 'silent.sock')
    await listen(path)

    expect(await probe(path)).toBe(true)
  })

  it('should not write to the socket it probes', async () => {
    const path = join(dir, 'quiet.sock')
    const received: unknown[] = []
    await listen(path, () => undefined)
    server?.on('connection', (socket) =>
      socket.on('data', (c) => received.push(c)),
    )

    await probe(path)
    await new Promise((done) => setTimeout(done, 20))

    expect(received).toEqual([])
  })
})
