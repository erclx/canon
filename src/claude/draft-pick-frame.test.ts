import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const TEMPLATE = join(
  REPO_ROOT,
  'claude',
  'skills',
  'draft-and-pick',
  'references',
  'frame.html',
)
const PLACEHOLDER = '__FRAME_DATA__'
const TEST_TIMEOUT_MS = 30_000

/**
 * The frame test drives a real headless chromium, and `verify.yml` installs no
 * browser, so it skips there rather than failing, the way
 * `src/commands/capture.test.ts` does.
 */
async function browserAvailable(): Promise<boolean> {
  const { chromium } = await import('playwright-core')
  try {
    const browser = await chromium.launch()
    await browser.close()
    return true
  } catch {
    return false
  }
}

const hasBrowser = await browserAvailable()

function writeArm(path: string, label: string): void {
  writeFileSync(
    path,
    `<!doctype html><html><body><p>${label}</p></body></html>`,
  )
}

function buildRun(): { readonly root: string; readonly frame: string } {
  const root = mkdtempSync(join(tmpdir(), 'canon-frame-'))
  const rounds = ['run', 'run-2'].map((name) => {
    mkdirSync(join(root, name, 'arms'), { recursive: true })
    writeArm(join(root, name, 'candidates.html'), `${name} combined`)
    writeArm(join(root, name, 'arms', 'arm-1.html'), `${name} arm 1`)
    return {
      label: name,
      pages: [
        { label: 'combined', src: `../${name}/candidates.html` },
        { label: 'arm 1', src: `../${name}/arms/arm-1.html` },
      ],
    }
  })
  const data = { themeKey: 'theme', rounds }
  const frame = readFileSync(TEMPLATE, 'utf8').replace(
    PLACEHOLDER,
    JSON.stringify(data),
  )
  writeFileSync(join(root, 'run-2', 'frame.html'), frame)
  return { root, frame: 'run-2/frame.html' }
}

function serve(root: string) {
  const server = createServer((request, response) => {
    const path = join(
      root,
      decodeURIComponent((request.url ?? '/').split('?')[0]),
    )
    try {
      const body = readFileSync(path)
      response.setHeader(
        'content-type',
        extname(path) === '.html' ? 'text/html' : 'text/plain',
      )
      response.end(body)
    } catch {
      response.statusCode = 404
      response.end()
    }
  })
  return new Promise<{ readonly url: string; readonly close: () => void }>(
    (resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo
        resolve({
          url: `http://127.0.0.1:${port}`,
          close: () => server.close(),
        })
      })
    },
  )
}

describe('draft-and-pick frame template', () => {
  it('should carry exactly one arm-list placeholder', () => {
    const template = readFileSync(TEMPLATE, 'utf8')

    expect(template.split(PLACEHOLDER)).toHaveLength(2)
  })

  it.skipIf(!hasBrowser)(
    'should list every round in the picker and load the page it selects',
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      const { chromium } = await import('playwright-core')
      const { root, frame } = buildRun()
      const server = await serve(root)
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.goto(`${server.url}/${frame}`)

        const options = await page.locator('#picker option').allTextContents()
        await page.selectOption('#picker', { index: 3 })
        const inner = page.frameLocator('iframe')

        expect(options).toHaveLength(4)
        expect(options.join('|')).toContain('run ·')
        expect(options.join('|')).toContain('run-2 ·')
        await expect
          .poll(() => inner.locator('p').textContent())
          .toBe('run-2 arm 1')
      } finally {
        await browser.close()
        server.close()
      }
    },
  )

  it.skipIf(!hasBrowser)(
    'should set the theme on the attribute and on the arm stored key',
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      const { chromium } = await import('playwright-core')
      const { root, frame } = buildRun()
      const server = await serve(root)
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.goto(`${server.url}/${frame}`)
        await page.click('#theme')

        const inner = await page.evaluate(() => {
          const win = (document.querySelector('iframe') as HTMLIFrameElement)
            .contentWindow!
          return {
            attribute: win.document.documentElement.getAttribute('data-theme'),
            stored: win.localStorage.getItem('theme'),
          }
        })

        expect(inner.attribute).not.toBeNull()
        expect(inner.stored).toBe(inner.attribute)
      } finally {
        await browser.close()
        server.close()
      }
    },
  )
})
