import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs'
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import { primaryFontFamily } from '@/capture/sources'
import { DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR } from '@/design/adapter'

/**
 * A project's own faces, declared as plain `@font-face` rules in its override
 * sheets and stored beside them under `project/`, which sync treats as
 * project-authored by location and never writes. CSS is the declaration
 * format because every consumer already reads it, and reading descriptors
 * out of the font's own tables cannot open WOFF2 without a Brotli parser.
 *
 * A rule's `url()` is read from inside `project/` only, after `realpath`, so
 * an override cannot carry a file from elsewhere on the machine into a frame.
 * A hand-edited sheet reaches this module as often as `addProjectFace` does,
 * so the check sits on the read rather than on the write.
 */

export const PROJECT_FONTS_DIR = 'fonts'
export const PROJECT_FONTS_SHEET = 'fonts.css'

export type FaceProblem = 'missing' | 'outside-folder'

export interface ProjectFace {
  readonly family: string
  /** The `font-weight` descriptor verbatim, `400` where the rule omits it. */
  readonly weight: string
  readonly style: string
  /** Relative to the root. */
  readonly sheet: string
  /** The first local `url()` as the rule writes it. */
  readonly file: string
  readonly present: boolean
  readonly problem?: FaceProblem
}

export interface DroppedFace {
  readonly sheet: string
  readonly file: string
  readonly reason: FaceProblem
}

export interface InlinedSheet {
  readonly css: string
  readonly dropped: readonly DroppedFace[]
  /** The families of the rules that survived, in sheet order. */
  readonly declared: readonly string[]
}

const FORMATS = {
  '.woff2': { mime: 'font/woff2', format: 'woff2', magic: ['wOF2'] },
  '.woff': { mime: 'font/woff', format: 'woff', magic: ['wOFF'] },
  '.ttf': {
    mime: 'font/ttf',
    format: 'truetype',
    magic: ['\u0000\u0001\u0000\u0000', 'true'],
  },
  '.otf': { mime: 'font/otf', format: 'opentype', magic: ['OTTO'] },
} as const

type FontExtension = keyof typeof FORMATS

function isFontExtension(ext: string): ext is FontExtension {
  return Object.hasOwn(FORMATS, ext)
}

const FACE_RULE = /@font-face\s*\{[^}]*\}/g
const URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g
const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const DECLARATION = /([A-Za-z-]+)\s*:\s*([^;}]*)/g

/** Comments blanked to equal length, so an index into the result fits the source. */
function masked(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    ' '.repeat(comment.length),
  )
}

