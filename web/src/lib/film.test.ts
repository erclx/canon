import { describe, expect, it } from 'vitest'

import { mp4Seconds } from './film'

function box(type: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(8 + body.length, 0)
  header.write(type, 4, 'latin1')
  return Buffer.concat([header, body])
}

function mvhdV0(timescale: number, duration: number): Buffer {
  const body = Buffer.alloc(20)
  body.writeUInt32BE(timescale, 12)
  body.writeUInt32BE(duration, 16)
  return box('mvhd', body)
}

function mvhdV1(timescale: number, duration: number): Buffer {
  const body = Buffer.alloc(32)
  body.writeUInt8(1, 0)
  body.writeUInt32BE(timescale, 20)
  body.writeBigUInt64BE(BigInt(duration), 24)
  return box('mvhd', body)
}

const ftyp = box('ftyp', Buffer.from('isom0000', 'latin1'))

describe('mp4Seconds', () => {
  it('should read a version 0 movie header after other boxes', () => {
    const file = Buffer.concat([
      ftyp,
      box('free', Buffer.alloc(4)),
      box('moov', mvhdV0(1000, 42900)),
    ])

    expect(mp4Seconds(file)).toBe(42.9)
  })

  it('should read a version 1 movie header', () => {
    const file = Buffer.concat([ftyp, box('moov', mvhdV1(90000, 3861000))])

    expect(mp4Seconds(file)).toBe(42.9)
  })

  it('should refuse a file carrying no movie header', () => {
    const file = Buffer.concat([
      ftyp,
      box('moov', box('trak', Buffer.alloc(4))),
    ])

    expect(() => mp4Seconds(file)).toThrow(/mvhd/)
  })

  it('should refuse a header with a zero timescale', () => {
    const file = Buffer.concat([ftyp, box('moov', mvhdV0(0, 42900))])

    expect(() => mp4Seconds(file)).toThrow(/timescale/)
  })
})
