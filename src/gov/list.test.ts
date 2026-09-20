import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildGovCatalog,
  buildRuleEntries,
  buildStackEntries,
  describeStack,
} from '@/gov/list'

let root: string

function seedStack(name: string, body: string): void {
  const dir = join(root, 'governance', 'stacks')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.toml`), body)
}

function seedRule(folder: string, name: string, body: string): void {
  const dir = join(root, 'governance', 'rules', folder)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.md`), body)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-gov-list-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('buildStackEntries', () => {
  it('should report a folder entry as the rules it stands for', () => {
    seedRule('core', '000-a', '# a\n')
    seedRule('core', '010-b', '# b\n')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')

    expect(buildStackEntries(root)).toEqual([
      { name: 'base', extends: null, rules: ['000-a', '010-b'] },
    ])
  })

  it('should report only the stack own entries rather than the resolved chain', () => {
    seedRule('core', '000-a', '# a\n')
    seedRule('lang', '100-ts', '# ts\n')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')
    seedStack('node', 'extends = "base"\nrules = ["100-ts"]\n')

    const node = buildStackEntries(root).find((entry) => entry.name === 'node')

    expect(node).toEqual({ name: 'node', extends: 'base', rules: ['100-ts'] })
  })

  it('should list a rule once when a folder entry and a slug entry both name it', () => {
    seedRule('core', '000-a', '# a\n')
    seedStack('base', 'extends = ""\nrules = ["core", "000-a"]\n')

    expect(buildStackEntries(root)[0].rules).toEqual(['000-a'])
  })
})

describe('buildRuleEntries', () => {
  it('should read the description and paths off the frontmatter', () => {
    seedRule(
      'lang',
      '110-python',
      "---\ndescription: Enforce type hints\npaths:\n  - '**/*.py'\n---\n\n# Python\n",
    )

    expect(buildRuleEntries(root)).toEqual([
      {
        name: '110-python',
        domain: 'lang',
        description: 'Enforce type hints',
        paths: ['**/*.py'],
      },
    ])
  })

  it('should report null paths for an always-on rule', () => {
    seedRule('core', '000-a', '---\ndescription: Persona\n---\n\n# A\n')

    expect(buildRuleEntries(root)[0].paths).toBeNull()
  })

  it('should report an empty description when the rule carries no frontmatter', () => {
    seedRule('core', '000-a', '# A\n')

    expect(buildRuleEntries(root)[0].description).toBe('')
  })
})

/**
 * Reads the shipped corpus rather than a fixture, because the behavior the
 * `ui` globs exist for is which rules a session loads when it opens a real
 * file. A fixture asserting a glob it wrote itself measures nothing.
 */
function rulesMatching(domain: string, file: string): string[] {
  return buildRuleEntries(process.cwd())
    .filter((entry) => entry.domain === domain)
    .filter((entry) =>
      (entry.paths ?? []).some((glob) => new Bun.Glob(glob).match(file)),
    )
    .map((entry) => entry.name)
}

describe('governance/rules/ui', () => {
  it('should match an Astro component from every extension-scoped rule', () => {
    expect(rulesMatching('ui', 'src/components/Card.astro')).toEqual([
      '400-ui',
      '410-a11y',
      '420-forms',
      '430-ux-completeness',
      '440-surface-capture',
      '450-link-behavior',
      '465-interface-casing',
      '470-motion',
    ])
  })
})

describe('buildGovCatalog', () => {
  it('should carry the rules no stack reaches beside the catalog', () => {
    seedRule('core', '000-a', '# a\n')
    seedRule('lib', '300-orphan', '# orphan\n')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')

    expect(buildGovCatalog(root).unreferenced).toEqual(['300-orphan'])
  })

  it('should report a rule in a folder no stack names as reached by no stack', () => {
    seedRule('core', '000-a', '# a\n')
    seedRule('snippets', '505-at-references', '# at-references\n')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')

    expect(buildGovCatalog(root).unreferenced).toEqual(['505-at-references'])
    expect(buildGovCatalog(root).rules.map((entry) => entry.name)).toContain(
      '505-at-references',
    )
  })
})

describe('describeStack', () => {
  it('should name the parent when the stack extends one', () => {
    expect(
      describeStack({ name: 'node', extends: 'base', rules: ['100-ts'] }),
    ).toBe('node (extends: base, 1 rules)')
  })

  it('should omit the parent for a root stack', () => {
    expect(describeStack({ name: 'base', extends: null, rules: [] })).toBe(
      'base (0 rules)',
    )
  })
})
