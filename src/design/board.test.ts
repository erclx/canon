import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateBoard, WIREFRAME_DIR } from '@/design/board'
import { DESIGN_DOCUMENT } from '@/design/regen'

let root: string
let outDir: string

function seed(relativePath: string, body: string): void {
  const full = join(root, relativePath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, body)
}

/** The ordinary call: the caller stands in the same tree the board describes. */
function generate(dir: string) {
  return generateBoard(root, dir, root)
}

const MINIMAL_DESIGN_DOC = [
  '## Personality',
  '',
  'Plain and quiet.',
  '',
  '## Color',
  '',
  '| Role | Intent | Value |',
  '| --- | --- | --- |',
  '| background | Page background | #ffffff |',
  '',
].join('\n')

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-board-'))
  outDir = join(root, 'board-out')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('generateBoard', () => {
  it('writes an index and one page per panel', () => {
    const result = generate(outDir)

    if (!result.ok) throw new Error('expected generateBoard to succeed')
    expect(result.outDir).toBe(outDir)
    expect(existsSync(result.indexPath)).toBe(true)
    expect(result.panels.map((panel) => panel.id)).toEqual([
      'tokens',
      'surfaces',
      'wireframes',
      'candidates',
      'components',
    ])
    for (const panel of result.panels) {
      expect(existsSync(join(outDir, panel.path))).toBe(true)
    }
  })

  it('refuses an --out that would delete the project root', () => {
    const result = generate(root)

    expect(result).toEqual({
      ok: false,
      reason: 'unsafe-out',
      detail: `${root} is or contains ${root} or ${root}. Refusing to clear it.`,
    })
  })

  it('refuses an --out that contains the project root', () => {
    const ancestor = join(root, '..')

    const result = generate(ancestor)

    expect(result).toEqual({
      ok: false,
      reason: 'unsafe-out',
      detail: `${ancestor} is or contains ${root} or ${root}. Refusing to clear it.`,
    })
  })

  it('refuses an --out that would delete the caller cwd, even in a second checkout', () => {
    const otherCheckout = mkdtempSync(join(tmpdir(), 'canon-board-cwd-'))
    try {
      const result = generateBoard(root, otherCheckout, otherCheckout)

      expect(result).toEqual({
        ok: false,
        reason: 'unsafe-out',
        detail: `${otherCheckout} is or contains ${root} or ${otherCheckout}. Refusing to clear it.`,
      })
    } finally {
      rmSync(otherCheckout, { recursive: true, force: true })
    }
  })

  it('clears a previous run before writing the new one', () => {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'stale.html'), 'stale')

    generate(outDir)

    expect(existsSync(join(outDir, 'stale.html'))).toBe(false)
  })

  it('renders the tokens panel from an existing DESIGN.md', () => {
    seed(DESIGN_DOCUMENT, MINIMAL_DESIGN_DOC)

    generate(outDir)

    const html = readFileSync(join(outDir, 'tokens', 'index.html'), 'utf8')
    expect(html).toContain('background')
  })

  it('reports a missing DESIGN.md rather than rendering a broken frame', () => {
    generate(outDir)

    const html = readFileSync(join(outDir, 'tokens', 'index.html'), 'utf8')
    expect(html).toContain('No .claude/DESIGN.md')
  })

  it('renders a wireframe file as-is inside a pre block', () => {
    seed(join(WIREFRAME_DIR, 'landing-page.md'), '# Landing\n\nOne column.')

    generate(outDir)

    const html = readFileSync(join(outDir, 'wireframes', 'index.html'), 'utf8')
    expect(html).toContain('<pre># Landing')
    expect(html).toContain('One column.')
  })

  it('names a missing wireframe file rather than omitting it', () => {
    generate(outDir)

    const html = readFileSync(join(outDir, 'wireframes', 'index.html'), 'utf8')
    expect(html).toContain('slides.md')
    expect(html).toContain('Missing from')
  })

  it('iframes the built landing page when web/dist exists', () => {
    seed(join('web', 'dist', 'index.html'), '<h1>Landing</h1>')

    generate(outDir)

    const html = readFileSync(join(outDir, 'surfaces', 'index.html'), 'utf8')
    expect(html).toContain('landing/index.html')
    expect(existsSync(join(outDir, 'surfaces', 'landing', 'index.html'))).toBe(
      true,
    )
  })

  it('reports a missing web build rather than an empty frame', () => {
    generate(outDir)

    const html = readFileSync(join(outDir, 'surfaces', 'index.html'), 'utf8')
    expect(html).toContain('bun run web:build')
  })

  it('reports the teach panel empty when .canon/teach is absent', () => {
    generate(outDir)

    const html = readFileSync(join(outDir, 'surfaces', 'index.html'), 'utf8')
    expect(html).toContain('gitignored and machine-local')
  })

  it('iframes a teach workspace when .canon/teach carries a rendered root', () => {
    seed(join('.canon', 'teach', 'index.html'), '<h1>Workspaces</h1>')

    generate(outDir)

    const html = readFileSync(join(outDir, 'surfaces', 'index.html'), 'utf8')
    expect(html).toContain('teach/index.html')
  })

  it('reports the candidates panel empty when no arm capture exists', () => {
    seed(join('.canon', 'review', 'evidence', 'hero-probe', 'notes.md'), 'x')

    generate(outDir)

    const html = readFileSync(join(outDir, 'candidates', 'index.html'), 'utf8')
    expect(html).toContain('none carries a draft-and-pick arm capture')
  })

  it('renders an arm capture image when the evidence corpus carries one', () => {
    seed(join('.canon', 'review', 'evidence', 'hero-probe', 'arm-a.png'), 'x')

    generate(outDir)

    const html = readFileSync(join(outDir, 'candidates', 'index.html'), 'utf8')
    expect(html).toContain('hero-probe/arm-a.png')
    expect(
      existsSync(join(outDir, 'candidates', 'hero-probe', 'arm-a.png')),
    ).toBe(true)
  })

  it('reports a missing gallery build rather than an empty frame', () => {
    generate(outDir)

    const html = readFileSync(join(outDir, 'components', 'index.html'), 'utf8')
    expect(html).toContain('bun run web:gallery')
  })

  it('iframes the built gallery when web/gallery-dist exists', () => {
    seed(join('web', 'gallery-dist', 'index.html'), '<h2>agent-view</h2>')

    generate(outDir)

    const html = readFileSync(join(outDir, 'components', 'index.html'), 'utf8')
    expect(html).toContain('gallery/index.html')
    expect(
      existsSync(join(outDir, 'components', 'gallery', 'index.html')),
    ).toBe(true)
  })
})
