import { readdirSync, statSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

const URL_SOURCE = /^https?:\/\//

/**
 * The one test for whether a source string names a URL rather than a
 * filesystem path, shared with `src/commands/capture.ts` so the two never
 * drift apart on what counts as a URL source.
 */
export function isUrlSource(source: string): boolean {
  return URL_SOURCE.test(source)
}

export type CaptureSource =
  | {
      readonly kind: 'file'
      readonly htmlPath: string
      readonly pngPath: string
    }
  | { readonly kind: 'url'; readonly url: string; readonly pngPath: string }

/**
 * Pairs each HTML source with the PNG it renders to. A directory expands to every
 * `.html` directly inside it, and omitting `outDir` writes the PNG beside its
 * source. A `http(s)://` source has no basename, so `outDir` there is the destination file.
 */
export function resolveCaptureSources(
  sourcePath: string,
  outDir?: string,
): CaptureSource[] {
  if (isUrlSource(sourcePath)) {
    if (!outDir) {
      throw new Error('a URL source needs --out naming the destination PNG')
    }
    return [{ kind: 'url', url: sourcePath, pngPath: outDir }]
  }

  const htmlPaths = statSync(sourcePath).isDirectory()
    ? readdirSync(sourcePath)
        .filter((name) => extname(name) === '.html')
        .sort()
        .map((name) => join(sourcePath, name))
    : [sourcePath]

  return htmlPaths.map((htmlPath) => ({
    kind: 'file',
    htmlPath,
    pngPath: join(
      outDir ?? dirname(htmlPath),
      `${basename(htmlPath, '.html')}.png`,
    ),
  }))
}

/**
 * Reads the first family from a computed `font-family` value, which is the font
 * the source asks for and the one a capture has to prove resolved. Quoting is
 * the source's choice, so both spellings arrive here.
 */
export function primaryFontFamily(declaration: string): string {
  const first = declaration.split(',')[0]?.trim() ?? ''
  return first.replace(/^['"]|['"]$/g, '')
}

/**
 * The CSS generic family keywords. A generic names no font, so each machine
 * maps it to whatever it has, and a capture measured against one cannot
 * reproduce on another.
 */
export const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
])

/**
 * Whether the first family of a computed `font-family` is a generic keyword. It
 * takes the raw declaration, since quoting separates the keyword from a family
 * sharing its name. Keywords match case-insensitively.
 */
export function isGenericFamily(declaration: string): boolean {
  const first = declaration.split(',')[0]?.trim() ?? ''
  return GENERIC_FAMILIES.has(first.toLowerCase())
}

/**
 * Reduces each rendered text element's computed `font-family` to the distinct
 * families a capture has to prove resolved, in document order, so a font set on
 * any ancestor is checked against the face the text draws in.
 */
export function textFamilies(declarations: readonly string[]): string[] {
  const families = declarations.map(primaryFontFamily).filter(Boolean)
  return [...new Set(families)]
}

export interface TextStyle {
  readonly fontFamily: string
  readonly fontWeight: string
  readonly fontStyle: string
}

export interface TextFace {
  readonly family: string
  readonly weight: string
  readonly style: 'normal' | 'italic' | 'oblique'
}

/** Faces as drawn, since an unused declared face never loads, minus an oblique angle a canvas font may not parse. */
export function textFaces(styles: readonly TextStyle[]): TextFace[] {
  const faces = new Map<string, TextFace>()
  for (const { fontFamily, fontWeight, fontStyle } of styles) {
    const family = primaryFontFamily(fontFamily)
    if (family === '') continue
    const face: TextFace = {
      family,
      weight: fontWeight,
      style: faceStyle(fontStyle),
    }
    const key = `${face.style} ${face.weight} ${face.family}`
    if (!faces.has(key)) faces.set(key, face)
  }
  return [...faces.values()]
}

function faceStyle(computed: string): TextFace['style'] {
  if (computed.startsWith('italic')) return 'italic'
  if (computed.startsWith('oblique')) return 'oblique'
  return 'normal'
}
