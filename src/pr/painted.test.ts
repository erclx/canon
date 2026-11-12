import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PAINTED,
  isPainted,
  loadPaintedPatterns,
  PAINTED_CONFIG_REL,
} from '@/pr/painted'

describe('isPainted', () => {
  it.each([
    'src/App.tsx',
    'web/index.html',
    'src/styles/app.css',
    'assets/logo.png',
    'assets/icon.svg',
    'a/b/c/Card.vue',
    'src/fixtures.tsx',
    'src/myfixtures/page.html',
  ])('should classify %s as painted', (path) => {
    expect(isPainted(path, DEFAULT_PAINTED)).toBe(true)
  })

  it.each([
    'src/pr/lift.test.ts',
    'README.md',
    'src/pr/lift.ts',
    'src/App.test.tsx',
    'src/Button.stories.tsx',
    'src/__tests__/render.tsx',
    'src/take/fixtures/focus.html',
    'src/take/fixtures/scrollbars.html',
    'src/driver/probes/fixtures/page.html',
    'sandbox/fixtures/claude/review-pr/evidence-mismatch/render/head/header.css',
    'src/__fixtures__/card.tsx',
    'pkg/testdata/golden.svg',
  ])('should classify %s as not painted', (path) => {
    expect(isPainted(path, DEFAULT_PAINTED)).toBe(false)
  })
})

describe('loadPaintedPatterns', () => {
  const roots: string[] = []

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true })
  })

  function rootWith(config?: string): string {
    const root = mkdtempSync(join(tmpdir(), 'painted-'))
    roots.push(root)
    if (config !== undefined) {
      mkdirSync(join(root, 'canon', 'config'), { recursive: true })
      writeFileSync(join(root, PAINTED_CONFIG_REL), config)
    }
    return root
  }

  it('should return the default when the project has no override', () => {
    expect(loadPaintedPatterns(rootWith())).toEqual(DEFAULT_PAINTED)
  })

  it('should add a project glob to the default list', () => {
    const patterns = loadPaintedPatterns(rootWith('{"painted":["**/*.mdx"]}'))

    expect(isPainted('docs/page.mdx', patterns)).toBe(true)
    expect(isPainted('src/App.tsx', patterns)).toBe(true)
  })

  it('should let a project glob paint a fixture folder the default excludes', () => {
    const patterns = loadPaintedPatterns(
      rootWith('{"painted":["app/fixtures/**"]}'),
    )

    expect(isPainted('app/fixtures/index.html', patterns)).toBe(true)
    expect(isPainted('src/take/fixtures/focus.html', patterns)).toBe(false)
  })

  it('should keep a test file and a project trim unpainted under a repainted fixture folder', () => {
    const patterns = loadPaintedPatterns(
      rootWith(
        '{"painted":["app/fixtures/**"],"unpainted":["app/fixtures/data/**"]}',
      ),
    )

    expect(isPainted('app/fixtures/page.test.tsx', patterns)).toBe(false)
    expect(isPainted('app/fixtures/data/table.html', patterns)).toBe(false)
  })

  it('should let a project trim a path the default paints', () => {
    const patterns = loadPaintedPatterns(
      rootWith('{"unpainted":["fixtures/**"]}'),
    )

    expect(isPainted('fixtures/page.html', patterns)).toBe(false)
  })

  it('should leave this repository design sources unpainted while their generated outputs paint', () => {
    const patterns = loadPaintedPatterns(
      fileURLToPath(new URL('../..', import.meta.url)),
    )

    expect(isPainted('src/design/parse.ts', patterns)).toBe(false)
    expect(isPainted('src/design/render.ts', patterns)).toBe(false)
    expect(isPainted('src/design/templates/status.css', patterns)).toBe(true)
    expect(isPainted('web/src/styles/tokens.css', patterns)).toBe(true)
    expect(
      isPainted('web/public/previews/design-tokens/design.css', patterns),
    ).toBe(true)
  })

  it('should paint the take engine and leave its tests unpainted through the shipped override', () => {
    const patterns = loadPaintedPatterns(
      fileURLToPath(new URL('../..', import.meta.url)),
    )

    expect(isPainted('src/take/camera.ts', patterns)).toBe(true)
    expect(isPainted('src/take/camera.test.ts', patterns)).toBe(false)
    expect(isPainted('src/take/film.e2e.test.ts', patterns)).toBe(false)
  })

  it('should paint a take fixture through the take glob while other fixture folders stay unpainted', () => {
    const patterns = loadPaintedPatterns(
      fileURLToPath(new URL('../..', import.meta.url)),
    )

    expect(isPainted('src/take/fixtures/focus.html', patterns)).toBe(true)
    expect(isPainted('src/take/fixtures/pr-reel.test.ts', patterns)).toBe(false)
    expect(isPainted('src/driver/probes/fixtures/page.html', patterns)).toBe(
      false,
    )
  })

  it('should leave a synced stack config unpainted through its shipped override', () => {
    const patterns = loadPaintedPatterns(
      fileURLToPath(new URL('../..', import.meta.url)),
    )

    expect(
      isPainted(
        'tooling/astro/configs/src/components/site-head.astro',
        patterns,
      ),
    ).toBe(false)
    expect(isPainted('tooling/astro/scenarios.css', patterns)).toBe(false)
    expect(isPainted('web/src/pages/index.astro', patterns)).toBe(true)
  })

  it('should keep the default when the override does not parse', () => {
    expect(loadPaintedPatterns(rootWith('{nope'))).toEqual(DEFAULT_PAINTED)
  })

  it('should load the declared reel inputs', () => {
    const patterns = loadPaintedPatterns(
      rootWith('{"reelInputs":["src/browser/engine.ts","bun.lock"]}'),
    )

    expect(patterns.reelInputs).toEqual(['src/browser/engine.ts', 'bun.lock'])
  })

  it.each([
    ['absent', '{"painted":["src/take/**"]}'],
    ['not an array', '{"reelInputs":"bun.lock"}'],
    ['holding a non-string', '{"reelInputs":["bun.lock",3]}'],
  ])('should leave the reel inputs absent when the key is %s', (_, config) => {
    expect(loadPaintedPatterns(rootWith(config))).not.toHaveProperty(
      'reelInputs',
    )
  })
})