function descriptor(rule: string, name: string): string | undefined {
  const match = rule.match(new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*([^;}]*)`))
  return match?.[1]?.trim()
}

function familyOf(rule: string): string {
  return primaryFontFamily(descriptor(rule, 'font-family') ?? '')
}

/**
 * Every family a declaration value lists, quoted or not, across the sheet
 * outside its `@font-face` rules, which declare a face rather than use one.
 * Reads every property rather than only `font-family`, since a token such as
 * `--figure-hand` names its stack under a name that ends in neither.
 */
export function namedFamilies(css: string): Set<string> {
  const uses = masked(css).replace(FACE_RULE, '')
  const named = new Set<string>()
  for (const [, , value] of uses.matchAll(DECLARATION)) {
    for (const item of (value ?? '').split(',')) {
      const family = primaryFontFamily(item)
      if (family) named.add(family)
    }
  }
  return named
}

function projectDir(root: string): string {
  return join(root, DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR)
}

function isWithin(folder: string, path: string): boolean {
  const inside = relative(folder, path)
  return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside)
}

type Located =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: FaceProblem }

/** Confined lexically before any read, then again after resolving links. */
function locate(root: string, sheet: string, url: string): Located {
  const folder = projectDir(root)
  const clean = url.replace(/[?#].*$/, '')
  if (isAbsolute(clean)) return { ok: false, reason: 'outside-folder' }
  const path = resolve(join(root, dirname(sheet)), clean)
  if (!isWithin(folder, path)) return { ok: false, reason: 'outside-folder' }
  if (!existsSync(path) || !statSync(path).isFile()) {
    return { ok: false, reason: 'missing' }
  }
  if (!isWithin(realpathSync(folder), realpathSync(path))) {
    return { ok: false, reason: 'outside-folder' }
  }
  return { ok: true, path }
}

function localUrls(rule: string): string[] {
  return [...rule.matchAll(URL)]
    .map((match) => match[2]?.trim() ?? '')
    .filter((url) => url !== '' && !SCHEME.test(url))
}

function mimeOf(path: string): string {
  const ext = extname(path).toLowerCase()
  return isFontExtension(ext) ? FORMATS[ext].mime : 'application/octet-stream'
}

/**
 * Rewrites each local `url()` in a sheet's `@font-face` rules to a `data:`
 * URI, so a frame carries the face rather than a path the frame's origin
 * cannot serve. A rule naming a file that is missing or leads out of
 * `project/` is dropped whole and reported, and the sheet otherwise renders.
 * A `data:` or remote URL is left as written.
 */
export function inlineProjectFaces(
  root: string,
  sheet: string,
  css: string,
): InlinedSheet {
  const dropped: DroppedFace[] = []
  const declared: string[] = []
  let out = ''
  let cursor = 0
  for (const match of masked(css).matchAll(FACE_RULE)) {
    const start = match.index
    const end = start + match[0].length
    const rule = css.slice(start, end)
    out += css.slice(cursor, start)
    cursor = end

    const urls = localUrls(match[0])
    const located = urls.map((url) => ({ url, at: locate(root, sheet, url) }))
    const failed = located.find(({ at }) => !at.ok)
    if (failed && !failed.at.ok) {
      dropped.push({ sheet, file: failed.url, reason: failed.at.reason })
      continue
    }
    let inlined = rule
    for (const { url, at } of located) {
      if (!at.ok) continue
      const data = `data:${mimeOf(at.path)};base64,${readFileSync(at.path).toString('base64')}`
      inlined = inlined.replace(url, data)
    }
    out += inlined
    declared.push(familyOf(match[0]))
  }
  return { css: out + css.slice(cursor), dropped, declared }
}

/** The project's override sheets, root-relative, in the order a frame cascades them. */
export function projectSheets(root: string): string[] {
  const folder = projectDir(root)
  if (!existsSync(folder)) return []
  return readdirSync(folder)
    .filter((name) => name.endsWith('.css'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => join(DESIGN_INSTALL_DIR, DESIGN_PROJECT_SUBDIR, name))
}

/** Every face the override sheets declare, without reading a font file. */
export function listProjectFaces(root: string): ProjectFace[] {
  return projectSheets(root).flatMap((sheet) => {
    const css = masked(readFileSync(join(root, sheet), 'utf8'))
    return [...css.matchAll(FACE_RULE)].map((match): ProjectFace => {
      const rule = match[0]
      const local = localUrls(rule)[0]
      const external = [...rule.matchAll(URL)][0]?.[2]?.trim() ?? ''
      /*
       * A rule carrying its face inline or remotely has no file to read, and
       * the frame keeps it as written, so it lists as present. A `data:` URI
       * is shortened to its scheme rather than echoing the whole face.
       */
      const file = local ?? (external.startsWith('data:') ? 'data:' : external)
      const at: Located = local
        ? locate(root, sheet, local)
        : external
          ? { ok: true, path: external }
          : { ok: false, reason: 'missing' }
      return {
        family: familyOf(rule),
        weight: descriptor(rule, 'font-weight') ?? '400',
        style: descriptor(rule, 'font-style') ?? 'normal',
        sheet,
        file,
        present: at.ok,
        ...(!at.ok && { problem: at.reason }),
      }
    })
  })
}

export interface FaceSpec {
  readonly family: string
  readonly weight?: string
  readonly style?: string
}

export type AddOutcome =
  | {
      readonly ok: true
      readonly family: string
      readonly weight: string
      readonly style: string
      /** Relative to the sheet's folder, as the rule writes it. */
      readonly file: string
      readonly sheet: string
    }
  | {
      readonly ok: false
      readonly reason: 'invalid-font' | 'invalid-face' | 'exists'
      readonly detail: string
    }

/** A name CSS takes inside single quotes with no escaping. */
const SAFE_FAMILY = /^[A-Za-z0-9][A-Za-z0-9 _-]*$/
/** A file name a single-quoted `url()` takes with no escaping. */
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const WEIGHT = /^\d{1,4}( \d{1,4})?$/

function weightInRange(weight: string): boolean {
  return weight.split(' ').every((n) => Number(n) >= 1 && Number(n) <= 1000)
}

/**
 * Copies a face into `project/fonts/` and appends one rule for it to
 * `project/fonts.css`. Refuses before writing anything when the extension is
 * not a font, the bytes disagree with it, a descriptor would need escaping,
 * or the folder already holds a file of that name.
 */
export function addProjectFace(
  root: string,
  source: string,
  spec: FaceSpec,
): AddOutcome {
  const name = basename(source)
  const ext = extname(name).toLowerCase()
  if (!isFontExtension(ext)) {
    return {
      ok: false,
      reason: 'invalid-font',
      detail: `${name} is not a font. Use woff2, woff, ttf, or otf`,
    }
  }
  if (!SAFE_FILE.test(name)) {
    return {
      ok: false,
      reason: 'invalid-font',
      detail: `${name} must be letters, digits, dots, dashes, or underscores to sit in a url(). Rename it`,
    }
  }
  if (!existsSync(source) || !statSync(source).isFile()) {
    return { ok: false, reason: 'invalid-font', detail: `${source} not found` }
  }
  const head = readFileSync(source).subarray(0, 4).toString('binary')
  if (!FORMATS[ext].magic.some((magic) => head === magic)) {
    return {
      ok: false,
      reason: 'invalid-font',
      detail: `${name} does not read as ${ext.slice(1)} from its first bytes`,
    }
  }

  const weight = spec.weight ?? '400'
  const style = spec.style ?? 'normal'
  if (!SAFE_FAMILY.test(spec.family)) {
    return {
      ok: false,
      reason: 'invalid-face',
      detail: `family ${spec.family} must be letters, digits, spaces, dashes, or underscores`,
    }
  }
  if (!WEIGHT.test(weight) || !weightInRange(weight)) {
    return {
      ok: false,
      reason: 'invalid-face',
      detail: `weight ${weight} must be one number or a range of two, from 1 to 1000`,
    }
  }
  if (style !== 'normal' && style !== 'italic') {
    return {
      ok: false,
      reason: 'invalid-face',
      detail: `style ${style} must be normal or italic`,
    }
  }

  const folder = join(projectDir(root), PROJECT_FONTS_DIR)
  const dest = join(folder, name)
  const file = `${PROJECT_FONTS_DIR}/${name}`
  if (existsSync(dest)) {
    return {
      ok: false,
      reason: 'exists',
      detail: `${relative(root, dest)} already exists. Remove it or rename the source`,
    }
  }

  mkdirSync(folder, { recursive: true })
  copyFileSync(source, dest)
  const sheetPath = join(projectDir(root), PROJECT_FONTS_SHEET)
  const lead =
    existsSync(sheetPath) && readFileSync(sheetPath, 'utf8').trim() !== ''
      ? '\n'
      : ''
  appendFileSync(
    sheetPath,
    `${lead}@font-face {
  font-family: '${spec.family}';
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
  src: url('${file}') format('${FORMATS[ext].format}');
}
`,
  )
  return {
    ok: true,
    family: spec.family,
    weight,
    style,
    file,
    sheet: relative(root, sheetPath),
  }
}
