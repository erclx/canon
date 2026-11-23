import { describe, expect, it } from 'vitest'
import { pickFrames, readReel } from '@/take/stills'

/**
 * Covers what a reel file may be before any browser starts, since a refusal here
 * costs nothing and a decode of the wrong file costs a launch.
 */

function chunk(kind: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.write(kind, 0, 'ascii')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body, Buffer.alloc(body.length % 2)])
}

function header(flags: number, width: number, height: number): Buffer {
  const body = Buffer.alloc(10)
  body[0] = flags
  body.writeUIntLE(width - 1, 4, 3)
  body.writeUIntLE(height - 1, 7, 3)
  return chunk('VP8X', body)
}

function frame(ms: number): Buffer {
  const body = Buffer.alloc(16)
  body.writeUIntLE(ms, 12, 3)
  return chunk('ANMF', body)
}

function webp(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks])
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'ascii')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

describe('readReel', () => {
  it('should read the canvas size and where each frame starts', () => {
    const read = readReel(
      webp(header(0x02, 960, 540), frame(100), frame(150), frame(100)),
    )

    expect(read).toEqual({
      kind: 'read',
      reel: {
        width: 960,
        height: 540,
        frames: [
          { index: 0, ms: 0 },
          { index: 1, ms: 100 },
          { index: 2, ms: 250 },
        ],
      },
    })
  })

  it('should refuse a file that is not a WebP', () => {
    expect(readReel(Buffer.from('not a reel at all, just text')).kind).toBe(
      'refused',
    )
  })

  it('should refuse a still WebP with no animation flag', () => {
    expect(readReel(webp(header(0x00, 960, 540), frame(100))).kind).toBe(
      'refused',
    )
  })

  it('should refuse an animated header that carries no frame', () => {
    expect(readReel(webp(header(0x02, 960, 540))).kind).toBe('refused')
  })

  it('should refuse a file that ends inside a chunk', () => {
    const whole = webp(header(0x02, 960, 540), frame(100))

    expect(readReel(whole.subarray(0, whole.length - 4)).kind).toBe('refused')
  })
})

describe('pickFrames', () => {
  const cases: [string, number, number, number[]][] = [
    ['a count under the frames, first and last included', 10, 4, [0, 3, 6, 9]],
    ['a count equal to the frames', 3, 3, [0, 1, 2]],
    ['a count over the frames, each once', 3, 8, [0, 1, 2]],
    ['a count of one', 10, 1, [0]],
    ['a reel of one frame', 1, 4, [0]],
    ['a count of two', 10, 2, [0, 9]],
  ]

  it.each(cases)('should pick for %s', (_name, total, count, expected) => {
    expect(pickFrames(total, count)).toEqual(expected)
  })

  it('should pick nothing from no frames or a count of zero', () => {
    expect([pickFrames(0, 4), pickFrames(5, 0)]).toEqual([[], []])
  })
})
