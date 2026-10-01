import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listStacks, loadManifest, resolveChain } from '@/tooling/manifest'

let root: string

function seedStack(name: string, body: string): void {
  const dir = join(root, 'tooling', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'manifest.toml'), body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-manifest-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('loadManifest', () => {
  it('should read extends from the stack table', () => {
    seedStack('child', '[stack]\nname = "child"\nextends = "parent"\n')

    expect(loadManifest(root, 'child')?.parent).toBe('parent')
  })

  it('should treat an empty extends as no parent', () => {
    seedStack('base', '[stack]\nname = "base"\nextends = ""\n')

    expect(loadManifest(root, 'base')?.parent).toBeUndefined()
  })

  it('should return undefined for a stack that does not exist', () => {
    expect(loadManifest(root, 'ghost')).toBeUndefined()
  })

  it('should separate scripts from their override table', () => {
    seedStack(
      'web',
      '[stack]\nname = "web"\n\n[scripts]\n"dev" = "vite"\n\n[scripts.override]\n"build" = "vite build"\n',
    )

    const manifest = loadManifest(root, 'web')

    expect(manifest?.scripts).toEqual({ dev: 'vite' })
    expect(manifest?.scriptOverrides).toEqual({ build: 'vite build' })
  })

  it('should read gitignore sections preserving manifest order', () => {
    seedStack(
      'base',
      '[stack]\nname = "base"\n\n[gitignore]\n"# System" = [".DS_Store"]\n"# Deps" = ["node_modules/"]\n',
    )

    expect(loadManifest(root, 'base')?.gitignore).toEqual([
      { header: '# System', entries: ['.DS_Store'] },
      { header: '# Deps', entries: ['node_modules/'] },
    ])
  })

  it('should read the dev packages array', () => {
    seedStack(
      'base',
      '[stack]\nname = "base"\n\n[dependencies.dev]\npackages = ["prettier", "cspell"]\n',
    )

    expect(loadManifest(root, 'base')?.devPackages).toEqual([
      'prettier',
      'cspell',
    ])
  })
})

describe('resolveChain', () => {
  it('should walk the extends chain nearest stack first', () => {
    seedStack('base', '[stack]\nname = "base"\nextends = ""\n')
    seedStack('web', '[stack]\nname = "web"\nextends = "base"\n')
    seedStack('astro', '[stack]\nname = "astro"\nextends = "web"\n')

    const names = resolveChain(root, 'astro').map((entry) => entry.name)

    expect(names).toEqual(['astro', 'web', 'base'])
  })

  it('should truncate the chain at the skipped stack', () => {
    seedStack('base', '[stack]\nname = "base"\nextends = ""\n')
    seedStack('web', '[stack]\nname = "web"\nextends = "base"\n')

    const names = resolveChain(root, 'web', { skipStack: 'base' }).map(
      (entry) => entry.name,
    )

    expect(names).toEqual(['web'])
  })

  it('should keep a skipped stack that declares per-root paths', () => {
    seedStack(
      'base',
      '[stack]\nname = "base"\nextends = ""\n\n[sync]\nper_root = ["scripts/verify.sh"]\n',
    )
    seedStack('web', '[stack]\nname = "web"\nextends = "base"\n')

    const names = resolveChain(root, 'web', { skipStack: 'base' }).map(
      (entry) => entry.name,
    )

    expect(names).toEqual(['web', 'base'])
  })

  it('should restrict a kept skipped stack to its per-root configs', () => {
    seedStack(
      'base',
      '[stack]\nname = "base"\nextends = ""\n\n[sync]\nper_root = ["scripts/verify.sh"]\n',
    )
    seedStack('web', '[stack]\nname = "web"\nextends = "base"\n')

    const kept = resolveChain(root, 'web', { skipStack: 'base' })[1]

    expect(kept.onlyConfigs).toEqual(['scripts/verify.sh'])
  })

  it('should drop the scripts and dependencies of a kept skipped stack', () => {
    seedStack(
      'base',
      '[stack]\nname = "base"\nextends = ""\n\n[sync]\nper_root = ["scripts/verify.sh"]\n\n[scripts]\n"check" = "./scripts/verify.sh"\n\n[dependencies.dev]\npackages = ["prettier"]\n',
    )
    seedStack('web', '[stack]\nname = "web"\nextends = "base"\n')

    const kept = resolveChain(root, 'web', { skipStack: 'base' })[1]

    expect([kept.scripts, kept.devPackages]).toEqual([{}, []])
  })

  it('should leave a chain with no skip unrestricted', () => {
    seedStack(
      'base',
      '[stack]\nname = "base"\nextends = ""\n\n[sync]\nper_root = ["scripts/verify.sh"]\n',
    )

    expect(resolveChain(root, 'base')[0].onlyConfigs).toBeUndefined()
  })

  it('should stop instead of looping when extends forms a cycle', () => {
    seedStack('a', '[stack]\nname = "a"\nextends = "b"\n')
    seedStack('b', '[stack]\nname = "b"\nextends = "a"\n')

    const names = resolveChain(root, 'a').map((entry) => entry.name)

    expect(names).toEqual(['a', 'b'])
  })

  it('should stop when a parent manifest is missing', () => {
    seedStack('orphan', '[stack]\nname = "orphan"\nextends = "ghost"\n')

    const names = resolveChain(root, 'orphan').map((entry) => entry.name)

    expect(names).toEqual(['orphan'])
  })
})

describe('listStacks', () => {
  it('should exclude the claude stack from discovery', () => {
    seedStack('base', '[stack]\nname = "base"\n')
    seedStack('claude', '[stack]\nname = "claude"\n')

    expect(listStacks(root)).toEqual(['base'])
  })

  it('should return an empty list when no tooling directory exists', () => {
    expect(listStacks(join(root, 'nowhere'))).toEqual([])
  })
})
