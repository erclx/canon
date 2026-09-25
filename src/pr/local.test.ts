import { describe, expect, it } from 'vitest'
import {
  findLocalServer,
  type Listener,
  type LocalRunner,
  parseLsofListeners,
  parseProcNetTcp,
  stripLocalLine,
} from '@/pr/local'

const MAIN = '/repo'
const LINKED = '/repo/.claude/worktrees/feat-a'
const SIBLING = '/repo/.claude/worktrees/feat-b'
const MARKER = '<!-- pr-evidence: head=abc -->'
const NOTE = '_Local preview removed when the pull request closed._'

interface FakeServer {
  readonly port: number
  readonly pid: number
  readonly cwd: string
  readonly answers?: boolean
}

function fakeRunner(
  servers: readonly FakeServer[] | undefined,
): LocalRunner & { readonly probed: number[] } {
  const probed: number[] = []
  return {
    probed,
    async listListeners() {
      if (servers === undefined) return undefined
      return servers.map(({ port, pid }): Listener => ({ port, pid }))
    },
    async cwdOf(pid) {
      return servers?.find((server) => server.pid === pid)?.cwd
    },
    async probe(port) {
      probed.push(port)
      return servers?.find((server) => server.port === port)?.answers ?? true
    },
  }
}

describe('findLocalServer', () => {
  it('should return the address of a listener running inside this worktree', async () => {
    const runner = fakeRunner([{ port: 5173, pid: 10, cwd: LINKED }])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toEqual({
      kind: 'found',
      port: 5173,
      url: 'http://localhost:5173',
    })
  })

  it('should keep a listener whose process changed into a subfolder of the worktree', async () => {
    const runner = fakeRunner([{ port: 4321, pid: 10, cwd: `${LINKED}/web` }])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toMatchObject({ kind: 'found', port: 4321 })
  })

  it('should exclude a listener running in a sibling worktree', async () => {
    const runner = fakeRunner([{ port: 5174, pid: 11, cwd: SIBLING }])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toEqual({ kind: 'refused', reason: 'no-server' })
  })

  it("should exclude the main checkout's listener when read from a linked worktree", async () => {
    const runner = fakeRunner([{ port: 5173, pid: 12, cwd: MAIN }])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toEqual({ kind: 'refused', reason: 'no-server' })
  })

  it("should exclude a linked worktree's listener when read from the main checkout", async () => {
    const runner = fakeRunner([{ port: 5174, pid: 11, cwd: LINKED }])

    const result = await findLocalServer(MAIN, runner)

    expect(result).toEqual({ kind: 'refused', reason: 'no-server' })
  })

  it('should exclude a directory that only shares the worktree path as a prefix', async () => {
    const runner = fakeRunner([{ port: 5174, pid: 11, cwd: `${LINKED}-old` }])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toEqual({ kind: 'refused', reason: 'no-server' })
  })

  it('should skip a listener that does not answer the probe', async () => {
    const runner = fakeRunner([
      { port: 3000, pid: 10, cwd: LINKED, answers: false },
      { port: 5173, pid: 13, cwd: LINKED },
    ])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toMatchObject({ kind: 'found', port: 5173 })
  })

  it('should refuse as no-server when the only listener does not answer', async () => {
    const runner = fakeRunner([
      { port: 3000, pid: 10, cwd: LINKED, answers: false },
    ])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toEqual({ kind: 'refused', reason: 'no-server' })
  })

  it('should return the lowest answering port when two listeners answer', async () => {
    const runner = fakeRunner([
      { port: 24678, pid: 10, cwd: LINKED },
      { port: 5173, pid: 10, cwd: LINKED },
    ])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toMatchObject({ kind: 'found', port: 5173 })
  })

  it('should probe a port listed twice only once', async () => {
    const runner = fakeRunner([
      { port: 5173, pid: 10, cwd: LINKED, answers: false },
      { port: 5173, pid: 10, cwd: LINKED, answers: false },
    ])

    await findLocalServer(LINKED, runner)

    expect(runner.probed).toEqual([5173])
  })

  it('should refuse as no-listener-reader when no reader is available', async () => {
    const runner = fakeRunner(undefined)

    const result = await findLocalServer(LINKED, runner)

    expect(result).toEqual({ kind: 'refused', reason: 'no-listener-reader' })
  })
})

describe('parseLsofListeners', () => {
  it('should read each listening port with the pid that owns it', () => {
    const text = [
      'p100',
      'f20',
      'n*:5173',
      'p200',
      'f7',
      'n127.0.0.1:4321',
      'f8',
      'n[::1]:4321',
    ].join('\n')

    const listeners = parseLsofListeners(text)

    expect(listeners).toEqual([
      { pid: 100, port: 5173 },
      { pid: 200, port: 4321 },
      { pid: 200, port: 4321 },
    ])
  })
})

describe('parseProcNetTcp', () => {
  it('should read the inode of each listening socket and skip other states', () => {
    const text = [
      '  sl  local_address rem_address   st tx_queue rx_queue uid timeout inode',
      '   0: 0100007F:1435 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 55501 1 0000000000000000 100 0 0 10 0',
      '   1: 0100007F:1F90 0100007F:D2A0 01 00000000:00000000 00:00000000 00000000  1000        0 55502 1 0000000000000000 20 4 30 10 -1',
    ].join('\n')

    const sockets = parseProcNetTcp(text)

    expect(sockets).toEqual([{ port: 5173, inode: '55501' }])
  })
})

describe('stripLocalLine', () => {
  it('should replace the local line with the note and keep every other line byte for byte', () => {
    const body = [
      '**Preview:** https://feat-x.site.pages.dev',
      '**Local preview:** http://localhost:5173',
      '',
      '## What to look at',
      '',
      '<!-- pr-checklist:start -->',
      '- [x] the hero settles',
      '<!-- pr-checklist:end -->',
      '',
      MARKER,
    ].join('\n')

    const stripped = stripLocalLine(body, NOTE)

    expect(stripped).toBe(
      body.replace('**Local preview:** http://localhost:5173', NOTE),
    )
  })

  it('should return undefined when the body carries no local line', () => {
    const body = ['## Evidence', '', MARKER].join('\n')

    const stripped = stripLocalLine(body, NOTE)

    expect(stripped).toBeUndefined()
  })

  it('should return undefined on a body it already stripped', () => {
    const body = ['**Local preview:** http://localhost:5173', '', MARKER].join(
      '\n',
    )
    const once = stripLocalLine(body, NOTE) ?? ''

    const twice = stripLocalLine(once, NOTE)

    expect(twice).toBeUndefined()
  })
})
