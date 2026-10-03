import type JSZip from 'jszip'

/**
 * Embeds the deck's typeface in the written package, which pptxgenjs cannot do.
 * PowerPoint reads an embedded face as an Embedded OpenType 2.2 container
 * around the TrueType or OpenType data, stored as `ppt/fonts/fontN.fntdata`
 * and listed in `presentation.xml`. The header is built from the face's own
 * `OS/2`, `head`, and `name` tables, laid out per the W3C EOT submission:
 * https://www.w3.org/submissions/EOT/
 */

export interface EmbedFace {
  readonly family: string
  readonly weight: number
  readonly style: 'normal' | 'italic'
  /** As `deck.json` wrote it, which every notice names. */
  readonly path: string
  readonly bytes: Uint8Array
}

export interface FontNotice {
  readonly path: string
  readonly message: string
}

export type EotResult =
  | { readonly status: 'embeddable'; readonly eot: Buffer }
  | { readonly status: 'refused'; readonly message: string }

/** `fsType` bits from the OpenType `OS/2` table. */
const RESTRICTED = 0x0002
const BITMAP_ONLY = 0x0200

const SFNT_VERSIONS = new Set([0x00010000, 0x74727565, 0x4f54544f])
const WRAPPED: Readonly<Record<number, string>> = {
  0x774f4632: 'woff2',
  0x774f4646: 'woff',
  0x74746366: 'a font collection',
}

const UNDECODABLE = 'it could not be decoded as a TrueType or OpenType font'

interface Table {
  readonly offset: number
  readonly length: number
}

function tables(font: Buffer): Map<string, Table> {
  const found = new Map<string, Table>()
  const count = font.readUInt16BE(4)
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16
    const offset = font.readUInt32BE(at + 8)
    const length = font.readUInt32BE(at + 12)
    if (offset + length > font.length) throw new RangeError('table overruns')
    found.set(font.toString('latin1', at, at + 4), { offset, length })
  }
  return found
}

/**
 * The Windows platform's strings, in UTF-16, preferring US English where a
 * face carries several languages.
 */
function names(font: Buffer, table: Table): Map<number, Buffer> {
  const found = new Map<number, { language: number; bytes: Buffer }>()
  const count = font.readUInt16BE(table.offset + 2)
  const strings = table.offset + font.readUInt16BE(table.offset + 4)
  for (let index = 0; index < count; index += 1) {
    const at = table.offset + 6 + index * 12
    if (font.readUInt16BE(at) !== 3) continue
    const language = font.readUInt16BE(at + 4)
    const id = font.readUInt16BE(at + 6)
    const length = font.readUInt16BE(at + 8)
    const start = strings + font.readUInt16BE(at + 10)
    if (start + length > font.length) throw new RangeError('name overruns')
    const held = found.get(id)
    if (held && (held.language === 0x0409 || language !== 0x0409)) continue
    const bytes = Buffer.from(font.subarray(start, start + length)).swap16()
    found.set(id, { language, bytes })
  }
  return new Map([...found].map(([id, { bytes }]) => [id, bytes]))
}

function sized(bytes: Buffer = Buffer.alloc(0)): Buffer {
  const size = Buffer.alloc(2)
  size.writeUInt16LE(bytes.length)
  return Buffer.concat([size, bytes])
}

function header(font: Buffer, os2: number, head: number): Buffer {
  const fixed = Buffer.alloc(80)
  fixed.writeUInt32LE(font.length, 4)
  fixed.writeUInt32LE(0x00020002, 8)
  font.copy(fixed, 16, os2 + 32, os2 + 42)
  fixed.writeUInt8(1, 26)
  fixed.writeUInt8(font.readUInt16BE(os2 + 62) & 1, 27)
  fixed.writeUInt32LE(font.readUInt16BE(os2 + 4), 28)
  fixed.writeUInt16LE(font.readUInt16BE(os2 + 8), 32)
  fixed.writeUInt16LE(0x504c, 34)
  for (let index = 0; index < 4; index += 1) {
    fixed.writeUInt32LE(font.readUInt32BE(os2 + 42 + index * 4), 36 + index * 4)
  }
  for (let index = 0; index < 2; index += 1) {
    fixed.writeUInt32LE(font.readUInt32BE(os2 + 78 + index * 4), 52 + index * 4)
  }
  fixed.writeUInt32LE(font.readUInt32BE(head + 8), 60)
  return fixed
}

/**
 * The EOT container around one face, or the reason it may not travel. A face
 * whose license restricts embedding or allows a bitmap only is refused, as is
 * a variable face, which PowerPoint does not embed. Editable and print-preview
 * embedding both pass, since the deck is meant to be edited.
 */
