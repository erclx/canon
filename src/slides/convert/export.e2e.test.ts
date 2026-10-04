import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import {
  type ExportResult,
  exportHtmlDeck,
  Sections,
} from '@/slides/convert/export'
import type { SlideMeta } from '@/slides/convert/walk'
import { testFace } from '@/slides/package/test-face'

/**
 * Exports a four-slide fixture deck through a real Chromium and reads the XML
 * the package holds, since every rule the converter carries is a claim about
 * what lands in that XML.
 *
 * The suite needs a browser binary. CI installs none, so it skips there rather
 * than failing, which means a green pipeline is not evidence this passed. Run
 * it locally.
 */

/** A 16 by 9 solid PNG, since every rule here reads the picture's box and none its pixels. */
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAFElEQVR42mPYEsxJEmIY1TAoNAAAMiWZAUrYBTAAAAAASUVORK5CYII=',
  'base64',
)

/** A palette and face apart from Canon's, so a master taking them proves the source. */
const TOKENS = `:root {
  --color-background: #F0F9FF;
  --color-surface: #E0F2FE;
  --color-text: #0C4A6E;
  --color-muted: #475569;
  --color-accent: #0F766E;
  --color-success: #7C3AED;
  --type-body-family: "Fixture Sans Variable", sans-serif;
}`

const DECK = {
  title: 'Fixture deck',
  mark: 'photo.png',
  fonts: [
    { family: 'Fixture Sans', path: 'fonts/fixture.ttf' },
    { family: 'Fixture Sans', weight: 700, path: 'fonts/locked.ttf' },
  ],
}

const STYLE = `
  body { margin: 0; width: 1280px; height: 720px; background: #FBFAF8; color: #2C2C29; font: 24px/32px var(--type-body-family, system-ui); }
  h1 { position: absolute; left: 96px; top: 64px; margin: 0; font-size: 56px; line-height: 64px; letter-spacing: 1px; }
`

