import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { captureSources } from '@/capture/render'

/**
 * Drives `captureSources` through the real engine for the two verdicts the font
 * probe gives without consulting an installed font: a generic keyword is
 * refused, and an element holding no text is never probed.
 *
 * The suite needs a browser binary and skips without one, so a green pipeline
 * is not evidence this passed.
 */

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

function pageWith(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`
}

describe.skipIf(!hasBrowser)('captureSources font probe', () => {
  let dir: string

  function writeSource(name: string, body: string): string {
    const path = join(dir, `${name}.html`)
    writeFileSync(path, pageWith(body))
    return path
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'capture-render-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should refuse an element whose first family is a generic keyword', async () => {
    const source = writeSource(
      'generic',
      '<div id="box" style="font-family: monospace">text</div>',
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('monospace is a generic family'),
    })
  }, 60_000)

  it('should refuse a generic keyword however it is cased', async () => {
    const source = writeSource(
      'cased',
      '<div id="box" style="font-family: SANS-SERIF">text</div>',
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('sans-serif is a generic family'),
    })
  }, 60_000)

  it('should capture an element holding no text without probing a font', async () => {
    const source = writeSource(
      'empty',
      '<div id="box" style="width: 40px; height: 40px; font-family: system-ui"><div style="width: 10px; height: 10px; background: red"></div></div>',
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({ status: 'rendered' })
    expect(existsSync(join(dir, 'empty.png'))).toBe(true)
  }, 60_000)
})
