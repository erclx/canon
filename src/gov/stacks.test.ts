import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  expandStackEntry,
  listGovStacks,
  loadGovStack,
  mergeExtraRules,
  resolveMissingRules,
  resolveRules,
  unreferencedRules,
} from '@/gov/stacks'
import { PROJECT_ROOT } from '@/project-root'

let root: string
let target: string

function seedStack(name: string, body: string): void {
  const dir = join(root, 'governance', 'stacks')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.toml`), body)
}

function seedRule(folder: string, name: string): void {
  const dir = join(root, 'governance', 'rules', folder)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.md`), `# ${name}\n`)
}

function installRule(folder: string, name: string): void {
  const dir = join(target, '.claude', 'rules', 'canon', folder)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.md`), `# ${name}\n`)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-gov-stacks-'))
  target = mkdtempSync(join(tmpdir(), 'canon-gov-stacks-target-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(target, { recursive: true, force: true })
})

describe('loadGovStack', () => {
  it('should read the rules array', () => {
    seedStack('base', 'extends = ""\nrules = ["000-a", "010-b"]\n')

    expect(loadGovStack(root, 'base')?.rules).toEqual(['000-a', '010-b'])
  })

  it('should treat an empty extends as no parent', () => {
    seedStack('base', 'extends = ""\nrules = []\n')

    expect(loadGovStack(root, 'base')?.parent).toBeUndefined()
  })

  it('should read extends as the parent stack', () => {
    seedStack('astro', 'extends = "node"\nrules = []\n')

    expect(loadGovStack(root, 'astro')?.parent).toBe('node')
  })

  it('should return undefined for a stack that does not exist', () => {
    expect(loadGovStack(root, 'ghost')).toBeUndefined()
  })
})

describe('resolveRules', () => {
  it('should place ancestor rules before the stack own rules', () => {
    seedStack('base', 'extends = ""\nrules = ["000-a"]\n')
    seedStack('node', 'extends = "base"\nrules = ["100-b"]\n')
    seedStack('astro', 'extends = "node"\nrules = ["200-c"]\n')

    const resolved = resolveRules(root, 'astro')

    expect(resolved).toEqual({ ok: true, rules: ['000-a', '100-b', '200-c'] })
  })

  it('should keep only the first appearance of a rule named twice', () => {
    seedStack('base', 'extends = ""\nrules = ["000-a", "010-b"]\n')
    seedStack('node', 'extends = "base"\nrules = ["010-b", "100-c"]\n')

    const resolved = resolveRules(root, 'node')

    expect(resolved).toEqual({ ok: true, rules: ['000-a', '010-b', '100-c'] })
  })

  it('should report the missing ancestor rather than resolving partially', () => {
    seedStack('orphan', 'extends = "ghost"\nrules = ["000-a"]\n')

    expect(resolveRules(root, 'orphan')).toEqual({
      ok: false,
      missingStack: 'ghost',
    })
  })

  it('should report the stack itself when it does not exist', () => {
    expect(resolveRules(root, 'ghost')).toEqual({
      ok: false,
      missingStack: 'ghost',
    })
  })

  it('should stop instead of looping when extends forms a cycle', () => {
    seedStack('a', 'extends = "b"\nrules = ["000-a"]\n')
    seedStack('b', 'extends = "a"\nrules = ["010-b"]\n')

    expect(resolveRules(root, 'a')).toEqual({
      ok: true,
      rules: ['010-b', '000-a'],
    })
  })
})

describe('resolveRules on the shipped stacks', () => {
  it('should leave the Next.js rule out of react', () => {
    expect(resolveRules(PROJECT_ROOT, 'react')).toEqual({
      ok: true,
      rules: expect.not.arrayContaining(['230-nextjs']),
    })
  })

  it('should give nextjs the Next.js rule on top of the react rules', () => {
    expect(resolveRules(PROJECT_ROOT, 'nextjs')).toEqual({
      ok: true,
      rules: expect.arrayContaining(['200-react', '230-nextjs']),
    })
  })
})

describe('expandStackEntry', () => {
  it('should expand a folder entry to every rule inside it, sorted', () => {
    seedRule('core', '010-b')
    seedRule('core', '000-a')

    expect(expandStackEntry(root, 'core')).toEqual(['000-a', '010-b'])
  })

  it('should return a rule slug unchanged', () => {
    seedRule('core', '000-a')

    expect(expandStackEntry(root, '000-a')).toEqual(['000-a'])
  })

  it('should return an entry naming neither a folder nor a rule unchanged', () => {
    expect(expandStackEntry(root, 'ghost')).toEqual(['ghost'])
  })

  it('should reach a rule nested below the folder', () => {
    seedRule(join('core', 'deep'), '020-c')

    expect(expandStackEntry(root, 'core')).toEqual(['020-c'])
  })
})

describe('resolveRules with folder entries', () => {
  it('should resolve a stack naming a folder to the rules in it', () => {
    seedRule('core', '000-a')
    seedRule('core', '010-b')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')

    expect(resolveRules(root, 'base')).toEqual({
      ok: true,
      rules: ['000-a', '010-b'],
    })
  })

  it('should resolve a stack mixing a folder entry with a slug entry', () => {
    seedRule('core', '000-a')
    seedRule('claude', '500-c')
    seedRule('lib', '300-d')
    seedStack('base', 'extends = ""\nrules = ["core", "500-c"]\n')
    seedStack('node', 'extends = "base"\nrules = ["300-d"]\n')

    expect(resolveRules(root, 'node')).toEqual({
      ok: true,
      rules: ['000-a', '500-c', '300-d'],
    })
  })

  it('should yield a rule once when a folder entry and a slug entry both reach it', () => {
    seedRule('core', '000-a')
    seedRule('core', '010-b')
    seedStack('base', 'extends = ""\nrules = ["000-a"]\n')
    seedStack('node', 'extends = "base"\nrules = ["core"]\n')

    expect(resolveRules(root, 'node')).toEqual({
      ok: true,
      rules: ['000-a', '010-b'],
    })
  })
})

describe('resolveMissingRules', () => {
  it('should name a rule the leaf chain entry lists that the target lacks', () => {
    seedRule('ui', '400-ui')
    seedRule('ui', '440-capture')
    seedStack('astro', 'extends = ""\nrules = ["400-ui", "440-capture"]\n')
    installRule('ui', '400-ui')

    const missing = resolveMissingRules(root, target, ['astro'])

    expect(missing.map((source) => source.rule)).toEqual(['440-capture'])
  })

  it('should resolve the chain leaf through its extends ancestors', () => {
    seedRule('core', '000-a')
    seedRule('ui', '400-ui')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')
    seedStack('astro', 'extends = "base"\nrules = ["400-ui"]\n')

    const missing = resolveMissingRules(root, target, ['astro'])

    expect(missing.map((source) => source.rule)).toEqual(['000-a', '400-ui'])
  })

  it('should return nothing when the target already holds every entitled rule', () => {
    seedRule('ui', '400-ui')
    seedStack('astro', 'extends = ""\nrules = ["400-ui"]\n')
    installRule('ui', '400-ui')

    expect(resolveMissingRules(root, target, ['astro'])).toEqual([])
  })

  it('should return nothing for an empty chain', () => {
    expect(resolveMissingRules(root, target, [])).toEqual([])
  })

  it('should return nothing when the leaf names a stack the toolkit no longer ships', () => {
    expect(resolveMissingRules(root, target, ['ghost'])).toEqual([])
  })

  it('should ignore a rule an extra the target added installs that no stack lists', () => {
    seedRule('ui', '400-ui')
    seedStack('astro', 'extends = ""\nrules = ["400-ui"]\n')
    installRule('lib', '300-extra')

    const missing = resolveMissingRules(root, target, ['astro'])

    expect(missing.map((source) => source.rule)).toEqual(['400-ui'])
  })
})

describe('unreferencedRules', () => {
  it('should name a rule no stack reaches', () => {
    seedRule('core', '000-a')
    seedRule('lib', '300-orphan')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')

    expect(unreferencedRules(root)).toEqual(['300-orphan'])
  })

  it('should count a rule reached through a folder entry as referenced', () => {
    seedRule('core', '000-a')
    seedRule('core', '010-b')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')

    expect(unreferencedRules(root)).toEqual([])
  })

  it('should skip a stack whose parent does not resolve rather than reporting every rule', () => {
    seedRule('core', '000-a')
    seedStack('base', 'extends = ""\nrules = ["core"]\n')
    seedStack('broken', 'extends = "ghost"\nrules = []\n')

    expect(unreferencedRules(root)).toEqual([])
  })
})

describe('mergeExtraRules', () => {
  it('should append comma-separated extras after the stack rules', () => {
    expect(mergeExtraRules(['000-a'], '200-react,260-shadcn')).toEqual([
      '000-a',
      '200-react',
      '260-shadcn',
    ])
  })

  it('should trim surrounding whitespace from each extra', () => {
    expect(mergeExtraRules([], ' 200-react , 260-shadcn ')).toEqual([
      '200-react',
      '260-shadcn',
    ])
  })

  it('should skip an extra the stack already resolved', () => {
    expect(mergeExtraRules(['200-react'], '200-react,260-shadcn')).toEqual([
      '200-react',
      '260-shadcn',
    ])
  })

  it('should ignore empty entries from a trailing comma', () => {
    expect(mergeExtraRules([], '200-react,,')).toEqual(['200-react'])
  })
})

describe('listGovStacks', () => {
  it('should list stack names without the toml extension', () => {
    seedStack('node', 'rules = []\n')
    seedStack('base', 'rules = []\n')

    expect(listGovStacks(root)).toEqual(['base', 'node'])
  })

  it('should return an empty list when no stacks directory exists', () => {
    expect(listGovStacks(join(root, 'nowhere'))).toEqual([])
  })
})
