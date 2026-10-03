import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type ExportResult, exportHtmlDeck } from '@/slides/convert/export'

/**
 * Exports a two-slide fixture deck through a real Chromium and reads the XML
 * the package holds, since every rule the converter carries is a claim about
 * what lands in that XML.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed. Run
 * it locally.
 */

const PHOTO = resolve('examples/slides/evidence/showcase-light-04.png')

const STYLE = `
  body { margin: 0; width: 1280px; height: 720px; background: #FBFAF8; color: #2C2C29; font: 24px/32px system-ui, sans-serif; }
  h1 { position: absolute; left: 96px; top: 64px; margin: 0; font-size: 56px; line-height: 64px; letter-spacing: 1px; }
`

const SLIDES: Record<string, string> = {
  '01-overview.html': `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}
    .note { position: absolute; left: 96px; top: 176px; width: 420px; margin: 0; padding: 24px 28px; border: 1px solid #D6D3CE; border-radius: 12px; background: #F4F1EC; }
    .thumb { position: absolute; left: 1140px; top: 48px; width: 96px; height: 54px; }
    .photo { position: absolute; left: 640px; top: 176px; width: 480px; height: 270px; border: 1px solid #D6D3CE; border-radius: 12px; object-fit: cover; }
    body > ul { position: absolute; left: 96px; top: 400px; margin: 0; }
  </style></head><body>
    <h1>Quarterly review</h1>
    <p class="note">Revenue grew <strong>eighteen percent</strong> on the year.</p>
    <img class="thumb" src="photo.png" alt="Thumbnail">
    <img class="photo" src="photo.png" alt="The team at the launch event">
    <ul>
      <li>Level one
        <ul>
          <li>Level two
            <ul><li>Level three</li></ul>
          </li>
        </ul>
      </li>
    </ul>
  </body></html>`,
  '02-detail.html': `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}
    table { position: absolute; left: 96px; top: 176px; border-collapse: collapse; font-size: 18px; }
    td, th { border: 1px solid #D6D3CE; padding: 8px 12px; }
    .links { position: absolute; left: 96px; top: 420px; margin: 0; }
    .card { position: absolute; left: 720px; top: 176px; width: 320px; height: 120px; padding: 16px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2); }
    .mark { position: absolute; left: 720px; top: 360px; color: #B45309; }
    .gradient { position: absolute; left: 960px; top: 360px; width: 200px; height: 120px; background-image: linear-gradient(90deg, #B45309, #0F766E); color: #FFFFFF; }
  </style></head><body>
    <h1>Detail</h1>
    <table>
      <tr><th>Region</th><th>Q1</th><th>Q2</th></tr>
      <tr><td rowspan="2">North</td><td>Merged quarter</td><td>12</td></tr>
      <tr><td>14</td><td>16</td></tr>
    </table>
    <p class="links"><a href="https://example.com/report">Full report</a> and <a href="#slide-1">back to overview</a></p>
    <div class="card"><p style="margin:0">Shadowed card</p></div>
    <div class="mark"><svg width="96" height="96" viewBox="0 0 10 10" aria-label="Brand mark"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg></div>
    <div class="gradient">Gradient box</div>
  </body></html>`,
}

const NATIVE_TEXT = [
  'Quarterly review',
  'Revenue grew ',
  'eighteen percent',
  'Level one',
  'Level two',
  'Level three',
  'Detail',
  'Region',
  'Merged quarter',
  'Full report',
  'back to overview',
  'Shadowed card',
]

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
const hasOffice = spawnSync('soffice', ['--version']).status === 0

function writeFixture(root: string): string {
  const source = join(root, 'deck')
  mkdirSync(source)
  for (const [name, html] of Object.entries(SLIDES)) {
    writeFileSync(join(source, name), html)
  }
  copyFileSync(PHOTO, join(source, 'photo.png'))
  writeFileSync(join(source, 'notes.txt'), 'not a slide')
  return source
}

