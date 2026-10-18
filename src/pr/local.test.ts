import { describe, expect, it } from 'vitest'
import type { Listener } from '@/listeners/parse'
import { dropAddressLine, findLocalServer, type LocalRunner } from '@/pr/local'

const MAIN = '/repo'
const LINKED = '/repo/.claude/worktrees/feat-a'
const SIBLING = '/repo/.claude/worktrees/feat-b'
const MARKER = '<!-- pr-evidence: head=abc -->'

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

describe('dropAddressLine', () => {
  const CHECKLIST = [
    '## What to look at',
    '',
    '<!-- pr-checklist:start -->',
    '- [x] the hero settles',
    '<!-- pr-checklist:end -->',
    '',
    MARKER,
  ]

  it('should drop the address line carrying both addresses and keep every other line byte for byte', () => {
    const body = [
      '## Evidence',
      '',
      '**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173',
      '',
      ...CHECKLIST,
    ].join('\n')

    const dropped = dropAddressLine(body)

    expect(dropped).toBe(['## Evidence', '', ...CHECKLIST].join('\n'))
  })

  it('should leave no doubled gap under the heading when the local address stood alone', () => {
    const body = [
      '## Evidence',
      '',
      '**Local preview:** http://localhost:5173',
      '',
      '**Base:** [`aaaa000`](https://github.com/o/r/commit/aaaa000) · **Head:** [`bbbb111`](https://github.com/o/r/commit/bbbb111)',
      '',
      MARKER,
    ].join('\n')

    const dropped = dropAddressLine(body)

    expect(dropped).toBe(
      [
        '## Evidence',
        '',
        '**Base:** [`aaaa000`](https://github.com/o/r/commit/aaaa000) · **Head:** [`bbbb111`](https://github.com/o/r/commit/bbbb111)',
        '',
        MARKER,
      ].join('\n'),
    )
  })

  it('should drop both address lines of an old-layout body and its blank line', () => {
    const body = [
      '**Preview:** https://feat-x.site.pages.dev',
      '**Local preview:** http://localhost:5173',
      '',
      ...CHECKLIST,
    ].join('\n')

    const dropped = dropAddressLine(body)

    expect(dropped).toBe(CHECKLIST.join('\n'))
  })

  it('should return undefined when the body carries no address', () => {
    const body = ['## Evidence', '', MARKER].join('\n')

    const dropped = dropAddressLine(body)

    expect(dropped).toBeUndefined()
  })

  it('should return undefined on a body it already dropped', () => {
    const body = [
      '## Evidence',
      '',
      '**Local preview:** http://localhost:5173',
      '',
      MARKER,
    ].join('\n')
    const once = dropAddressLine(body) ?? ''

    const twice = dropAddressLine(once)

    expect(twice).toBeUndefined()
  })
})
