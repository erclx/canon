import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addProjectFace,
  inlineProjectFaces,
  listProjectFaces,
  namedFamilies,
} from '@/design/project-fonts'

const WOFF2 = Buffer.from('wOF2\u0000\u0001fake-face', 'binary')
const SHEET = '.claude/design/project/fonts.css'

let ROOT = ''
let OUTSIDE = ''

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-project-fonts-'))
  OUTSIDE = mkdtempSync(join(tmpdir(), 'canon-project-fonts-outside-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
  rmSync(OUTSIDE, { recursive: true, force: true })
})

function seed(path: string, content: string | Buffer): void {
  const full = join(ROOT, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content)
}

function faceRule(family: string, url: string, weight = '400'): string {
  return `@font-face {\n  font-family: '${family}';\n  font-weight: ${weight};\n  src: url('${url}') format('woff2');\n}\n`
}

function fontFile(name = 'inter.woff2', bytes: Buffer = WOFF2): string {
  const path = join(OUTSIDE, name)
  writeFileSync(path, bytes)
  return path
}

describe('namedFamilies', () => {
  it('should read every family a declaration value lists, quoted or not', () => {
    const css = `:root {
      --type-body-family: Geist Variable, DejaVu Sans, sans-serif;
      --figure-hand: 'Virgil', "Excalifont", cursive;
    }`

    expect([...namedFamilies(css)]).toEqual(
      expect.arrayContaining(['Geist Variable', 'Virgil', 'Excalifont']),
    )
  })

  it('should not read the family a font-face rule declares as a use of it', () => {
    expect(
      namedFamilies(faceRule('Inter', 'fonts/inter.woff2')).has('Inter'),
    ).toBe(false)
  })
})

describe('listProjectFaces', () => {
  it('should list each face a project sheet declares with its file present', () => {
    seed('.claude/design/project/fonts/inter.woff2', WOFF2)
    seed(SHEET, faceRule('Inter', 'fonts/inter.woff2', '100 900'))

    expect(listProjectFaces(ROOT)).toEqual([
      {
        family: 'Inter',
        weight: '100 900',
        style: 'normal',
        sheet: SHEET,
        file: 'fonts/inter.woff2',
        present: true,
      },
    ])
  })

  it('should report a rule naming a missing file as absent rather than throwing', () => {
    seed(SHEET, faceRule('Inter', 'fonts/gone.woff2'))

    expect(listProjectFaces(ROOT)).toMatchObject([
      { family: 'Inter', present: false, problem: 'missing' },
    ])
  })

  it('should list nothing where the project folder is absent', () => {
    expect(listProjectFaces(ROOT)).toEqual([])
  })

  it('should list a face carried as a data URI as present', () => {
    seed(SHEET, faceRule('Inter', 'data:font/woff2;base64,AAAA'))

    expect(listProjectFaces(ROOT)).toMatchObject([
      { family: 'Inter', file: 'data:', present: true },
    ])
  })
})

