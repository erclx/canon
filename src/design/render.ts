import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Cell, DesignDoc, Row } from '@/design/parse'
import { parseDesignDoc } from '@/design/parse'
import { fontFaceBlock } from '@/design/css'
import type { FontFace } from '@/design/fonts'
import { FONT_FACES } from '@/design/fonts'
import { colorValue } from '@/design/tokens'

export interface RenderResult {
  htmlPath: string
  cssPath: string
}

/**
 * The same path data as `assets/brand/mark.svg`, colored via `colorValue`
 * since a data URI has no CSS context to resolve `currentColor` against and
 * this page renders on the light chrome `previewChrome()` sets up.
 */
const FAVICON_COLOR = colorValue('light-accent') ?? '#a4471c'
const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 80 80"><path d="M34,20 L15,28 L15,72 L34,80 Z M66,20 L85,28 L85,72 L66,80 Z" fill="${FAVICON_COLOR}" /><rect x="44" y="15" width="12" height="70" rx="2" fill="${FAVICON_COLOR}" /></svg>`,
)}`

export interface RenderOptions {
  /**
   * Declare each vendored face the typography table names, and let the page
   * body take the body role's stack. Off by default, since a face is a large
   * base64 block a target's render would otherwise grow by unasked.
   */
  readonly embedFonts?: boolean
}

export function renderDesignDoc(
  sourcePath: string,
  outDir: string,
  options: RenderOptions = {},
): RenderResult {
  const doc = parseDesignDoc(sourcePath)
  mkdirSync(outDir, { recursive: true })
  const cssPath = join(outDir, 'design.css')
  const htmlPath = join(outDir, 'index.html')
  const faces = options.embedFonts ? namedFaces(doc) : []
  writeFileSync(cssPath, buildCss(doc, faces))
  writeFileSync(htmlPath, buildHtml(doc, bodyFamily(doc, faces)))
  return { htmlPath, cssPath }
}

/** The vendored faces whose family appears in a typography `Family` cell. */
function namedFaces(doc: DesignDoc): FontFace[] {
  const named = new Set(
    doc.typography.flatMap((row) =>
      val(row, 'Family')
        .split(',')
        .map((family) => family.trim().replace(/^['"]|['"]$/g, '')),
    ),
  )
  return FONT_FACES.filter((face) => named.has(face.family))
}

/** A stack lands raw in a `<style>` block, where HTML escaping does nothing. */
const SAFE_STACK = /^[\w\s,'"-]+$/

/** The stack the body role names, once a face for it is embedded. */
function bodyFamily(doc: DesignDoc, faces: readonly FontFace[]): string {
  if (!faces.length) return 'system-ui, sans-serif'
  const row =
    doc.typography.find((r) => slug(val(r, 'Role')) === 'body') ??
    doc.typography[0]
  const family = val(row, 'Family')
  return SAFE_STACK.test(family) ? family : 'system-ui, sans-serif'
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function cell(row: Row, key: string): Cell {
  return row[key] ?? { value: '', tagged: false }
}

/** The value alone. Every swatch, sample, and custom property is built from it. */
function val(row: Row, key: string): string {
  return cell(row, key).value
}

/** The marker, rendered beside a value rather than inside it. */
function mark(row: Row, key: string): string {
  return cell(row, key).tagged
    ? ' <span class="verify" title="No source anchors this value">? verify</span>'
    : ''
}

/** A displayed cell: its escaped text, then its marker when it carries one. */
function cellText(row: Row, key: string): string {
  return escape(val(row, key)) + mark(row, key)
}

interface Confidence {
  tagged: number
  total: number
}

/**
 * The columns the confidence ratio reads, fixed by `standards/design.md`. The
 * first column of each table names its row, and `Multiplier` and `When used`
 * restate what the row already carries, so none of them is something a source
 * could anchor and none belongs in the denominator.
 */
const ANCHORABLE = {
  borders: ['Radius', 'Width'],
  color: ['Intent', 'Value'],
  spacing: ['Value'],
  typography: ['Family', 'Weight', 'Size', 'Line height'],
} as const

/**
 * A cell counts when it carries a tag, or when it holds a value in a column a
 * source could anchor. A blank the record left unfilled is neither, and so is a
 * row name. Counting a tagged cell whichever column it sits in is what keeps a
 * marker the preview draws from sitting outside the ratio printed beside it.
 */
function confidence(doc: DesignDoc): Confidence {
  const tables: ReadonlyArray<readonly [Row[], readonly string[]]> = [
    [doc.color, ANCHORABLE.color],
    [doc.typography, ANCHORABLE.typography],
    [doc.spacing, ANCHORABLE.spacing],
    [doc.borders, ANCHORABLE.borders],
  ]
  let tagged = 0
  let total = 0
  for (const [rows, columns] of tables) {
    for (const row of rows) {
      for (const [key, c] of Object.entries(row)) {
        if (!c.tagged && (!c.value || !columns.includes(key))) continue
        total += 1
        if (c.tagged) tagged += 1
      }
    }
  }
  return { tagged, total }
}

function buildCss(doc: DesignDoc, faces: readonly FontFace[]): string {
  const lines: string[] = [':root {']
  for (const row of doc.color) {
    if (val(row, 'Value')) {
      lines.push(`  --color-${slug(val(row, 'Role'))}: ${val(row, 'Value')};`)
    }
  }
  for (const row of doc.spacing) {
    if (val(row, 'Value')) {
      lines.push(`  --space-${slug(val(row, 'Step'))}: ${val(row, 'Value')};`)
    }
  }
  for (const row of doc.typography) {
    if (val(row, 'Size')) {
      lines.push(
        `  --type-${slug(val(row, 'Role'))}-size: ${val(row, 'Size')};`,
      )
    }
    if (val(row, 'Line height')) {
      lines.push(
        `  --type-${slug(val(row, 'Role'))}-lh: ${val(row, 'Line height')};`,
      )
    }
  }
  for (const row of doc.borders) {
    if (val(row, 'Radius')) {
      lines.push(`  --radius-${slug(val(row, 'Role'))}: ${val(row, 'Radius')};`)
    }
  }
  lines.push('}')
  const root = lines.join('\n') + '\n'
  return faces.length ? `${fontFaceBlock(faces, 'block')}\n\n${root}` : root
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The preview page's own chrome, read off the toolkit's design source rather
 * than written as literals here.
 *
 * It takes a `--preview-` prefix rather than the `--color-` one the sheet beside
 * it emits, because that sheet is built from whichever document is being
 * previewed. A target's record is free to declare a role this page also uses,
 * and sharing one name would let the page being previewed repaint the page
 * doing the previewing.
 *
 * The light roles are the ones read, since the preview is a light document.
 */
function previewChrome(): string {
  const roles: ReadonlyArray<readonly [string, string]> = [
    ['paper', 'light-background'],
    ['panel', 'light-surface'],
    ['ink', 'light-text'],
    ['muted', 'light-muted'],
    ['rule', 'light-border'],
    ['accent', 'light-accent'],
  ]

  const lines = roles
    .map(([name, role]) => {
      const value = colorValue(role)
      return value === undefined ? '' : `    --preview-${name}: ${value};`
    })
    .filter((line) => line !== '')

  return ['  :root {', ...lines, '  }'].join('\n')
}

function buildHtml(doc: DesignDoc, bodyStack: string): string {
  const sections = [
    sectionPersonality(doc.personality),
    sectionColor(doc.color),
    sectionTypography(doc.typography),
    sectionSpacing(doc.spacing),
    sectionBorders(doc.borders),
    sectionLine('Motion', doc.motion),
    sectionLine('Iconography', doc.iconography),
  ]
  const { tagged, total } = confidence(doc)
  const verifyStyle = tagged
    ? '\n  .verify { color: var(--preview-accent); font-size: 12px; font-weight: 600; margin-left: 0.35rem; white-space: nowrap; }'
    : ''
  const verb = tagged === 1 ? 'carries' : 'carry'
  const summary = tagged
    ? `\n<p class="note">${total - tagged} of ${total} cells are anchored to a source. The other ${tagged} ${verb} <code>? verify</code>, so nothing anchors them yet.</p>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="icon" href="${FAVICON_HREF}">
