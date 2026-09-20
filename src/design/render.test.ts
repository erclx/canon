import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RenderOptions } from '@/design/render'
import { renderDesignDoc } from '@/design/render'

let root: string

interface Rendered {
  css: string
  html: string
}

const render = (body: string, options?: RenderOptions): Rendered => {
  const source = join(root, 'DESIGN.md')
  writeFileSync(source, body)
  const result = renderDesignDoc(source, join(root, 'out'), options)
  return {
    css: readFileSync(result.cssPath, 'utf8'),
    html: readFileSync(result.htmlPath, 'utf8'),
  }
}

const doc = (sections: string[]): string =>
  ['# Design', '', ...sections, ''].join('\n')

const colorTable = (rows: string[]): string[] => [
  '## Color',
  '',
  '| Role | Intent | Value |',
  '| ---- | ------ | ----- |',
  ...rows,
  '',
]

const bordersTable = (rows: string[]): string[] => [
  '## Borders',
  '',
  '| Role | Radius | Width | When used |',
  '| ---- | ------ | ----- | --------- |',
  ...rows,
  '',
]

const spacingTable = (rows: string[]): string[] => [
  '## Spacing',
  '',
  '| Step | Multiplier | Value |',
  '| ---- | ---------- | ----- |',
  ...rows,
  '',
]

const typographyTable = (rows: string[]): string[] => [
  '## Typography',
  '',
  '| Role | Family | Weight | Size | Line height |',
  '| ---- | ------ | ------ | ---- | ----------- |',
  ...rows,
  '',
]

