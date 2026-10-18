import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  appendGatedPrefix,
  findingsUnder,
  GATED_CONFIG_REL,
  gateScopeRoots,
  prefixShapeError,
  readGatedConfig,
  resolveGatedList,
} from '@/markdown/gated'
import { GATED_PATHS } from '@/markdown/scope'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-gated-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeConfig(text: string): void {
  const path = join(root, GATED_CONFIG_REL)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

describe('readGatedConfig', () => {
  it('should read an absent file as absent', () => {
    expect(readGatedConfig(root)).toEqual({ kind: 'absent' })
  })

  it('should read an empty list as listing nothing', () => {
    writeConfig('[markdown]\ngated = []\n')
    expect(readGatedConfig(root)).toEqual({ kind: 'listed', prefixes: [] })
  })

  it('should refuse malformed TOML with the path named', () => {
    writeConfig('[markdown\ngated = ')
    const config = readGatedConfig(root)
    expect(config.kind).toBe('malformed')
    if (config.kind === 'malformed')
      expect(config.message).toContain(GATED_CONFIG_REL)
  })

  it('should refuse a gated value that is not a list of strings', () => {
    writeConfig('[markdown]\ngated = "docs/"\n')
    expect(readGatedConfig(root).kind).toBe('malformed')
  })
})

describe('prefixShapeError', () => {
  it('should accept a folder prefix ending in a slash', () => {
    expect(prefixShapeError(root, 'docs/')).toBeUndefined()
  })

  it('should refuse a prefix without a trailing slash naming no file', () => {
    expect(prefixShapeError(root, 'docs')).toContain('names no file')
  })

  it('should accept an exact path naming a file', () => {
    writeFileSync(join(root, 'README.md'), '# Readme\n')
    expect(prefixShapeError(root, 'README.md')).toBeUndefined()
  })
})

describe('appendGatedPrefix', () => {
  it('should create the file and append a prefix', () => {
    expect(appendGatedPrefix(root, [], 'docs/')).toBe('appended')
    expect(readGatedConfig(root)).toEqual({
      kind: 'listed',
      prefixes: ['docs/'],
    })
  })

  it('should write nothing for a duplicate prefix', () => {
    appendGatedPrefix(root, [], 'docs/')
    const before = readFileSync(join(root, GATED_CONFIG_REL), 'utf8')

    expect(appendGatedPrefix(root, ['docs/'], 'docs/')).toBe('present')
    expect(readFileSync(join(root, GATED_CONFIG_REL), 'utf8')).toBe(before)
  })
})

describe('resolveGatedList', () => {
  it('should read GATED_PATHS in a canon checkout', () => {
    expect(resolveGatedList(root, true)).toEqual({
      kind: 'resolved',
      source: 'canon',
      list: { prefixes: GATED_PATHS, alwaysGated: true },
    })
  })

  it('should gate nothing in a target with no config', () => {
    expect(resolveGatedList(root, false)).toEqual({
      kind: 'resolved',
      source: 'absent',
      list: { prefixes: [], alwaysGated: false },
    })
  })

  it('should read a target list from its config', () => {
    writeConfig('[markdown]\ngated = ["docs/"]\n')
    expect(resolveGatedList(root, false)).toEqual({
      kind: 'resolved',
      source: 'config',
      list: { prefixes: ['docs/'], alwaysGated: false },
    })
  })

  it('should carry a malformed config through as malformed', () => {
    writeConfig('not toml [')
    expect(resolveGatedList(root, false).kind).toBe('malformed')
  })
})

const LONG_PARAGRAPH = `${'A sentence long enough to count here. '.repeat(12)}\n`

async function repoWith(files: Record<string, string>): Promise<void> {
  await execa('git', ['init', '-q'], { cwd: root })
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
}

describe('findingsUnder', () => {
  it('should find nothing under a clean folder', async () => {
    await repoWith({ 'docs/guide.md': '# Guide\n\nShort.\n' })
    expect(await findingsUnder(root, 'docs/')).toEqual([])
  })

  it('should find a density finding under the prefix', async () => {
    await repoWith({ 'docs/guide.md': `# Guide\n\n${LONG_PARAGRAPH}` })
    expect(await findingsUnder(root, 'docs/')).toEqual([
      expect.objectContaining({
        path: 'docs/guide.md',
        kind: 'paragraph-length',
      }),
    ])
  })

  it('should ignore a finding outside the prefix', async () => {
    await repoWith({ 'wiki/page.md': `# Page\n\n${LONG_PARAGRAPH}` })
    expect(await findingsUnder(root, 'docs/')).toEqual([])
  })

  it('should read an absent folder as clean', async () => {
    await repoWith({ 'README.md': '# Readme\n' })
    expect(await findingsUnder(root, 'docs/')).toEqual([])
  })

  it('should answer undefined outside a git repository', async () => {
    expect(await findingsUnder(root, 'docs/')).toBeUndefined()
  })
})

describe('gateScopeRoots', () => {
  it('should gate the clean roots and leave a failing one out', async () => {
    await repoWith({
      'README.md': '# Readme\n',
      'docs/guide.md': `# Guide\n\n${LONG_PARAGRAPH}`,
    })

    const result = await gateScopeRoots(root)

    expect(result).toMatchObject({
      kind: 'gated',
      left: [{ prefix: 'docs/', findings: 1 }],
    })
    const config = readGatedConfig(root)
    const prefixes = config.kind === 'listed' ? config.prefixes : []
    expect(prefixes).toContain('README.md')
    expect(prefixes).toContain('wiki/')
    expect(prefixes).not.toContain('docs/')
  })

  it('should leave an existing config untouched', async () => {
    await repoWith({ 'README.md': '# Readme\n' })
    writeConfig('[markdown]\ngated = ["wiki/"]\n')
    const before = readFileSync(join(root, GATED_CONFIG_REL), 'utf8')

    expect((await gateScopeRoots(root)).kind).toBe('exists')
    expect(readFileSync(join(root, GATED_CONFIG_REL), 'utf8')).toBe(before)
  })
})