const SLIDES: Record<string, string> = {
  '01-overview.html': `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}
    .note { position: absolute; left: 96px; top: 176px; width: 420px; margin: 0; padding: 24px 28px; border: 1px solid #D6D3CE; border-radius: 12px; background: #F4F1EC; }
    .thumb { position: absolute; left: 1140px; top: 48px; width: 96px; height: 54px; }
    .photo { position: absolute; left: 640px; top: 176px; width: 480px; height: 270px; border: 1px solid #D6D3CE; border-radius: 12px; object-fit: cover; }
    body > ul { position: absolute; left: 96px; top: 400px; margin: 0; }
  </style></head><body data-section="Overview">
    <h1>Quarterly review</h1>
    <aside class="notes"><p>Open with the <strong>headline</strong>.</p><p>Then pause.</p></aside>
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
    figure { position: absolute; left: 96px; top: 250px; width: 500px; height: 150px; margin: 0; background: #FEF3C7; }
  </style></head><body data-section="Detail">
    <h1>Detail</h1>
    <figure data-chart="bar" data-labels>
      <table><tr><th>Region</th><th>Q1</th><th>Q2</th></tr><tr><td>North</td><td>12</td><td>16</td></tr><tr><td>South</td><td></td><td>11</td></tr></table>
    </figure>
    <table>
      <tr><th>Region</th><th>Q1</th><th>Q2</th></tr>
      <tr><td rowspan="2">North</td><td>Merged quarter</td><td>12</td></tr>
      <tr><td>14</td><td>16</td></tr>
    </table>
    <p class="links"><a href="https://example.com/report">Full report</a> and <a href="#slide-1">back to overview</a></p>
    <div class="card"><p style="margin:0">Shadowed card</p></div>
    <div class="mark"><svg width="96" height="96" viewBox="0 0 10 10" aria-label="Brand mark"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg></div>
    <div class="gradient">Gradient box</div>
    <p class="soft" style="position: absolute; left: 96px; top: 520px; margin: 0">Plain then <span style="filter: blur(1px)">softened</span></p>
    <p class="under" style="position: absolute; left: 96px; top: 580px; margin: 0; text-decoration: underline">Under <strong>lined</strong></p>
    <blockquote class="rule" style="position: absolute; left: 720px; top: 520px; margin: 0; padding-left: 16px; border-left: 4px solid #B45309">Left-rule quote</blockquote>
  </body></html>`,
  '03-backup.html': `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body data-hidden data-footer="off" style="--color-text: #FFFFFF">
    <h1>Backup</h1>
  </body></html>`,
  '04-appendix.html': `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}
    .second { position: absolute; left: 96px; top: 200px; margin: 0; }
    .first { position: absolute; left: 96px; top: 300px; width: 240px; height: 80px; margin: 0; background-image: linear-gradient(90deg, #B45309, #0F766E); color: #FFFFFF; }
    .spun { position: absolute; left: 96px; top: 420px; margin: 0; }
  </style></head><body data-footer-center="Appendix only" data-transition="push" data-transition-duration="1s">
    <h1>Appendix</h1>
    <p class="second" data-enter="fly" data-enter-order="2">Second in</p>
    <div class="first" data-enter="fade" data-enter-order="1">First in</div>
    <p class="spun" data-enter="spin">Never in</p>
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
  writeFileSync(join(source, 'photo.png'), PHOTO)
  writeFileSync(join(source, 'notes.txt'), 'not a slide')
  writeFileSync(join(source, 'deck.json'), JSON.stringify(DECK))
  mkdirSync(join(source, 'fonts'))
  writeFileSync(join(source, 'fonts', 'fixture.ttf'), testFace())
  writeFileSync(
    join(source, 'fonts', 'locked.ttf'),
    testFace({ weight: 700, fsType: 0x0002 }),
  )
  mkdirSync(join(root, '.claude', 'design'), { recursive: true })
  writeFileSync(join(root, '.claude', 'design', 'base.css'), TOKENS)
  return source
}

describe.skipIf(!hasBrowser)('exportHtmlDeck', () => {
  let root: string
  let result: ExportResult
  let zip: JSZip
  let slideXml: string[]
  let slideRels: string[]

  const part = async (path: string): Promise<string> =>
    (await zip.file(path)?.async('string')) ?? ''

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'canon-slides-e2e-'))
    const source = writeFixture(root)
    result = await exportHtmlDeck(source, join(root, 'out'), { root })
    if (result.status !== 'written') throw new Error(result.message)
    zip = await JSZip.loadAsync(readFileSync(result.pptxPath))
    slideXml = await Promise.all(
      [1, 2, 3, 4].map((n) => part(`ppt/slides/slide${n}.xml`)),
    )
    slideRels = await Promise.all(
      [1, 2, 3, 4].map((n) => part(`ppt/slides/_rels/slide${n}.xml.rels`)),
    )
  }, 60_000)

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const allXml = (): string => slideXml.join('\n')
  const layoutOf = (index: number): Promise<string> => {
    const target = /Target="\.\.\/slideLayouts\/(slideLayout\d+\.xml)"/.exec(
      slideRels[index] ?? '',
    )?.[1]
    return part(`ppt/slideLayouts/${target}`)
  }
  const layoutName = async (index: number): Promise<string | undefined> =>
    /<p:cSld name="([^"]*)"/.exec(await layoutOf(index))?.[1]
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
    expect(result).toMatchObject({ status: 'written', slideCount: 4 })
  })

  it('should give the master the injected background', async () => {
    expect(await layoutOf(0)).toMatch(/<p:bg>.*srgbClr val="F0F9FF"/s)
  })

  it('should report a slide whose text token departs from the master', () => {
    expect(result.status === 'written' && result.notices).toEqual([
      'slide 3 sets a --color-text apart from the master, so its bands keep the master colors',
    ])
  })

  it('should set the theme face from the slide body font', async () => {
    expect(await part('ppt/theme/theme1.xml')).toContain(
      'typeface="Fixture Sans"',
    )
  })

  it('should draw the footer title and slide number on the master', async () => {
    const layout = await layoutOf(0)

    expect([
      layout.includes('<a:t>Fixture deck</a:t>'),
      layout.includes('type="slidenum"'),
    ]).toEqual([true, true])
  })

  it('should place the mark on the master', async () => {
    expect(await layoutOf(0)).toContain('<p:pic>')
  })

  it('should put the footer-off slide on the bare master', async () => {
    expect(await layoutName(2)).toBe('canon-bare')
  })

  it('should give the override slide its own footer text', () => {
    expect(slideXml[3]).toContain('<a:t>Appendix only</a:t>')
  })

  it('should keep the deck title beside the override slot', () => {
    expect(slideXml[3]).toContain('<a:t>Fixture deck</a:t>')
  })

  it('should keep the slide number on the override slide', () => {
    expect(slideXml[3]).toContain('type="slidenum"')
  })

  it('should land the chart as a native chart part', async () => {
    expect(await part('ppt/charts/chart1.xml')).toContain('<c:barChart>')
  })

  it('should color the first series with the injected accent', async () => {
    const chart = await part('ppt/charts/chart1.xml')
    const series = chart.slice(chart.indexOf('<c:ser>'))

    expect(/srgbClr val="([0-9A-F]{6})"/.exec(series)?.[1]).toBe('0F766E')
  })

  it('should keep the chart figure own background as a shape', () => {
    expect(slideXml[1]).toContain('srgbClr val="FEF3C7"')
  })

  it('should leave the chart table out of the shapes', () => {
    expect(runs()).not.toContain('South')
  })

  it('should write the notes without their tags', async () => {
    const notes = await part('ppt/notesSlides/notesSlide1.xml')

    expect([
      notes.includes('Open with the headline.'),
      notes.includes('strong'),
    ]).toEqual([true, false])
  })

  it('should leave the notes out of the shapes', () => {
    expect(runs()).not.toContain('Then pause.')
  })

  it('should write two sections', async () => {
    const presentation = await part('ppt/presentation.xml')

    expect(presentation.match(/<p14:section /g)).toHaveLength(2)
  })

  it('should hide the hidden slide', () => {
    expect(slideXml[2]).toMatch(/<p:sld [^>]*show="0"/)
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

  it('should underline an inline run inside an underlined block', () => {
    const run = /<a:r><a:rPr([^>]*)>(?:(?!<\/a:r>).)*<a:t>lined<\/a:t>/s.exec(
      slideXml[1] ?? '',
    )

    expect(run?.[1]).toContain('u="sng"')
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
    expect(result.status === 'written' && result.fallbacks).toContainEqual(
      expect.objectContaining({
        slide: 2,
        selector: 'div.gradient',
        properties: ['background-image'],
      }),
    )
  })

  it('should report a quote drawing only its left border', () => {
    expect(result.status === 'written' && result.fallbacks).toContainEqual(
      expect.objectContaining({
        selector: 'blockquote.rule',
        properties: ['border'],
      }),
    )
  })

  it('should report a paragraph whose inline run carries a filter', () => {
    expect(result.status === 'written' && result.fallbacks).toContainEqual(
      expect.objectContaining({ selector: 'p.soft', properties: ['filter'] }),
    )
  })

  const shapeId = (index: number, text: string): string | undefined => {
    const xml = slideXml[index] ?? ''
    const at = xml.indexOf(text)
    const shapes = [
      ...xml.slice(0, at).matchAll(/<p:cNvPr id="(\d+)" name="canon-/g),
    ]
    return shapes.at(-1)?.[1]
  }
  const pictureId = (index: number, alt: string): string | undefined =>
    new RegExp(`<p:cNvPr id="(\\d+)" name="canon-[^"]*" descr="${alt}"`).exec(
      slideXml[index] ?? '',
    )?.[1]

  it('should write the declared transition at the nearest speed', () => {
    expect(slideXml[3]).toContain(
      '<p:transition spd="slow"><p:push/></p:transition>',
    )
  })

  it('should leave a slide declaring no motion without a transition', () => {
    expect(slideXml[0]).not.toContain('<p:transition')
  })

  it('should target the two entrances in their declared order', () => {
    const targets = [
      ...(slideXml[3] ?? '').matchAll(
        /nodeType="clickEffect">.*?<p:spTgt spid="(\d+)"\/>/g,
      ),
    ].map((match) => match[1])

    expect(targets).toEqual([pictureId(3, 'First in'), shapeId(3, 'Second in')])
  })

  it('should report an unknown entrance by its element', () => {
    expect(result.status === 'written' && result.refusedMotion).toEqual([
      {
        slide: 4,
        message: 'p.spun: unknown entrance spin. Use fade, fly, wipe, or zoom',
      },
    ])
  })

  it('should embed the allowed face as a font part', () => {
    expect(zip.file('ppt/fonts/font1.fntdata')).not.toBeNull()
  })

  it('should register the font part and its content type', async () => {
    expect(await part('ppt/_rels/presentation.xml.rels')).toContain(
      'Target="fonts/font1.fntdata"',
    )
    expect(await part('[Content_Types].xml')).toContain(
      '<Default Extension="fntdata" ContentType="application/x-fontdata"/>',
    )
  })

  it('should list the face and turn embedding on', async () => {
    const presentation = await part('ppt/presentation.xml')

    expect(presentation).toContain('embedTrueTypeFonts="1"')
    expect(presentation).toContain(
      '<p:embeddedFont><p:font typeface="Fixture Sans"/><p:regular r:id="rIdCanonFont1"/></p:embeddedFont>',
    )
  })

  it('should refuse the restricted face by its path', () => {
    expect(result.status === 'written' && result.refusedFonts).toEqual([
      {
        path: 'fonts/locked.ttf',
        message: 'its license forbids embedding (fsType restricted)',
      },
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

      expect(images).toHaveLength(3)
    },
    60_000,
  )
})