export function eotOf(bytes: Uint8Array): EotResult {
  const font = Buffer.from(bytes)
  const refused = (message: string): EotResult => ({
    status: 'refused',
    message,
  })
  if (font.length < 12) return refused(UNDECODABLE)
  const version = font.readUInt32BE(0)
  const wrapped = WRAPPED[version]
  if (wrapped) {
    return refused(
      `it is ${wrapped}. Supply the TrueType or OpenType file instead`,
    )
  }
  if (!SFNT_VERSIONS.has(version)) return refused(UNDECODABLE)
  try {
    const found = tables(font)
    const os2 = found.get('OS/2')
    const head = found.get('head')
    const name = found.get('name')
    // Version 0 of OS/2 stops before the code page ranges the header copies.
    if (!os2 || os2.length < 86 || !head || head.length < 12 || !name) {
      return refused(UNDECODABLE)
    }
    const fsType = font.readUInt16BE(os2.offset + 8)
    if (fsType & RESTRICTED) {
      return refused('its license forbids embedding (fsType restricted)')
    }
    if (fsType & BITMAP_ONLY) {
      return refused('its license allows bitmap embedding only (fsType 0x0200)')
    }
    if (found.has('fvar')) {
      return refused(
        'it is a variable font, which PowerPoint does not embed. Supply a static instance',
      )
    }
    const strings = names(font, name)
    const padding = Buffer.alloc(2)
    // RootStringCheckSum, EUDCCodePage, Padding6, SignatureSize, EUDCFlags,
    // and EUDCFontSize, all zero for a face with no root string or EUDC data.
    const tail = Buffer.alloc(20)
    const eot = Buffer.concat([
      header(font, os2.offset, head.offset),
      padding,
      sized(strings.get(1)),
      padding,
      sized(strings.get(2)),
      padding,
      sized(strings.get(5)),
      padding,
      sized(strings.get(4)),
      padding,
      sized(),
      tail,
      font,
    ])
    eot.writeUInt32LE(eot.length, 0)
    return { status: 'embeddable', eot }
  } catch (error) {
    if (error instanceof RangeError) return refused(UNDECODABLE)
    throw error
  }
}

type Slot = 'regular' | 'bold' | 'italic' | 'boldItalic'

/** The child order `<p:embeddedFont>` requires. */
const SLOTS: readonly Slot[] = ['regular', 'bold', 'italic', 'boldItalic']

/** PowerPoint keeps four faces a family, so a weight from 600 reads as bold. */
function slotOf(face: EmbedFace): Slot {
  const isBold = face.weight >= 600
  if (face.style === 'italic') return isBold ? 'boldItalic' : 'italic'
  return isBold ? 'bold' : 'regular'
}

const FONT_RELATIONSHIP =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font'
const NOTES_SIZE = /<p:notesSz\b[^>]*\/>/

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')

/**
 * Embeds each face the deck lists and returns one notice per face left out.
 * The font list goes after `<p:notesSz>`, where the schema orders it, and a
 * package missing that anchor embeds nothing rather than placing it elsewhere.
 */
export async function embedFonts(
  zip: JSZip,
  faces: readonly EmbedFace[],
): Promise<FontNotice[]> {
  const notices: FontNotice[] = []
  const families = new Map<string, Map<Slot, number>>()
  const parts: Buffer[] = []

  for (const face of faces) {
    const result = eotOf(face.bytes)
    if (result.status === 'refused') {
      notices.push({ path: face.path, message: result.message })
      continue
    }
    const slots = families.get(face.family) ?? new Map<Slot, number>()
    const slot = slotOf(face)
    if (slots.has(slot)) {
      notices.push({
        path: face.path,
        message: `${face.family} already embeds a ${slot} face, and PowerPoint holds one per slot`,
      })
      continue
    }
    parts.push(result.eot)
    slots.set(slot, parts.length)
    families.set(face.family, slots)
  }
  if (parts.length === 0) return notices

  const presentationPath = 'ppt/presentation.xml'
  const relsPath = 'ppt/_rels/presentation.xml.rels'
  const typesPath = '[Content_Types].xml'
  const [presentation, rels, types] = await Promise.all(
    [presentationPath, relsPath, typesPath].map(
      async (path) => (await zip.file(path)?.async('string')) ?? '',
    ),
  )
  if (!presentation || !NOTES_SIZE.test(presentation)) {
    const message = 'the deck has no <p:notesSz> to anchor the font list after'
    return [
      ...notices,
      ...faces
        .filter((face) => !notices.some((notice) => notice.path === face.path))
        .map((face) => ({ path: face.path, message })),
    ]
  }

  const id = (part: number): string => `rIdCanonFont${part}`
  parts.forEach((eot, index) => {
    zip.file(`ppt/fonts/font${index + 1}.fntdata`, eot)
  })
  const relationships = parts
    .map(
      (_, index) =>
        `<Relationship Id="${id(index + 1)}" Type="${FONT_RELATIONSHIP}" Target="fonts/font${index + 1}.fntdata"/>`,
    )
    .join('')
  zip.file(
    relsPath,
    rels.replace('</Relationships>', `${relationships}</Relationships>`),
  )
  if (!types.includes('Extension="fntdata"')) {
    zip.file(
      typesPath,
      types.replace(
        /(<Types\b[^>]*>)/,
        '$1<Default Extension="fntdata" ContentType="application/x-fontdata"/>',
      ),
    )
  }
  const list = [...families]
    .map(([family, slots]) => {
      const children = SLOTS.flatMap((slot) => {
        const part = slots.get(slot)
        return part ? [`<p:${slot} r:id="${id(part)}"/>`] : []
      })
      return `<p:embeddedFont><p:font typeface="${escapeXml(family)}"/>${children.join('')}</p:embeddedFont>`
    })
    .join('')
  zip.file(
    presentationPath,
    presentation
      .replace(
        NOTES_SIZE,
        (anchor) => `${anchor}<p:embeddedFontLst>${list}</p:embeddedFontLst>`,
      )
      .replace('<p:presentation ', '<p:presentation embedTrueTypeFonts="1" '),
  )
  return notices
}
