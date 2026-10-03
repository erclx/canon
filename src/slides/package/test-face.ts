/**
 * Builds the smallest sfnt the font step reads, holding only the `OS/2`,
 * `head`, and `name` tables an EOT header is built from, plus `fvar` when the
 * face should read as variable. It carries no glyphs, so it embeds and never
 * renders. Tests use it in place of a real face, whose license the repository
 * would then have to carry.
 */

export interface TestFaceOptions {
  readonly family?: string
  readonly subfamily?: string
  readonly weight?: number
  readonly isItalic?: boolean
  readonly fsType?: number
  readonly isVariable?: boolean
  /** The first four bytes, `0x00010000` for TrueType. */
  readonly version?: number
}

/** Values distinct enough that a header copying the wrong field shows it. */
export const TEST_FACE = {
  panose: [2, 11, 5, 3, 3, 4, 3, 2, 2, 4],
  unicodeRanges: [0xe0000aff, 0x5000e5ff, 0x00000009, 0x00000001],
  codePages: [0x0000019f, 0x01020000],
  checkSumAdjustment: 0x1234abcd,
} as const

function os2(options: TestFaceOptions): Buffer {
  const table = Buffer.alloc(96)
  table.writeUInt16BE(4, 0)
  table.writeUInt16BE(options.weight ?? 400, 4)
  table.writeUInt16BE(options.fsType ?? 0, 8)
  Buffer.from(TEST_FACE.panose).copy(table, 32)
  TEST_FACE.unicodeRanges.forEach((range, index) => {
    table.writeUInt32BE(range, 42 + index * 4)
  })
  table.write('TEST', 58, 'latin1')
  table.writeUInt16BE(options.isItalic ? 0x0001 : 0x0040, 62)
  TEST_FACE.codePages.forEach((page, index) => {
    table.writeUInt32BE(page, 78 + index * 4)
  })
  return table
}

function head(): Buffer {
  const table = Buffer.alloc(54)
  table.writeUInt32BE(0x00010000, 0)
  table.writeUInt32BE(TEST_FACE.checkSumAdjustment, 8)
  table.writeUInt32BE(0x5f0f3cf5, 12)
  return table
}

function name(strings: ReadonlyMap<number, string>): Buffer {
  const encoded = [...strings].map(([id, text]) => ({
    id,
    bytes: Buffer.from(text, 'utf16le').swap16(),
  }))
  const header = Buffer.alloc(6 + encoded.length * 12)
  header.writeUInt16BE(0, 0)
  header.writeUInt16BE(encoded.length, 2)
  header.writeUInt16BE(header.length, 4)
  let offset = 0
  encoded.forEach(({ id, bytes }, index) => {
    const at = 6 + index * 12
    header.writeUInt16BE(3, at)
    header.writeUInt16BE(1, at + 2)
    header.writeUInt16BE(0x0409, at + 4)
    header.writeUInt16BE(id, at + 6)
    header.writeUInt16BE(bytes.length, at + 8)
    header.writeUInt16BE(offset, at + 10)
    offset += bytes.length
  })
  return Buffer.concat([header, ...encoded.map(({ bytes }) => bytes)])
}

export function testFace(options: TestFaceOptions = {}): Buffer {
  const family = options.family ?? 'Fixture Sans'
  const subfamily = options.subfamily ?? 'Regular'
  const tables = new Map<string, Buffer>([
    ['OS/2', os2(options)],
    ['head', head()],
    [
      'name',
      name(
        new Map([
          [1, family],
          [2, subfamily],
          [4, `${family} ${subfamily}`],
          [5, 'Version 1.000'],
        ]),
      ),
    ],
  ])
  if (options.isVariable) tables.set('fvar', Buffer.alloc(16))

  const entries = [...tables].sort(([a], [b]) => a.localeCompare(b))
  const directory = Buffer.alloc(12 + entries.length * 16)
  directory.writeUInt32BE(options.version ?? 0x00010000, 0)
  directory.writeUInt16BE(entries.length, 4)
  let offset = directory.length
  const bodies: Buffer[] = []
  entries.forEach(([tag, table], index) => {
    const at = 12 + index * 16
    directory.write(tag, at, 'latin1')
    directory.writeUInt32BE(offset, at + 8)
    directory.writeUInt32BE(table.length, at + 12)
    const padded = Buffer.alloc(Math.ceil(table.length / 4) * 4)
    table.copy(padded)
    bodies.push(padded)
    offset += padded.length
  })
  return Buffer.concat([directory, ...bodies])
}
