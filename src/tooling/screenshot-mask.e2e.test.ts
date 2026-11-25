import { spawn } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Runs the web stack's capture script against a fixture page with a dialog over masked elements, since a hit test
 * only a real engine answers. The suite skips without a browser binary, so a green pipeline is not evidence.
 */

const SCRIPT = join(
  import.meta.dirname,
  '../../tooling/web/configs/e2e/screenshot.ts',
)
const PAGE = readFileSync(
  new URL('./fixtures/mask-dialog.html', import.meta.url),
  'utf8',
)
const TIMEOUT_MS = 90_000

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

/** One case at 1280 alone, the reflow floor skipped, so a run writes one whole-page frame per case. */
const CASES_SOURCE = `const only1280 = ['320', '390', '768', '1536']
export const EVIDENCE_ROOT = 'evidence'
export const CASES = [
  { section: 'open', theme: 'light', route: '/', excludeViewports: only1280, mask: ['.edited', '.below', '.badge', '.partial', '.cover-left', '.cover-top', '.cover-bottom', '.cover-corner', '.missing'] },
  { section: 'closed', theme: 'light', route: '/?closed', excludeViewports: only1280, mask: ['.edited'] },
]
`

let fixture: string
let server: Server
let output: string

function runCapture(baseUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', [SCRIPT], {
      cwd: fixture,
      env: { ...process.env, SCREENSHOT_BASE_URL: baseUrl },
    })
    let text = ''
    child.stdout.on('data', (chunk: Buffer) => (text += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (text += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(text)
      else reject(new Error(`capture exited ${code}:\n${text}`))
    })
  })
}

/** Reads whether the pixel at the center of a box is the mask's default magenta. */
function maskedAt(section: string, x: number, y: number): boolean {
  const png = PNG.sync.read(
    readFileSync(
      join(fixture, 'screenshots', '127.0.0.1', section, '1280--light.png'),
    ),
  )
  const offset = (y * png.width + x) * 4
  const [red, green, blue] = png.data.subarray(offset, offset + 3)
  return red === 255 && green === 0 && blue === 255
}

describe.skipIf(!hasBrowser)('screenshot.ts masks', () => {
  beforeAll(async () => {
    fixture = mkdtempSync(join(tmpdir(), 'screenshot-mask-'))
    mkdirSync(join(fixture, 'e2e', 'capture'), { recursive: true })
    writeFileSync(join(fixture, 'e2e', 'capture', 'cases.ts'), CASES_SOURCE)
    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(PAGE)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    output = await runCapture(`http://127.0.0.1:${port}`)
  }, TIMEOUT_MS)

  afterAll(async () => {
    await new Promise((resolve) => server?.close(resolve))
    rmSync(fixture, { force: true, recursive: true })
  })

  it('should paint no bar over the dialog panel covering a masked element', () => {
    expect(maskedAt('open', 200, 120)).toBe(false)
  })

  it('should mask an element under a translucent backdrop alone', () => {
    expect(maskedAt('open', 800, 120)).toBe(true)
  })

  it('should mask an element below the fold with nothing over it', () => {
    expect(maskedAt('open', 200, 1820)).toBe(true)
  })

  it('should mask a pointer-events none element over an opaque sibling', () => {
    expect(maskedAt('open', 1100, 120)).toBe(true)
  })

  it('should skip a mask whose end sits under a menu while its center is clear', () => {
    expect(maskedAt('open', 150, 420)).toBe(false)
    expect(output).toMatch(/open\/1280--light: .*\.partial.*covered/)
  })

  it.each([
    ['left end', '.cover-left', 500, 420],
    ['top edge', '.cover-top', 800, 420],
    ['bottom edge', '.cover-bottom', 1100, 420],
    ['top left corner', '.cover-corner', 200, 540],
  ])('should skip a mask covered only at its %s', (_label, selector, x, y) => {
    expect(maskedAt('open', x, y)).toBe(false)
    expect(output).toContain(selector)
  })

  it('should mask the element once the dialog is closed', () => {
    expect(maskedAt('closed', 200, 120)).toBe(true)
  })

  it('should log the covered mask it skipped with its case and selector', () => {
    expect(output).toMatch(/open\/1280--light: .*\.edited.*covered/)
  })

  it('should still warn and skip a mask selector that matches nothing', () => {
    expect(output).toContain('no element matches .missing')
  })
})
