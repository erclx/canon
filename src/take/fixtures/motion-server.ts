import { readFileSync } from 'node:fs'

/**
 * Serves a take fixture with canon's token sheet and Geist read from where they
 * live rather than copied beside it, so the fixture follows a token or font
 * change. Each report the page posts reaches `onReport`.
 */

/** What `motion.html` posted, stamped with the animation frame it paints in. */
export interface MotionReport {
  readonly seq: number
  readonly frame: number
  readonly type: string
  readonly [field: string]: unknown
}

export interface MotionServer {
  readonly url: string
  stop(): void
}

const PAGE = new URL('./motion.html', import.meta.url)
const TOKENS = new URL('../../../web/src/styles/tokens.css', import.meta.url)
const FONTS = new URL('../../../assets/film/fonts/', import.meta.url)

/** The plan the fixture is filmed with. */
export const MOTION_PLAN = new URL('./motion.json', import.meta.url)

export function serveMotion(
  onReport: (report: MotionReport) => void = () => {},
): MotionServer {
  return serveFixture(PAGE, onReport)
}

/** Serves `page` at every path but the report, the token sheet, and the fonts. */
export function serveFixture(
  page: URL,
  onReport: (report: MotionReport) => void = () => {},
): MotionServer {
  const served = Bun.serve({
    port: 0,
    fetch: async (request) => {
      const path = new URL(request.url).pathname
      if (path === '/report') {
        onReport((await request.json()) as MotionReport)
        return new Response('ok')
      }
      if (path === '/tokens.css') {
        return new Response(readFileSync(TOKENS), {
          headers: { 'content-type': 'text/css' },
        })
      }
      const font = /^\/fonts\/(Geist-[A-Za-z]+\.woff2)$/.exec(path)?.[1]
      if (font) {
        return new Response(readFileSync(new URL(font, FONTS)), {
          headers: { 'content-type': 'font/woff2' },
        })
      }
      return new Response(readFileSync(page), {
        headers: { 'content-type': 'text/html' },
      })
    },
  })
  return {
    url: `http://127.0.0.1:${served.port}/`,
    stop: () => served.stop(true),
  }
}
