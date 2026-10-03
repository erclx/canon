import JSZip from 'jszip'
import { beforeEach, describe, expect, it } from 'vitest'
import { type EmbedFace, embedFonts, eotOf } from '@/slides/package/fonts'
import { TEST_FACE, testFace } from '@/slides/package/test-face'

function face(overrides: Partial<EmbedFace> = {}): EmbedFace {
  return {
    family: 'Fixture Sans',
    weight: 400,
    style: 'normal',
    path: 'fonts/fixture-regular.ttf',
    bytes: testFace(),
    ...overrides,
  }
}

function eot(bytes: Buffer): Buffer {
  const result = eotOf(bytes)
  if (result.status !== 'embeddable') throw new Error(result.message)
  return result.eot
}

const PRESENTATION =
  '<?xml version="1.0"?><p:presentation xmlns:r="r" xmlns:p="p" saveSubsetFonts="1"><p:sldSz cx="1" cy="1"/><p:notesSz cx="1" cy="1"/><p:defaultTextStyle/></p:presentation>'
const RELS =
  '<?xml version="1.0"?><Relationships xmlns="rels"><Relationship Id="rId1" Type="master" Target="slideMasters/slideMaster1.xml"/></Relationships>'
const TYPES =
  '<?xml version="1.0"?><Types xmlns="types"><Default Extension="xml" ContentType="application/xml"/></Types>'

describe('eotOf', () => {
  const ttf = testFace({ weight: 700, isItalic: true, fsType: 0x0008 })
  let header: Buffer

  beforeEach(() => {
    header = eot(ttf)
  })

  it('should state the total and font data sizes', () => {
    expect(header.readUInt32LE(0)).toBe(header.length)
    expect(header.readUInt32LE(4)).toBe(ttf.length)
  })

  it('should write version 2.2 with no compression or obfuscation', () => {
    expect(header.readUInt32LE(8)).toBe(0x00020002)
    expect(header.readUInt32LE(12)).toBe(0)
  })

  it('should copy the panose bytes', () => {
    expect([...header.subarray(16, 26)]).toEqual([...TEST_FACE.panose])
  })

  it('should carry the italic flag and the weight', () => {
    expect(header.readUInt8(27)).toBe(1)
    expect(header.readUInt32LE(28)).toBe(700)
  })

  it('should carry the embedding permissions and the magic number', () => {
    expect(header.readUInt16LE(32)).toBe(0x0008)
    expect(header.readUInt16LE(34)).toBe(0x504c)
  })

  it('should copy the unicode and code page ranges', () => {
    const ranges = [0, 1, 2, 3].map((index) =>
      header.readUInt32LE(36 + index * 4),
    )
    const pages = [0, 1].map((index) => header.readUInt32LE(52 + index * 4))

    expect(ranges).toEqual([...TEST_FACE.unicodeRanges])
    expect(pages).toEqual([...TEST_FACE.codePages])
  })

  it('should copy the checksum adjustment', () => {
    expect(header.readUInt32LE(60)).toBe(TEST_FACE.checkSumAdjustment)
  })

  it('should write the family name after one padding field', () => {
    const family = Buffer.from('Fixture Sans', 'utf16le')

    expect(header.readUInt16LE(80)).toBe(0)
    expect(header.readUInt16LE(82)).toBe(family.length)
    expect(header.subarray(84, 84 + family.length)).toEqual(family)
  })

  it('should end with the font data unchanged', () => {
    expect(header.subarray(header.length - ttf.length)).toEqual(ttf)
  })

  it.each([
    [0x0002, 'its license forbids embedding (fsType restricted)'],
    [0x0200, 'its license allows bitmap embedding only (fsType 0x0200)'],
  ])('should refuse fsType %s', (fsType, message) => {
    expect(eotOf(testFace({ fsType }))).toEqual({ status: 'refused', message })
  })

  it('should refuse a variable face', () => {
    expect(eotOf(testFace({ isVariable: true }))).toEqual({
      status: 'refused',
      message:
        'it is a variable font, which PowerPoint does not embed. Supply a static instance',
    })
  })

  it('should refuse a woff2 file by naming what to supply', () => {
    expect(eotOf(testFace({ version: 0x774f4632 }))).toEqual({
      status: 'refused',
      message: 'it is woff2. Supply the TrueType or OpenType file instead',
    })
  })

  it('should refuse bytes it cannot decode', () => {
    expect(eotOf(Buffer.from([0, 1, 0, 0, 0, 9]))).toEqual({
      status: 'refused',
      message: 'it could not be decoded as a TrueType or OpenType font',
    })
  })
})

