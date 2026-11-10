import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveFrames } from '@/inventory/frames'

let root: string

const frame = (path: string): string => {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, '<p>frame</p>')
  return path
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'inventory-frames-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('resolveFrames', () => {
  it('should label one frame by its file name', () => {
    const path = frame('landing/00-current/04-craft.html')

    const result = resolveFrames([path], root)

    expect(result).toEqual({
      kind: 'resolved',
      frames: [
        {
          label: '04-craft.html',
          url: pathToFileURL(join(root, path)).href,
        },
      ],
    })
  })

  it('should keep two frames sharing a basename apart by their page', () => {
    const first = frame('round/01-hero/arm-1.html')
    const second = frame('round/02-craft/arm-1.html')

    const result = resolveFrames([first, second], root)

    expect(
      result.kind === 'resolved' && result.frames.map((entry) => entry.label),
    ).toEqual(['01-hero/arm-1.html', '02-craft/arm-1.html'])
  })

  it('should label frames in one folder by file name alone', () => {
    const first = frame('round/01-hero/arm-1.html')
    const second = frame('round/01-hero/arm-2.html')

    const result = resolveFrames([first, second], root)

    expect(
      result.kind === 'resolved' && result.frames.map((entry) => entry.label),
    ).toEqual(['arm-1.html', 'arm-2.html'])
  })

  it('should name every path that is not a file', () => {
    const present = frame('round/arm-1.html')

    const result = resolveFrames([present, 'round/gone.html', 'round'], root)

    expect(result).toEqual({
      kind: 'missing',
      paths: ['round/gone.html', 'round'],
    })
  })
})
