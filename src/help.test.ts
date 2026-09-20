import { describe, expect, it } from 'vitest'
import { renderHelp } from '@/help'

const FRAME_GLYPHS = /[┌├│└]/

function makeStream(isTTY: boolean): NodeJS.WriteStream {
  return { isTTY } as NodeJS.WriteStream
}

function stripFrame(block: string): string[] {
  return block
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.replace(/^[┌├│└]\s?/, '').trimEnd())
    .filter((line) => line.trim() !== '')
}

describe('renderHelp', () => {
  it('should carry the frame glyphs on a TTY stream', () => {
    expect(renderHelp(makeStream(true))).toMatch(FRAME_GLYPHS)
  })

  it('should carry no frame glyphs on a non-TTY stream', () => {
    expect(renderHelp(makeStream(false))).not.toMatch(FRAME_GLYPHS)
  })

  it('should carry no frame glyphs when isTTY is undefined', () => {
    expect(renderHelp({} as NodeJS.WriteStream)).not.toMatch(FRAME_GLYPHS)
  })

  it('should keep the same text in both forms', () => {
    const framed = stripFrame(renderHelp(makeStream(true)))
    const plain = stripFrame(renderHelp(makeStream(false)))

    expect(plain.map((line) => line.trim())).toEqual(
      framed.map((line) => line.trim()),
    )
  })

  it('should keep the Sandbox heading indented with its colon in the plain form', () => {
    const lines = renderHelp(makeStream(false)).split('\n')

    expect(lines).toContain('  Sandbox:')
  })

  it('should start the plain form at the usage line', () => {
    const [first] = renderHelp(makeStream(false)).split('\n')

    expect(first).toBe('Usage: canon [command]')
  })

  it('should cut descriptions at the same text in both forms', () => {
    const framed = renderHelp(makeStream(true)).split('\n')
    const plain = renderHelp(makeStream(false)).split('\n')
    const cutOf = (lines: string[]) =>
      lines.filter((line) => line.endsWith('…')).map((l) => l.split('# ')[1])

    expect(cutOf(plain)).toEqual(cutOf(framed))
  })
})
