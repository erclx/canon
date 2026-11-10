import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Manifest } from '@/tooling/manifest'
import { tailwindImportWarnings } from '@/tooling/tailwind-import'

const PLUGIN_CONFIG = [
  "import tailwindcss from '@tailwindcss/vite'",
  'export default { plugins: [tailwindcss()] }',
  '',
].join('\n')

const PLAIN_CONFIG = 'export default { plugins: [] }\n'

let root: string
let target: string

function writeAt(path: string, body: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body)
}

function stack(configs: Record<string, string>): Manifest {
  const dir = join(root, 'tooling', 'fixture')
  for (const [rel, body] of Object.entries(configs)) {
    writeAt(join(dir, 'configs', rel), body)
  }
  return {
    name: 'fixture',
    dir,
    configsDir: join(dir, 'configs'),
    seedsDir: join(dir, 'seeds'),
    scripts: {},
    scriptOverrides: {},
    gitignore: [],
    devPackages: [],
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'tailwind-import-'))
  target = join(root, 'target')
  mkdirSync(target)
})

afterEach(() => {
  rmSync(root, { force: true, recursive: true })
})

describe('tailwindImportWarnings with the plugin registered', () => {
  it('should warn when no stylesheet exists', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]

    const warnings = tailwindImportWarnings(chain, target)

    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'tailwind-unimported',
        config: 'vite.config.ts',
      }),
    ])
  })

  it('should warn when a stylesheet exists without the import', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]
    writeAt(join(target, 'src/index.css'), 'body { margin: 0; }\n')

    expect(tailwindImportWarnings(chain, target)).toHaveLength(1)
  })

  it('should stay silent on a single-quoted import in a nested folder', () => {
    const chain = [stack({ 'astro.config.mjs': PLUGIN_CONFIG })]
    writeAt(join(target, 'src/styles/global.css'), "@import 'tailwindcss';\n")

    expect(tailwindImportWarnings(chain, target)).toEqual([])
  })

  it('should stay silent on a double-quoted subpath import', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]
    writeAt(join(target, 'app.css'), '@import "tailwindcss/theme.css";\n')

    expect(tailwindImportWarnings(chain, target)).toEqual([])
  })

  it('should stay silent on an import outside src', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]
    writeAt(
      join(target, 'styles/main.css'),
      "@import 'tailwindcss' source('../src');\n",
    )

    expect(tailwindImportWarnings(chain, target)).toEqual([])
  })

  it('should not count an import under node_modules', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]
    writeAt(
      join(target, 'node_modules/pkg/index.css'),
      "@import 'tailwindcss';\n",
    )

    expect(tailwindImportWarnings(chain, target)).toHaveLength(1)
  })

  it('should not count an import under dist', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]
    writeAt(join(target, 'dist/assets/index.css'), "@import 'tailwindcss';\n")

    expect(tailwindImportWarnings(chain, target)).toHaveLength(1)
  })

  it('should not count an import under a dot folder such as .astro', () => {
    const chain = [stack({ 'astro.config.mjs': PLUGIN_CONFIG })]
    writeAt(join(target, '.astro/cache.css'), "@import 'tailwindcss';\n")

    expect(tailwindImportWarnings(chain, target)).toHaveLength(1)
  })
})

describe('tailwindImportWarnings without the plugin registered', () => {
  it('should stay silent on a stack whose configs register no plugin', () => {
    const chain = [stack({ 'next.config.ts': PLAIN_CONFIG })]

    expect(tailwindImportWarnings(chain, target)).toEqual([])
  })

  it('should read the target copy over the golden', () => {
    const chain = [stack({ 'vite.config.ts': PLUGIN_CONFIG })]
    writeAt(join(target, 'vite.config.ts'), PLAIN_CONFIG)

    expect(tailwindImportWarnings(chain, target)).toEqual([])
  })

  it('should ignore a nested config the chain ships', () => {
    const chain = [stack({ 'card-src/vite.config.ts': PLUGIN_CONFIG })]

    expect(tailwindImportWarnings(chain, target)).toEqual([])
  })
})
