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
 * Pairs each HTML source with the PNG it renders to. A directory expands to
 * every `.html` directly inside it, so adding a capture is a file drop rather
 * than a flag. Omitting `outDir` writes the PNG beside its source.
 *
 * A `http(s)://` source has no directory to walk and no basename on disk to
 * name the PNG from, so `outDir` there is read as the destination file
 * itself rather than a directory, and the caller is what requires it.
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
 * Whether the first family of a computed `font-family` is a generic keyword.
 * Takes the raw declaration rather than `primaryFontFamily`'s result, since
 * quoting is what separates the keyword from a family that happens to share its
 * name, and the stripped form has lost it. Keywords match case-insensitively.
 */
export function isGenericFamily(declaration: string): boolean {
  const first = declaration.split(',')[0]?.trim() ?? ''
  return GENERIC_FAMILIES.has(first.toLowerCase())
}

/**
 * Reduces the computed `font-family` of each rendered text element to the
 * distinct families a capture has to prove resolved, in document order, so a
 * frame that sets its font on any ancestor of its text is checked against the
 * face the text actually draws in.
 */
export function textFamilies(declarations: readonly string[]): string[] {
  const families = declarations.map(primaryFontFamily).filter(Boolean)
  return [...new Set(families)]
}
