import { describe, expect, it } from 'vitest'
import type { Manifest } from '@/tooling/manifest'
import {
  applyScripts,
  collectDeps,
  collectScripts,
  minimalPackage,
  parseSpec,
} from '@/tooling/package'

function makeManifest(
  name: string,
  overrides: Partial<Manifest> = {},
): Manifest {
  return {
    name,
    dir: `/tooling/${name}`,
    configsDir: `/tooling/${name}/configs`,
    seedsDir: `/tooling/${name}/seeds`,
    scripts: {},
    scriptOverrides: {},
    gitignore: [],
    devPackages: [],
    ...overrides,
  }
}

describe('parseSpec', () => {
  it('should read a bare package name', () => {
    expect(parseSpec('prettier')).toEqual({ name: 'prettier', pin: '' })
  })

  it('should split a pinned version from the name', () => {
    expect(parseSpec('react@19')).toEqual({ name: 'react', pin: '19' })
  })

  it('should keep the leading at sign of a scoped package', () => {
    expect(parseSpec('@commitlint/cli')).toEqual({
      name: '@commitlint/cli',
      pin: '',
    })
  })

  it('should split a pinned version from a scoped name', () => {
    expect(parseSpec('@scope/pkg@^1.2.3')).toEqual({
      name: '@scope/pkg',
      pin: '^1.2.3',
    })
  })
})

describe('collectDeps', () => {
  it('should report an absent package as missing', () => {
    const chain = [makeManifest('base', { devPackages: ['prettier'] })]

    expect(collectDeps(chain, {})).toEqual([
      { spec: 'prettier', name: 'prettier', state: 'missing' },
    ])
  })

  it('should report an installed package as present', () => {
    const chain = [makeManifest('base', { devPackages: ['prettier'] })]
    const pkg = { devDependencies: { prettier: '^3.0.0' } }

    expect(collectDeps(chain, pkg)[0].state).toBe('present')
  })

  it('should report a major version mismatch as missing', () => {
    const chain = [makeManifest('base', { devPackages: ['react@19'] })]
    const pkg = { dependencies: { react: '^18.2.0' } }

    expect(collectDeps(chain, pkg)[0].state).toBe('missing')
  })

  it('should accept a matching major version', () => {
    const chain = [makeManifest('base', { devPackages: ['react@19'] })]
    const pkg = { dependencies: { react: '^19.1.0' } }

    expect(collectDeps(chain, pkg)[0].state).toBe('present')
  })

  it('should let the furthest ancestor win when both name a package', () => {
    const chain = [
      makeManifest('web', { devPackages: ['react@19'] }),
      makeManifest('base', { devPackages: ['react@18'] }),
    ]

    expect(collectDeps(chain, {}).map((dep) => dep.spec)).toEqual(['react@18'])
  })
})

describe('collectScripts', () => {
  it('should report a script the target lacks as missing', () => {
    const chain = [makeManifest('base', { scripts: { check: './verify.sh' } })]

    expect(collectScripts(chain, {})[0].state).toBe('missing')
  })

  it('should report a differing script as drifted', () => {
    const chain = [makeManifest('base', { scripts: { check: './verify.sh' } })]
    const pkg = { scripts: { check: 'something-else' } }

    expect(collectScripts(chain, pkg)[0].state).toBe('drifted')
  })

  it('should report an identical script as matching', () => {
    const chain = [makeManifest('base', { scripts: { check: './verify.sh' } })]
    const pkg = { scripts: { check: './verify.sh' } }

    expect(collectScripts(chain, pkg)[0].state).toBe('matching')
  })

  it('should let the nearest stack shadow its parent', () => {
    const chain = [
      makeManifest('web', { scripts: { build: 'vite build' } }),
      makeManifest('base', { scripts: { build: 'tsc' } }),
    ]
    const pkg = { scripts: { build: 'vite build' } }

    expect(collectScripts(chain, pkg)).toEqual([
      { key: 'build', state: 'matching' },
    ])
  })

  it('should report an override-only script the target lacks as missing', () => {
    const chain = [
      makeManifest('base', { scriptOverrides: { format: 'oxfmt .' } }),
    ]

    expect(collectScripts(chain, {})).toEqual([
      { key: 'format', state: 'missing' },
    ])
  })

  it('should report a stale override-only script as drifted', () => {
    const chain = [
      makeManifest('base', { scriptOverrides: { format: 'oxfmt .' } }),
    ]
    const pkg = { scripts: { format: 'prettier --write .' } }

    expect(collectScripts(chain, pkg)).toEqual([
      { key: 'format', state: 'drifted' },
    ])
  })

  it('should report a current override-only script as matching', () => {
    const chain = [
      makeManifest('base', { scriptOverrides: { format: 'oxfmt .' } }),
    ]
    const pkg = { scripts: { format: 'oxfmt .' } }

    expect(collectScripts(chain, pkg)).toEqual([
      { key: 'format', state: 'matching' },
    ])
  })

  it('should compare a target against the override that shadows a parent plain value', () => {
    const chain = [
      makeManifest('web', { scriptOverrides: { dev: 'vite --port 0' } }),
      makeManifest('base', { scripts: { dev: 'bun run start' } }),
    ]
    const pkg = { scripts: { dev: 'vite --port 0' } }

    expect(collectScripts(chain, pkg)).toEqual([
      { key: 'dev', state: 'matching' },
    ])
  })

  it('should expect the nearest stack override when two stacks override a key', () => {
    const chain = [
      makeManifest('astro', { scriptOverrides: { 'check:format': 'astro' } }),
      makeManifest('base', { scriptOverrides: { 'check:format': 'base' } }),
    ]
    const pkg = { scripts: { 'check:format': 'base' } }

    expect(collectScripts(chain, pkg)).toEqual([
      { key: 'check:format', state: 'drifted' },
    ])
  })

  it('should list plain keys before override-only keys', () => {
    const chain = [
      makeManifest('web', { scriptOverrides: { format: 'oxfmt .' } }),
      makeManifest('base', { scripts: { build: 'tsc' } }),
    ]

    expect(collectScripts(chain, {}).map((entry) => entry.key)).toEqual([
      'build',
      'format',
    ])
  })
})

