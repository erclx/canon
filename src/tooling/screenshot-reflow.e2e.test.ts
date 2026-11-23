import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Runs the capture script at the 320 reflow floor against pages that scroll sideways, clip a control,
 * or fit, since only a real engine answers layout. It skips without a browser, so green is not evidence.
 */

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/web/configs/e2e/screenshot.ts',
)
const TIMEOUT_MS = 90_000

const PAGES: Record<string, string> = {
  '/wide': '<body style="margin:0"><div style="width:400px">wide</div></body>',
  '/clipped':
    '<body style="margin:0"><button style="width:60px;overflow:hidden;white-space:nowrap">A label far too long for its box</button></body>',
  '/fits': '<body style="margin:0"><p>Fits at any width.</p></body>',
  '/past-edge':
    '<body style="margin:0"><div style="overflow:hidden"><button style="margin-left:280px;width:100px">Past</button></div></body>',
  '/skip-link':
    '<body style="margin:0"><a href="#main" style="position:absolute;left:-9999px">Skip to content</a><p id="main">Fits.</p></body>',
}

/** Each case at the floor and at 390 alone, so a run writes one frame per case beside its check. */
const CASES_SOURCE = `const floorAnd390 = ['768', '1280', '1536']
export const EVIDENCE_ROOT = 'evidence'
export const CASES = [
  { section: 'wide', theme: 'light', route: '/wide', excludeViewports: floorAnd390 },
  { section: 'clipped', theme: 'light', route: '/clipped', excludeViewports: floorAnd390 },
  { section: 'fits', theme: 'light', route: '/fits', excludeViewports: floorAnd390 },
  { section: 'past-edge', theme: 'light', route: '/past-edge', excludeViewports: floorAnd390 },
  { section: 'skip-link', theme: 'light', route: '/skip-link', excludeViewports: floorAnd390 },
]
`

async function browserAvailable(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright-core')
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()

let fixture: string
let server: Server
let run: { code: number | null; output: string }

function runCapture(
  baseUrl: string,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [SCRIPT], {
      cwd: fixture,
      env: { ...process.env, SCREENSHOT_BASE_URL: baseUrl },
    })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, output }))
  })
}

const frame = (section: string, width: string): string =>
  join(fixture, 'screenshots', '127.0.0.1', section, `${width}--light.png`)

describe.skipIf(!hasBrowser)('screenshot.ts reflow floor', () => {
  beforeAll(async () => {
    fixture = mkdtempSync(join(tmpdir(), 'screenshot-reflow-'))
    mkdirSync(join(fixture, 'e2e', 'capture'), { recursive: true })
    writeFileSync(join(fixture, 'e2e', 'capture', 'cases.ts'), CASES_SOURCE)
    server = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(PAGES[request.url ?? ''] ?? '')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    run = await runCapture(`http://127.0.0.1:${port}`)
  }, TIMEOUT_MS)

  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve))
    rmSync(fixture, { force: true, recursive: true })
  })

  it('should exit 1 when a page fails the floor', () => {
    expect(run.code).toBe(1)
  })

  it('should name the page that scrolls sideways at 320', () => {
    expect(run.output).toMatch(/wide\/320--light: .*sideways/)
  })

  it('should name the control whose label its box clips at 320', () => {
    expect(run.output).toMatch(/clipped\/320--light: .*button/)
  })

  it('should report nothing for a page that fits at 320', () => {
    expect(run.output).not.toContain('fits/320--light:')
  })

  it('should name a control running past the edge of a clipping parent at 320', () => {
    expect(run.output).toMatch(/past-edge\/320--light: button .*past the edge/)
  })

  it('should report nothing for a skip link held wholly off the page', () => {
    expect(run.output).not.toContain('skip-link/320--light:')
  })

  it('should write no frame at the floor', () => {
    expect(existsSync(frame('wide', '320'))).toBe(false)
  })

  it('should still write the frame at 390 for a page failing the floor', () => {
    expect(existsSync(frame('wide', '390'))).toBe(true)
  })
})
