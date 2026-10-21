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

  it('should let a project trim a path the default paints', () => {
    const patterns = loadPaintedPatterns(
      rootWith('{"unpainted":["fixtures/**"]}'),
    )

    expect(isPainted('fixtures/page.html', patterns)).toBe(false)
  })

  it('should paint this repository own rendered sources through its shipped override', () => {
    const patterns = loadPaintedPatterns(
      fileURLToPath(new URL('../..', import.meta.url)),
    )

    expect(isPainted('src/design/components.ts', patterns)).toBe(true)
    expect(isPainted('src/design/css.ts', patterns)).toBe(true)
    expect(isPainted('src/design/render.ts', patterns)).toBe(true)
    expect(isPainted('src/design/css.test.ts', patterns)).toBe(false)
    expect(isPainted('src/canvas/client/selection.ts', patterns)).toBe(true)
    expect(isPainted('src/canvas/client/keys.test.ts', patterns)).toBe(false)
    expect(isPainted('src/pr/lift.ts', patterns)).toBe(false)
  })

  it('should keep the default when the override does not parse', () => {
    expect(loadPaintedPatterns(rootWith('{nope'))).toEqual(DEFAULT_PAINTED)
  })
})