const GEIST_STACK = 'Geist Variable, DejaVu Sans, sans-serif'

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'design-render-'))
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('renderDesignDoc', () => {
  it('should emit a custom property carrying the value without its tag', () => {
    const { css } = render(
      doc(colorTable(['| border | panel edges | #E4DCD0 ? verify |'])),
    )

    expect(css).toContain('--color-border: #E4DCD0;')
    expect(css).not.toContain('verify')
  })

  it('should keep the tag out of a custom property written in a code span', () => {
    const { css } = render(
      doc(colorTable(['| border | panel edges | `#E4DCD0 ? verify` |'])),
    )

    expect(css).not.toContain('verify')
  })

  it('should build the swatch from the value alone', () => {
    const { html } = render(
      doc(colorTable(['| border | panel edges | #E4DCD0 ? verify |'])),
    )

    expect(html).toContain(
      '<span class="swatch" style="background:#E4DCD0"></span>',
    )
  })

  it('should declare a favicon in the head', () => {
    const { html } = render(
      doc(colorTable(['| border | panel edges | #E4DCD0 |'])),
    )

    expect(html).toContain('rel="icon"')
  })

  it('should show the marker beside the value rather than inside it', () => {
    const { html } = render(
      doc(colorTable(['| border | panel edges | #E4DCD0 ? verify |'])),
    )

    expect(html).toContain(
      '<code>#E4DCD0</code> <span class="verify" title="No source anchors this value">? verify</span>',
    )
  })

  it('should mark a tagged cell in a column that is not the value column', () => {
    const { html } = render(
      doc(
        bordersTable([
          '| pill | 999px ? verify | none ? verify | status chips |',
        ]),
      ),
    )

    expect(html).toContain(
      '<code>999px</code> <span class="verify" title="No source anchors this value">? verify</span>',
    )
    expect(html).toContain(
      '<code>none</code> <span class="verify" title="No source anchors this value">? verify</span>',
    )
  })

  it('should report the anchored count against the tagged count', () => {
    const { html } = render(
      doc(
        colorTable([
          '| accent | primary action | #e0724b |',
          '| border | panel edges | #E4DCD0 ? verify |',
        ]),
      ),
    )

    expect(html).toContain(
      '3 of 4 cells are anchored to a source. The other 1 carries <code>? verify</code>',
    )
  })

  it('should leave a row name out of the ratio', () => {
    const { html } = render(
      doc(colorTable(['| accent | primary action | #e0724b ? verify |'])),
    )

    expect(html).toContain('1 of 2 cells are anchored to a source.')
  })

  it('should leave a multiplier and a when-used cell out of the ratio', () => {
    const { html } = render(
      doc([
        ...spacingTable(['| xs | 1 | 6px ? verify |']),
        ...bordersTable(['| panel | 10px | 1px | cards |']),
      ]),
    )

    expect(html).toContain('2 of 3 cells are anchored to a source.')
  })

  it('should count a cell tagged outside the anchorable columns', () => {
    const { html } = render(doc(spacingTable(['| xs ? verify | 1 | 6px |'])))

    expect(html).toContain('1 of 2 cells are anchored to a source.')
  })

  it('should count a blank cell as neither anchored nor tagged', () => {
    const { html } = render(
      doc(
        colorTable([
          '| accent | primary action |  |',
          '| border | panel edges | #E4DCD0 ? verify |',
        ]),
      ),
    )

    expect(html).toContain('2 of 3 cells are anchored to a source.')
  })

  it('should pluralize the tagged count when more than one cell carries a tag', () => {
    const { html } = render(
      doc(
        colorTable([
          '| accent | primary action | #e0724b ? verify |',
          '| border | panel edges | #E4DCD0 ? verify |',
        ]),
      ),
    )

    expect(html).toContain('The other 2 carry <code>? verify</code>')
  })

  it('should add nothing to a record where no cell carries a tag', () => {
    const { css, html } = render(
      doc([
        ...colorTable(['| accent | primary action | #e0724b |']),
        ...bordersTable(['| panel | 10px | 1px | cards |']),
      ]),
    )

    expect(html).not.toContain('verify')
    expect(html).not.toContain('anchored to a source')
    expect(html).toContain(
      '  .empty { color: var(--preview-muted); font-style: italic; }\n</style>',
    )
    expect(css).toContain('--color-accent: #e0724b;')
  })

  describe('with embedded fonts', () => {
    const embed = { embedFonts: true }
    const geistDoc = doc(
      typographyTable([
        `| heading | ${GEIST_STACK} | 700 | 1.4rem | 1.3 |`,
        `| body | ${GEIST_STACK} | 400 | 1rem | 1.6 |`,
      ]),
    )

    it('should declare one face block for a vendored family the typography names', () => {
      const { css } = render(geistDoc, embed)

      expect(css.match(/@font-face/g)).toHaveLength(1)
      expect(css).toContain("font-family: 'Geist Variable';")
    })

    it('should block rather than swap while the face loads', () => {
      const { css } = render(geistDoc, embed)

      expect(css).toContain('font-display: block;')
    })

    it('should set the body to the body role stack', () => {
      const { html } = render(geistDoc, embed)

      expect(html).toContain(`body { font-family: ${GEIST_STACK};`)
    })

    it('should keep a family carrying markup out of the style block', () => {
      const { html } = render(
        doc(
          typographyTable([
            '| body | Geist Variable, </style><script> | 400 | 1rem | 1.6 |',
          ]),
        ),
        embed,
      )

      expect(html).toContain('body { font-family: system-ui, sans-serif;')
    })

    it('should declare no face for a doc naming no vendored family', () => {
      const { css, html } = render(
        doc(typographyTable(['| body | Georgia, serif | 400 | 1rem | 1.6 |'])),
        embed,
      )

      expect(css).not.toContain('@font-face')
      expect(html).toContain('body { font-family: system-ui, sans-serif;')
    })
  })

  it('should leave the output byte-identical unless embedding is asked for', () => {
    const body = doc(
      typographyTable([`| body | ${GEIST_STACK} | 400 | 1rem | 1.6 |`]),
    )

    const plain = render(body)
    const explicitOff = render(body, { embedFonts: false })

    expect(plain.css).not.toContain('@font-face')
    expect(plain.html).toContain('body { font-family: system-ui, sans-serif;')
    expect(explicitOff).toEqual(plain)
  })
})
