import { describe, expect, it } from 'vitest'
import type { Listener } from '@/listeners/parse'
import {
  dropAddressLine,
  findLocalServer,
  type LocalRunner,
  maskLocalAddress,
} from '@/pr/local'

const MAIN = '/repo'
const LINKED = '/repo/.claude/worktrees/feat-a'
const SIBLING = '/repo/.claude/worktrees/feat-b'
const MARKER = '<!-- pr-evidence: head=abc -->'

interface FakeServer {
  readonly port: number
  readonly pid: number
  readonly cwd: string
  readonly answers?: boolean
  /** The status each health path answers, defaulting to 200 when unnamed. */
  readonly health?: Readonly<Record<string, number | null>>
}

interface HealthCheck {
  readonly port: number
  readonly path: string
}

function fakeRunner(servers: readonly FakeServer[] | undefined): LocalRunner & {
  readonly probed: number[]
  readonly checked: HealthCheck[]
} {
  const probed: number[] = []
  const checked: HealthCheck[] = []
  return {
    probed,
    checked,
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
    async check(port, path) {
      checked.push({ port, path })
      const health = servers?.find((server) => server.port === port)?.health
      return health !== undefined && path in health ? health[path] : 200
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

  it('should call no health check when no path is declared', async () => {
    const runner = fakeRunner([{ port: 5173, pid: 10, cwd: LINKED }])

    const result = await findLocalServer(LINKED, runner)

    expect(result).toMatchObject({ kind: 'found', port: 5173 })
    expect(runner.checked).toEqual([])
  })

  it('should report the page when every declared path answers 2xx', async () => {
    const runner = fakeRunner([
      { port: 5173, pid: 10, cwd: LINKED, health: { '/ready': 204 } },
    ])

    const result = await findLocalServer(LINKED, runner, [
      '/api/health',
      '/ready',
    ])

    expect(result).toEqual({
      kind: 'found',
      port: 5173,
      url: 'http://localhost:5173',
    })
    expect(runner.checked).toEqual([
      { port: 5173, path: '/api/health' },
      { port: 5173, path: '/ready' },
    ])
  })

  it.each([
    ['a 502', 502],
    ['a 404', 404],
    ['a 3xx left after the redirect follow', 302],
    ['a timeout', null],
  ])(
    'should refuse as unhealthy when a declared path answers %s',
    async (_label, status) => {
      const runner = fakeRunner([
        {
          port: 5173,
          pid: 10,
          cwd: LINKED,
          health: { '/api/health': status },
        },
      ])

      const result = await findLocalServer(LINKED, runner, ['/api/health'])

      expect(result).toEqual({
        kind: 'refused',
        reason: 'unhealthy',
        port: 5173,
        path: '/api/health',
        status,
      })
    },
  )

  it('should report a higher page port that passes past a lowest one that fails', async () => {
    const runner = fakeRunner([
      { port: 5173, pid: 10, cwd: LINKED, health: { '/api/health': 502 } },
      { port: 5174, pid: 11, cwd: LINKED },
    ])

    const result = await findLocalServer(LINKED, runner, ['/api/health'])

    expect(result).toMatchObject({ kind: 'found', port: 5174 })
  })

  it("should name the lowest page port's first failing path when every page fails", async () => {
    const runner = fakeRunner([
      { port: 5174, pid: 11, cwd: LINKED, health: { '/ready': 500 } },
      { port: 5173, pid: 10, cwd: LINKED, health: { '/ready': 502 } },
    ])

    const result = await findLocalServer(LINKED, runner, [
      '/api/health',
      '/ready',
    ])

    expect(result).toEqual({
      kind: 'refused',
      reason: 'unhealthy',
      port: 5173,
      path: '/ready',
      status: 502,
    })
  })

  it('should check no health path on a port that serves no page', async () => {
    const runner = fakeRunner([
      { port: 3000, pid: 10, cwd: LINKED, answers: false },
    ])

    const result = await findLocalServer(LINKED, runner, ['/api/health'])

    expect(result).toEqual({ kind: 'refused', reason: 'no-server' })
    expect(runner.checked).toEqual([])
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

describe('maskLocalAddress', () => {
  const UI_MARKER = '<!-- review-ui: head=38db88d -->'

  function uiBody(addressLine: string): string {
    return [
      '## UI review closed',
      '',
      '0 failed · 0 need your eyes · 3 passed · 0 not driven',
      addressLine,
      '',
      UI_MARKER,
    ].join('\n')
  }

  it.each([
    ['localhost', 'http://localhost:5173'],
    ['127.0.0.1', 'http://127.0.0.1:4211'],
    ['0.0.0.0', 'http://0.0.0.0:3000'],
    ['[::1]', 'http://[::1]:8080'],
    ['a host with no port', 'http://localhost'],
  ])('should mask a %s address on the Driven at line', (_, address) => {
    const body = uiBody(
      `Driven at \`38db88d\` on ${address}, rendered by agent-browser.`,
    )

    const masked = maskLocalAddress(body)

    expect(masked).toBe(
      uiBody(
        'Driven at `38db88d` on a local preview, rendered by agent-browser.',
      ),
    )
  })

  it('should mask an address wrapped in backticks without leaving them behind', () => {
    const body = uiBody(
      'Driven at `38db88d` on `http://127.0.0.1:4211/`, unverified, rendered by agent-browser.',
    )

    const masked = maskLocalAddress(body)

    expect(masked).toBe(
      uiBody(
        'Driven at `38db88d` on a local preview, unverified, rendered by agent-browser.',
      ),
    )
  })

  it('should keep a hosted address', () => {
    const body = uiBody(
      'Driven at `38db88d` on https://feat-x.site.pages.dev, rendered by agent-browser.',
    )

    const masked = maskLocalAddress(body)

    expect(masked).toBeUndefined()
  })

  it('should leave a loopback URL quoted in a box reason', () => {
    const body = [
      '## UI review',
      '',
      '1 failed · 0 need your eyes · 0 passed · 0 not driven',
      'Driven at `38db88d` on http://localhost:5173, rendered by agent-browser.',
      '',
      '**1. The link opens the docs**',
      'The link reads `http://localhost:5173/docs` rather than the hosted docs.',
      '',
      UI_MARKER,
    ].join('\n')

    const masked = maskLocalAddress(body)

    expect(masked).toContain(
      'The link reads `http://localhost:5173/docs` rather than the hosted docs.',
    )
  })

  it('should return undefined on a body it already masked', () => {
    const body = uiBody(
      'Driven at `38db88d` on http://localhost:5173, rendered by agent-browser.',
    )
    const once = maskLocalAddress(body) ?? ''

    const twice = maskLocalAddress(once)

    expect(twice).toBeUndefined()
  })
})