describe('inlineProjectFaces', () => {
  it('should inline a face inside the project folder as a data URI', () => {
    seed('.claude/design/project/fonts/inter.woff2', WOFF2)
    const css = faceRule('Inter', 'fonts/inter.woff2')

    const result = inlineProjectFaces(ROOT, SHEET, css)

    expect(result.css).toContain(
      `url('data:font/woff2;base64,${WOFF2.toString('base64')}')`,
    )
    expect(result.dropped).toEqual([])
    expect(result.declared).toEqual(['Inter'])
  })

  it('should drop a rule whose file is missing and keep the rest of the sheet', () => {
    const css = `${faceRule('Inter', 'fonts/gone.woff2')}:root { --x: 1; }`

    const result = inlineProjectFaces(ROOT, SHEET, css)

    expect(result.css).not.toContain('@font-face')
    expect(result.css).toContain('--x: 1;')
    expect(result.dropped).toEqual([
      { sheet: SHEET, file: 'fonts/gone.woff2', reason: 'missing' },
    ])
  })

  it('should refuse a parent path without reading it', () => {
    const outside = fontFile('secret.woff2')
    const url = relative(join(ROOT, '.claude/design/project'), outside)

    const result = inlineProjectFaces(ROOT, SHEET, faceRule('Inter', url))

    expect(result.css).not.toContain('base64')
    expect(result.dropped).toEqual([
      { sheet: SHEET, file: url, reason: 'outside-folder' },
    ])
  })

  it('should refuse an absolute path', () => {
    const outside = fontFile()

    const result = inlineProjectFaces(ROOT, SHEET, faceRule('Inter', outside))

    expect(result.dropped).toMatchObject([{ reason: 'outside-folder' }])
  })

  it('should refuse a link inside the folder that leads out of it', () => {
    const outside = fontFile()
    mkdirSync(join(ROOT, '.claude/design/project/fonts'), { recursive: true })
    symlinkSync(outside, join(ROOT, '.claude/design/project/fonts/link.woff2'))

    const result = inlineProjectFaces(
      ROOT,
      SHEET,
      faceRule('Inter', 'fonts/link.woff2'),
    )

    expect(result.css).not.toContain('base64')
    expect(result.dropped).toMatchObject([{ reason: 'outside-folder' }])
  })

  it('should leave a data URI and a remote URL as written', () => {
    const css = `${faceRule('A', 'data:font/woff2;base64,AAAA')}${faceRule('B', 'https://example.com/b.woff2')}`

    expect(inlineProjectFaces(ROOT, SHEET, css).css).toBe(css)
  })
})

describe('addProjectFace', () => {
  it('should copy the face and write the sheet on an empty folder', () => {
    const result = addProjectFace(ROOT, fontFile(), { family: 'Inter' })

    expect(result).toMatchObject({ ok: true, file: 'fonts/inter.woff2' })
    expect(
      existsSync(join(ROOT, '.claude/design/project/fonts/inter.woff2')),
    ).toBe(true)
    expect(listProjectFaces(ROOT)).toMatchObject([
      { family: 'Inter', weight: '400', style: 'normal', present: true },
    ])
  })

  it('should append to a sheet that already declares a face', () => {
    seed('.claude/design/project/fonts/inter.woff2', WOFF2)
    seed(SHEET, faceRule('Inter', 'fonts/inter.woff2'))

    addProjectFace(ROOT, fontFile('inter-italic.woff2'), {
      family: 'Inter',
      weight: '100 900',
      style: 'italic',
    })

    expect(listProjectFaces(ROOT)).toMatchObject([
      { family: 'Inter', style: 'normal' },
      { family: 'Inter', weight: '100 900', style: 'italic' },
    ])
  })

  it('should refuse an extension that is not a font', () => {
    const result = addProjectFace(ROOT, fontFile('inter.svg'), {
      family: 'Inter',
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-font' })
    expect(existsSync(join(ROOT, '.claude/design'))).toBe(false)
  })

  it('should refuse a file whose bytes disagree with its extension', () => {
    const result = addProjectFace(
      ROOT,
      fontFile('inter.woff2', Buffer.from('OTTOfake')),
      { family: 'Inter' },
    )

    expect(result).toMatchObject({ ok: false, reason: 'invalid-font' })
  })

  it('should refuse a file name CSS would have to escape', () => {
    const result = addProjectFace(ROOT, fontFile("it's.woff2"), {
      family: 'Inter',
    })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-font' })
    expect(existsSync(join(ROOT, '.claude/design'))).toBe(false)
  })

  it('should refuse a family name CSS would have to escape', () => {
    const result = addProjectFace(ROOT, fontFile(), { family: "Inter'; }" })

    expect(result).toMatchObject({ ok: false, reason: 'invalid-face' })
  })

  it('should refuse a file already in the folder rather than overwrite it', () => {
    seed('.claude/design/project/fonts/inter.woff2', 'kept')

    const result = addProjectFace(ROOT, fontFile(), { family: 'Inter' })

    expect(result).toMatchObject({ ok: false, reason: 'exists' })
    expect(
      readFileSync(
        join(ROOT, '.claude/design/project/fonts/inter.woff2'),
        'utf8',
      ),
    ).toBe('kept')
  })
})