describe('Sections', () => {
  const meta = (section?: string): SlideMeta => ({
    ...(section ? { section } : {}),
    isHidden: false,
    header: { kind: 'master' },
    footer: { kind: 'master' },
  })

  it('should give a returning section title its own section', () => {
    const pptx = new PptxGenJS()
    const sections = new Sections('Deck', true)

    const titles = ['Intro', 'Body', 'Intro'].map((title) =>
      sections.titleFor(meta(title), pptx),
    )

    expect(titles).toEqual(['Intro', 'Body', 'Intro (2)'])
  })

  it('should open a section named after the deck ahead of the first one', () => {
    const pptx = new PptxGenJS()
    const sections = new Sections('Deck', true)

    const titles = [undefined, 'Body', undefined].map((title) =>
      sections.titleFor(meta(title), pptx),
    )

    expect(titles).toEqual(['Deck', 'Body', 'Body'])
  })

  it('should open no section for a deck that declares none', () => {
    const pptx = new PptxGenJS()
    const sections = new Sections('Deck', false)

    expect(sections.titleFor(meta(), pptx)).toBeUndefined()
  })
})

describe('exportHtmlDeck with a malformed deck file', () => {
  it('should refuse and name the field', async () => {
    const root = mkdtempSync(join(tmpdir(), 'canon-slides-deck-'))
    writeFileSync(join(root, '01.html'), '<p>one</p>')
    writeFileSync(join(root, 'deck.json'), JSON.stringify({ title: 3 }))

    const result = await exportHtmlDeck(root, join(root, 'out'), { root })

    rmSync(root, { recursive: true, force: true })
    expect(result).toEqual({
      status: 'refused',
      reason: 'deck-invalid',
      message: `${join(root, 'deck.json')}: title must be a string`,
    })
  })
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
