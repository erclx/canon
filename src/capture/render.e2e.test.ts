import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { captureSources } from '@/capture/render'

/**
 * Drives `captureSources` through the real engine for the font-probe verdicts. The
 * web-font cases load the repository's own Geist files, so no installed font is
 * needed. It skips without a browser binary, so green is not evidence it passed.
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

function fontUrl(file: string): string {
  return pathToFileURL(join(process.cwd(), 'assets/film/fonts', file)).href
}

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

  it('should capture text drawn at 800 in a family whose declared 400 face is unused', async () => {
    const source = writeSource(
      'weights',
      `<style>@font-face{font-family:ProbeFace;font-weight:400;src:url(${fontUrl('Geist-Regular.woff2')})}@font-face{font-family:ProbeFace;font-weight:800;src:url(${fontUrl('Geist-SemiBold.woff2')})}</style><div id="box" style="font-family: ProbeFace; font-weight: 800">text</div>`,
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({ status: 'rendered' })
  }, 60_000)

  it('should capture text at 700 in a family declaring only an 800 face', async () => {
    const source = writeSource(
      'nearest',
      `<style>@font-face{font-family:ProbeFace;font-weight:800;src:url(${fontUrl('Geist-SemiBold.woff2')})}</style><div id="box" style="font-family: ProbeFace; font-weight: 700">text</div>`,
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({ status: 'rendered' })
  }, 60_000)

  it('should capture italic text in a family with no italic face', async () => {
    const source = writeSource(
      'italic',
      `<style>@font-face{font-family:ProbeFace;font-weight:400;src:url(${fontUrl('Geist-Regular.woff2')})}</style><div id="box" style="font-family: ProbeFace; font-style: italic">text</div>`,
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({ status: 'rendered' })
  }, 60_000)

  it('should refuse a family whose only file is absent', async () => {
    const source = writeSource(
      'absent',
      `<style>@font-face{font-family:ProbeFace;src:url(${fontUrl('Absent.woff2')})}</style><div id="box" style="font-family: ProbeFace; font-weight: 800">text</div>`,
    )

    const [result] = await captureSources(source, { selector: '#box' })

    expect(result).toMatchObject({
      status: 'failed',
      reason: expect.stringContaining('ProbeFace is not installed'),
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

describe.skipIf(!hasBrowser)('captureSources touch', () => {
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'capture-touch-'))
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should resolve a hover media query as a touch device would', async () => {
    const source = join(dir, 'hover.html')
    writeFileSync(
      source,
      pageWith(
        '<style>#box{width:10px;height:10px;background:red}@media (hover:none){#box{width:30px}}</style><div id="box"></div>',
      ),
    )

    const [result] = await captureSources(source, {
      selector: '#box',
      touch: true,
    })

    expect(result).toMatchObject({ status: 'rendered', width: 60 })
  }, 60_000)
})