describe('embedFonts', () => {
  let zip: JSZip

  const part = async (path: string): Promise<string> =>
    (await zip.file(path)?.async('string')) ?? ''

  beforeEach(() => {
    zip = new JSZip()
    zip.file('ppt/presentation.xml', PRESENTATION)
    zip.file('ppt/_rels/presentation.xml.rels', RELS)
    zip.file('[Content_Types].xml', TYPES)
  })

  it('should write the face as a font part', async () => {
    await embedFonts(zip, [face()])

    expect(zip.file('ppt/fonts/font1.fntdata')).not.toBeNull()
  })

  it('should register the font relationship', async () => {
    await embedFonts(zip, [face()])

    expect(await part('ppt/_rels/presentation.xml.rels')).toContain(
      '<Relationship Id="rIdCanonFont1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/></Relationships>',
    )
  })

  it('should declare the font data content type once', async () => {
    await embedFonts(zip, [face(), face({ weight: 700 })])

    expect((await part('[Content_Types].xml')).match(/fntdata/g)).toEqual([
      'fntdata',
    ])
  })

  it('should list the face after the notes size and turn embedding on', async () => {
    await embedFonts(zip, [face()])

    const xml = await part('ppt/presentation.xml')
    expect(xml).toContain(
      '<p:notesSz cx="1" cy="1"/><p:embeddedFontLst><p:embeddedFont><p:font typeface="Fixture Sans"/><p:regular r:id="rIdCanonFont1"/></p:embeddedFont></p:embeddedFontLst>',
    )
    expect(xml).toContain('<p:presentation embedTrueTypeFonts="1" ')
  })

  it('should put two weights of one family under one entry', async () => {
    await embedFonts(zip, [
      face({ weight: 700, path: 'fonts/bold.ttf' }),
      face({ path: 'fonts/regular.ttf' }),
    ])

    expect(await part('ppt/presentation.xml')).toContain(
      '<p:embeddedFont><p:font typeface="Fixture Sans"/><p:regular r:id="rIdCanonFont2"/><p:bold r:id="rIdCanonFont1"/></p:embeddedFont>',
    )
  })

  it('should file an italic bold face under its own slot', async () => {
    await embedFonts(zip, [face({ weight: 700, style: 'italic' })])

    expect(await part('ppt/presentation.xml')).toContain(
      '<p:boldItalic r:id="rIdCanonFont1"/>',
    )
  })

  it('should refuse a forbidden face by path and still embed the rest', async () => {
    const notices = await embedFonts(zip, [
      face({ path: 'fonts/locked.ttf', bytes: testFace({ fsType: 0x0002 }) }),
      face({ weight: 700, path: 'fonts/bold.ttf' }),
    ])

    expect(notices).toEqual([
      {
        path: 'fonts/locked.ttf',
        message: 'its license forbids embedding (fsType restricted)',
      },
    ])
    expect(await part('ppt/presentation.xml')).toContain(
      '<p:bold r:id="rIdCanonFont1"/>',
    )
  })

  it('should refuse a second face filling a taken slot', async () => {
    const notices = await embedFonts(zip, [
      face(),
      face({ weight: 500, path: 'fonts/medium.ttf' }),
    ])

    expect(notices).toEqual([
      {
        path: 'fonts/medium.ttf',
        message:
          'Fixture Sans already embeds a regular face, and PowerPoint holds one per slot',
      },
    ])
  })

  it('should leave the package alone when every face is refused', async () => {
    await embedFonts(zip, [face({ bytes: testFace({ isVariable: true }) })])

    expect(await part('ppt/presentation.xml')).toBe(PRESENTATION)
  })

  it('should refuse every face when the notes size anchor is missing', async () => {
    zip.file('ppt/presentation.xml', '<p:presentation></p:presentation>')

    const notices = await embedFonts(zip, [face()])

    expect(notices).toEqual([
      {
        path: 'fonts/fixture-regular.ttf',
        message: 'the deck has no <p:notesSz> to anchor the font list after',
      },
    ])
    expect(zip.file('ppt/fonts/font1.fntdata')).toBeNull()
  })
})
