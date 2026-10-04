import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  primaryFontFamily,
  resolveCaptureSources,
  textFamilies,
} from '@/capture/sources'

function fixture(names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'canon-capture-'))
  for (const name of names) writeFileSync(join(dir, name), '')
  return dir
}

describe('resolveCaptureSources', () => {
  it('should pair a single file with a sibling png', () => {
    const dir = fixture(['install.html'])

    const sources = resolveCaptureSources(join(dir, 'install.html'))

    expect(sources).toEqual([
      {
        kind: 'file',
        htmlPath: join(dir, 'install.html'),
        pngPath: join(dir, 'install.png'),
      },
    ])
  })

  it('should expand a directory to every html file in sorted order', () => {
    const dir = fixture(['sync.html', 'install.html', 'notes.md'])

    const sources = resolveCaptureSources(dir)

    expect(
      sources.map((source) =>
        source.kind === 'file' ? source.htmlPath : source.url,
      ),
    ).toEqual([join(dir, 'install.html'), join(dir, 'sync.html')])
  })

  it('should return no source for a directory holding no html', () => {
    const dir = fixture(['notes.md'])

    const sources = resolveCaptureSources(dir)

    expect(sources).toEqual([])
  })

  it('should redirect every png to an explicit output directory', () => {
    const dir = fixture(['install.html'])

    const sources = resolveCaptureSources(dir, '/out')

    expect(sources[0]?.pngPath).toBe(join('/out', 'install.png'))
  })

  it('should pair a URL source with its explicit destination file', () => {
    const sources = resolveCaptureSources(
      'https://example.com',
      '/out/shot.png',
    )

    expect(sources).toEqual([
      {
        kind: 'url',
        url: 'https://example.com',
        pngPath: '/out/shot.png',
      },
    ])
  })

  it('should accept a plain http URL, not only https', () => {
    const sources = resolveCaptureSources('http://example.com', '/out/shot.png')

    expect(sources[0]?.kind).toBe('url')
  })

  it('should refuse a URL source with no destination given', () => {
    expect(() => resolveCaptureSources('https://example.com')).toThrow(/--out/)
  })
})

describe('primaryFontFamily', () => {
  it('should read the first family of a quoted stack', () => {
    expect(
      primaryFontFamily('"Noto Sans Mono", "DejaVu Sans Mono", monospace'),
    ).toBe('Noto Sans Mono')
  })

  it('should strip single quotes as authored', () => {
    expect(primaryFontFamily("'Noto Sans Mono', monospace")).toBe(
      'Noto Sans Mono',
    )
  })

  it('should read a lone unquoted family', () => {
    expect(primaryFontFamily('monospace')).toBe('monospace')
  })

  it('should return an empty string for an empty declaration', () => {
    expect(primaryFontFamily('')).toBe('')
  })
})

describe('textFamilies', () => {
  it('should keep one entry per distinct primary family', () => {
    expect(
      textFamilies(['"Geist Variable", sans-serif', 'Geist Variable, serif']),
    ).toEqual(['Geist Variable'])
  })

  it('should keep the families in document order', () => {
    expect(
      textFamilies(['Geist Variable', '"Noto Sans Mono", monospace']),
    ).toEqual(['Geist Variable', 'Noto Sans Mono'])
  })

  it('should strip quotes the way primaryFontFamily does', () => {
    expect(textFamilies(["'Noto Sans Mono', monospace"])).toEqual([
      'Noto Sans Mono',
    ])
  })

  it('should drop a declaration naming no family', () => {
    expect(textFamilies(['', 'Geist Variable'])).toEqual(['Geist Variable'])
  })

  it('should return an empty list for no declarations', () => {
    expect(textFamilies([])).toEqual([])
  })
})