<title>Design tokens</title>
<link rel="stylesheet" href="design.css">
<style>
${previewChrome()}
  body { font-family: ${bodyStack}; margin: 2rem; max-width: 960px; color: var(--preview-ink); background: var(--preview-paper); }
  h1 { margin-top: 0; }
  h2 { margin-top: 2rem; border-bottom: 1px solid var(--preview-rule); padding-bottom: 0.25rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--preview-rule); font-size: 14px; }
  th { background: var(--preview-panel); font-weight: 600; }
  .swatch { display: inline-block; width: 1.5rem; height: 1.5rem; border-radius: 4px; border: 1px solid var(--preview-rule); vertical-align: middle; margin-right: 0.5rem; }
  .bar { display: inline-block; height: 1rem; background: var(--preview-muted); border-radius: 2px; vertical-align: middle; }
  .note { color: var(--preview-muted); font-size: 13px; margin-top: 0.5rem; }
  .empty { color: var(--preview-muted); font-style: italic; }${verifyStyle}
</style>
</head>
<body>
<h1>Design tokens</h1>
<p class="note">Generated from <code>canon/DESIGN.md</code> by <code>canon design render</code>. Token preview only, not a screen mock.</p>${summary}
${sections.join('\n')}
</body>
</html>
`
}

function sectionPersonality(text: string): string {
  if (!text) return ''
  return `<h2>Personality</h2>\n<p>${escape(text)}</p>`
}

function sectionColor(rows: Row[]): string {
  if (!rows.length) return ''
  const body = rows
    .map((r) => {
      const value = val(r, 'Value')
      const swatch = value
        ? `<span class="swatch" style="background:${escape(value)}"></span>`
        : '<span class="swatch"></span>'
      const shown = value ? escape(value) : '<span class="empty">unset</span>'
      return `<tr><td>${swatch}${cellText(r, 'Role')}</td><td>${cellText(r, 'Intent')}</td><td><code>${shown}</code>${mark(r, 'Value')}</td></tr>`
    })
    .join('\n')
  return `<h2>Color</h2>\n<table><thead><tr><th>Role</th><th>Intent</th><th>Value</th></tr></thead><tbody>${body}</tbody></table>`
}

function sectionTypography(rows: Row[]): string {
  if (!rows.length) return ''
  const body = rows
    .map((r) => {
      const family = val(r, 'Family') || 'system-ui'
      const weight = val(r, 'Weight') || '400'
      const size = val(r, 'Size') || '16px'
      const lh = val(r, 'Line height') || '1.4'
      const sample = `<span style="font-family:${escape(family)};font-weight:${escape(weight)};font-size:${escape(size)};line-height:${escape(lh)}">The quick brown fox</span>`
      return `<tr><td>${cellText(r, 'Role')}</td><td>${escape(family)}${mark(r, 'Family')}</td><td>${escape(weight)}${mark(r, 'Weight')}</td><td>${escape(size)}${mark(r, 'Size')}</td><td>${escape(lh)}${mark(r, 'Line height')}</td><td>${sample}</td></tr>`
    })
    .join('\n')
  return `<h2>Typography</h2>\n<table><thead><tr><th>Role</th><th>Family</th><th>Weight</th><th>Size</th><th>Line height</th><th>Sample</th></tr></thead><tbody>${body}</tbody></table>`
}

function sectionSpacing(rows: Row[]): string {
  if (!rows.length) return ''
  const body = rows
    .map((r) => {
      const value = val(r, 'Value')
      const bar = value
        ? `<span class="bar" style="width:${escape(value)}"></span>`
        : '<span class="empty">unset</span>'
      return `<tr><td>${cellText(r, 'Step')}</td><td>${cellText(r, 'Multiplier')}</td><td><code>${escape(value || 'unset')}</code>${mark(r, 'Value')}</td><td>${bar}</td></tr>`
    })
    .join('\n')
  return `<h2>Spacing</h2>\n<table><thead><tr><th>Step</th><th>Multiplier</th><th>Value</th><th>Sample</th></tr></thead><tbody>${body}</tbody></table>`
}

function sectionBorders(rows: Row[]): string {
  if (!rows.length) return ''
  const body = rows
    .map((r) => {
      const radius = val(r, 'Radius') || '0'
      const width = val(r, 'Width') || '1px'
      const sample = `<span style="display:inline-block;width:2rem;height:1.5rem;background:#eee;border:${escape(width)} solid #888;border-radius:${escape(radius)};vertical-align:middle"></span>`
      return `<tr><td>${cellText(r, 'Role')}</td><td><code>${escape(radius)}</code>${mark(r, 'Radius')}</td><td><code>${escape(width)}</code>${mark(r, 'Width')}</td><td>${cellText(r, 'When used')}</td><td>${sample}</td></tr>`
    })
    .join('\n')
  return `<h2>Borders</h2>\n<table><thead><tr><th>Role</th><th>Radius</th><th>Width</th><th>When used</th><th>Sample</th></tr></thead><tbody>${body}</tbody></table>`
}

function sectionLine(title: string, text: string): string {
  if (!text) return ''
  return `<h2>${title}</h2>\n<p>${escape(text)}</p>`
}
