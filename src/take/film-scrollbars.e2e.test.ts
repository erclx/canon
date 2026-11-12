import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LOADED_STALL_MS, available, html } from '@/take/fixtures/film-suite'
import { readTakePlan } from '@/take/plan'
import { take } from '@/take/film'

const SCROLLBARS_PAGE = readFileSync(
  new URL('./fixtures/scrollbars.html', import.meta.url),
  'utf8',
)

describe.skipIf(!available())('scrollbars on both routes', () => {
  let server: { url: string; stop: () => void }
  let out: string
  let gutters: number[] = []

  /** Films one beat and returns the gutter the page reported while it loaded. */
  async function gutterOf(
    route: 'step' | 'screencast',
    scrollbars: boolean,
  ): Promise<number> {
    const read = readTakePlan(
      JSON.stringify({
        beats: [
          {
            name: 'tall',
            route,
            ...(scrollbars ? { scrollbars: true } : {}),
            steps: [{ kind: 'wait', ms: 300 }],
          },
        ],
      }),
    )
    if (read.kind !== 'read') throw new Error(read.detail)
    gutters = []
    const result = await take({
      url: server.url,
      plan: read.plan,
      out,
      stallMs: LOADED_STALL_MS,
      deviceScale: 1,
    })
    if (result.status !== 'filmed') throw new Error(result.message)
    expect(result.beats[0]?.route).toBe(route)
    return gutters[0] ?? Number.NaN
  }

  beforeAll(() => {
    const served = Bun.serve({
      port: 0,
      fetch: async (request) => {
        if (new URL(request.url).pathname === '/gutter') {
          gutters.push(Number(await request.text()))
          return new Response('ok')
        }
        return html(SCROLLBARS_PAGE)
      },
    })
    server = {
      url: `http://127.0.0.1:${served.port}/`,
      stop: () => served.stop(true),
    }
    out = mkdtempSync(join(tmpdir(), 'canon-take-scrollbars-e2e-'))
  })

  afterAll(() => {
    server.stop()
    rmSync(out, { recursive: true, force: true })
  })

  it.each(['step', 'screencast'] as const)(
    'should draw a gutter on the %s route only when the beat asks',
    async (route) => {
      const hidden = await gutterOf(route, false)
      const shown = await gutterOf(route, true)

      expect(hidden).toBe(0)
      expect(shown).toBeGreaterThan(0)
    },
    240_000,
  )
})