describe('applyScripts', () => {
  it('should fill a script the target does not define', () => {
    const chain = [makeManifest('base', { scripts: { check: './verify.sh' } })]

    const result = applyScripts({}, chain)

    expect(result.pkg.scripts).toEqual({ check: './verify.sh' })
    expect(result.added).toEqual(['check'])
  })

  it('should leave an existing script alone', () => {
    const chain = [makeManifest('base', { scripts: { check: './verify.sh' } })]
    const pkg = { scripts: { check: 'custom' } }

    const result = applyScripts(pkg, chain)

    expect(result.pkg.scripts).toEqual({ check: 'custom' })
    expect(result.added).toEqual([])
  })

  it('should let the nearest stack override win over its parent', () => {
    const chain = [
      makeManifest('astro', { scriptOverrides: { screenshot: 'astro-shot' } }),
      makeManifest('web', { scriptOverrides: { screenshot: 'web-shot' } }),
    ]

    const result = applyScripts({}, chain)

    expect(result.pkg.scripts?.screenshot).toBe('astro-shot')
  })

  it('should replace an existing value when a stack overrides it', () => {
    const chain = [
      makeManifest('web', { scriptOverrides: { screenshot: 'web-shot' } }),
    ]
    const pkg = { scripts: { screenshot: 'stale' } }

    const result = applyScripts(pkg, chain)

    expect(result.pkg.scripts?.screenshot).toBe('web-shot')
    expect(result.overridden).toEqual(['screenshot'])
  })

  it('should not report an override that already matches', () => {
    const chain = [
      makeManifest('web', { scriptOverrides: { screenshot: 'web-shot' } }),
    ]
    const pkg = { scripts: { screenshot: 'web-shot' } }

    expect(applyScripts(pkg, chain).overridden).toEqual([])
  })

  it('should replace a scaffold-authored key the stack overrides', () => {
    const chain = [
      makeManifest('web', {
        scripts: { lint: 'eslint . --max-warnings 0' },
        scriptOverrides: { lint: 'eslint . --max-warnings 0' },
      }),
    ]
    const pkg = { scripts: { lint: 'oxlint' } }

    const result = applyScripts(pkg, chain)

    expect(result.pkg.scripts?.lint).toBe('eslint . --max-warnings 0')
    expect(result.overridden).toContain('lint')
  })
})

describe('minimalPackage', () => {
  it('should carry exactly a name, a version, and the module type', () => {
    expect(minimalPackage('/work/my-app')).toEqual({
      name: 'my-app',
      version: '0.0.0',
      type: 'module',
    })
  })

  it('should lowercase the folder name and replace spaces', () => {
    expect(minimalPackage('/work/My App').name).toBe('my-app')
  })

  it('should strip a leading dot or underscore', () => {
    expect(minimalPackage('/work/.hidden').name).toBe('hidden')
    expect(minimalPackage('/work/__core').name).toBe('core')
  })

  it('should fall back to project when nothing is left', () => {
    expect(minimalPackage('/work/.').name).toBe('project')
    expect(minimalPackage('/work/...').name).toBe('project')
  })
})