describe.skipIf(!hasBrowser)('exportHtmlDeck', () => {
  let root: string
  let result: ExportResult
  let zip: JSZip
  let slideXml: string[]
  let slideRels: string[]

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'canon-slides-e2e-'))
    const source = writeFixture(root)
    result = await exportHtmlDeck(source, join(root, 'out'), { root })
    if (result.status !== 'written') throw new Error(result.message)
    zip = await JSZip.loadAsync(readFileSync(result.pptxPath))
    slideXml = await Promise.all(
      [1, 2].map(
        async (n) =>
          (await zip.file(`ppt/slides/slide${n}.xml`)?.async('string')) ?? '',
      ),
    )
    slideRels = await Promise.all(
      [1, 2].map(
        async (n) =>
          (await zip
            .file(`ppt/slides/_rels/slide${n}.xml.rels`)
            ?.async('string')) ?? '',
      ),
    )
  }, 60_000)

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const allXml = (): string => slideXml.join('\n')
  const picture = (index: number, alt: string): string => {
    const xml = slideXml[index] ?? ''
    const at = xml.indexOf(`descr="${alt}"`)
    return xml.slice(
      xml.lastIndexOf('<p:pic>', at),
      xml.indexOf('</p:pic>', at),
    )
  }
  const runs = (): string[] =>
    [...allXml().matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(
      (match) => match[1] ?? '',
    )

  it('should write one slide per html file and ignore the rest', () => {
    expect(result).toMatchObject({ status: 'written', slideCount: 2 })
  })

  it('should land every fixture text run as a native text element', () => {
    expect(runs()).toEqual(expect.arrayContaining(NATIVE_TEXT))
  })

  it('should land the table as a native table', () => {
    expect(slideXml[1]).toContain('<a:tbl>')
  })

  it('should write the merged cell as a row span', () => {
    expect(slideXml[1]).toContain('rowSpan="2"')
  })

  it('should write a URL link', () => {
    expect(slideRels[1]).toContain('https://example.com/report')
  })

  it('should write a slide link', () => {
    expect(slideXml[1]).toContain('action="ppaction://hlinksldjump"')
  })

  it('should write the card shadow as an outer shadow', () => {
    expect(slideXml[1]).toContain('<a:outerShdw')
  })

  it('should carry the image alt text on the picture', () => {
    expect(slideXml[0]).toContain('descr="The team at the launch event"')
  })

  it('should round the corners of the bordered image', () => {
    expect(picture(0, 'The team at the launch event')).toMatch(
      /<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj"/,
    )
  })

  it('should leave an image with no radius square', () => {
    expect(picture(0, 'Thumbnail')).toContain('<a:prstGeom prst="rect">')
  })

  it('should land the svg as a vector', () => {
    expect(slideXml[1]).toContain('svgBlip')
  })

  it('should give the svg a real png fallback', async () => {
    const images = Object.keys(zip.files).filter((path) =>
      /^ppt\/media\/.*\.png$/.test(path),
    )
    const heads = await Promise.all(
      images.map(async (path) =>
        (await zip.file(path)?.async('nodebuffer'))?.subarray(0, 8),
      ),
    )

    expect(
      heads.every((head) => head?.toString('hex') === '89504e470d0a1a0a'),
    ).toBe(true)
  })

  it('should resolve currentColor in the svg to the parent color', async () => {
    const svgPath = Object.keys(zip.files).find((path) => path.endsWith('.svg'))
    const svg = svgPath ? await zip.file(svgPath)?.async('string') : ''

    expect(svg).toContain('fill="rgb(180, 83, 9)"')
  })

  it('should land the gradient box as a picture', () => {
    expect(runs()).not.toContain('Gradient box')
  })

  it('should report the gradient box with background-image', () => {
    expect(result.status === 'written' && result.fallbacks).toEqual([
      expect.objectContaining({
        slide: 2,
        selector: 'div.gradient',
        properties: ['background-image'],
      }),
    ])
  })

  it.skipIf(!hasOffice)(
    'should render through LibreOffice to one image per slide',
    () => {
      if (result.status !== 'written') return
      const renders = join(root, 'renders')
      mkdirSync(renders)
      spawnSync('soffice', [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        renders,
        result.pptxPath,
      ])
      const pdf = join(renders, 'deck.pdf')
      spawnSync('pdftoppm', ['-png', '-r', '96', pdf, join(renders, 'slide')])

      const images = readdirSync(renders).filter((name) =>
        name.endsWith('.png'),
      )

      expect(images).toHaveLength(2)
    },
    60_000,
  )
})

describe('exportHtmlDeck on an empty folder', () => {
  it('should refuse and name the folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'canon-slides-empty-'))
    writeFileSync(join(root, 'readme.md'), '# not a slide')

    const result = await exportHtmlDeck(root, join(root, 'out'), { root })

    rmSync(root, { recursive: true, force: true })
    expect(result).toEqual({
      status: 'refused',
      reason: 'empty-source',
      message: `${root} holds no .html slides`,
    })
  })
})
