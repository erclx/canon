import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Each component keeps its markup in `index.astro` and its style, script, and
 * icons in files beside it, so a block written back into an Astro file fails
 * here by file and line. Generated CSS and the pre-paint script stay inline
 * under `is:inline`, a JSON data island under `type="application/json"`, and
 * a script loading its file through `src` carries no body.
 */
interface Finding {
  line: number
  kind: 'style' | 'script' | 'svg'
}

const lineOf = (source: string, index: number) =>
  source.slice(0, index).split('\n').length

const findInlineMarkup = (source: string): Finding[] => {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, (front) =>
    front.replace(/[^\n]/g, ' '),
  )
  const findings: Finding[] = []
  for (const match of body.matchAll(/<style\b([^>]*)>/g)) {
    if (!/\bis:inline\b/.test(match[1] ?? '')) {
      findings.push({ line: lineOf(body, match.index), kind: 'style' })
    }
  }
  for (const match of body.matchAll(
    /<script\b([^>]*?)(\/>|>([\s\S]*?)<\/script>)/g,
  )) {
    const attributes = match[1] ?? ''
    const allowed =
      /\bis:inline\b/.test(attributes) ||
      /type="application\/json"/.test(attributes)
    if (!allowed && (match[3] ?? '').trim() !== '') {
      findings.push({ line: lineOf(body, match.index), kind: 'script' })
    }
  }
  for (const match of body.matchAll(/<svg\b/g)) {
    findings.push({ line: lineOf(body, match.index), kind: 'svg' })
  }
  return findings
}

const srcRoot = join(import.meta.dirname, '..')

const astroFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return astroFiles(path)
    return entry.name.endsWith('.astro') ? [path] : []
  })

describe('findInlineMarkup', () => {
  it('should flag a style block written in the markup', () => {
    const source =
      '<p>hi</p>\n<style is:global>\n  p { color: red; }\n</style>\n'

    expect(findInlineMarkup(source)).toEqual([{ line: 2, kind: 'style' }])
  })

  it('should allow a generated inline style', () => {
    const source = '<style is:inline set:html={fontFace}></style>\n'

    expect(findInlineMarkup(source)).toEqual([])
  })

  it('should flag a bare script body', () => {
    const source = '<p>hi</p>\n<script>\n  console.log(1)\n</script>\n'

    expect(findInlineMarkup(source)).toEqual([{ line: 2, kind: 'script' }])
  })

  it('should allow a script loading its file through src', () => {
    const source = '<script src="./client.ts"></script>\n'

    expect(findInlineMarkup(source)).toEqual([])
  })

  it('should allow an inline script and a JSON data island', () => {
    const source = [
      '<script is:inline>',
      '  document.documentElement.dataset.theme = "dark"',
      '</script>',
      '<script type="application/json" set:html={data} />',
    ].join('\n')

    expect(findInlineMarkup(source)).toEqual([])
  })

  it('should flag inline svg on its own line', () => {
    const source =
      '<span>\n  <svg viewBox="0 0 24 24"><path d="M0 0" /></svg>\n</span>\n'

    expect(findInlineMarkup(source)).toEqual([{ line: 2, kind: 'svg' }])
  })

  it('should read a line past the frontmatter at its place in the file', () => {
    const source = "---\nimport './style.css'\n---\n\n<style>\n</style>\n"

    expect(findInlineMarkup(source)).toEqual([{ line: 5, kind: 'style' }])
  })

  it('should ignore a tag named inside the frontmatter', () => {
    const source = "---\nconst note = '<svg> stays out'\n---\n<p>hi</p>\n"

    expect(findInlineMarkup(source)).toEqual([])
  })
})

describe('the page source', () => {
  const files = astroFiles(srcRoot)

  it('should find the Astro files it guards', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('should carry no style, script body, or svg inline in an Astro file', () => {
    const findings = files.flatMap((file) =>
      findInlineMarkup(readFileSync(file, 'utf8')).map(
        (finding) =>
          `${relative(srcRoot, file)}:${finding.line} ${finding.kind}`,
      ),
    )

    expect(findings).toEqual([])
  })
})
