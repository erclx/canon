import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { detectRules, staleDetectKeys } from '@/gov/detect'

const REPO_ROOT = join(import.meta.dirname, '..', '..')

let root: string
let target: string

const DETECT = [
  '["react"]',
  'deps = ["react"]',
  'files = []',
  '',
  '["ci-workflow"]',
  'deps = []',
  'files = [".github/workflows"]',
  '',
  '["pydantic"]',
  'deps = ["pydantic"]',
  'files = []',
  '',
  '["typescript"]',
  'deps = ["typescript"]',
  'files = []',
  '',
].join('\n')

function write(base: string, rel: string, body: string): void {
  const path = join(base, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

function seedToolkit(detect: string = DETECT): void {
  for (const rule of [
    'framework/react',
    'tooling/ci-workflow',
    'lib/pydantic',
    'lang/typescript',
  ]) {
    write(root, `governance/rules/${rule}.md`, `# ${rule}\n`)
  }
  write(root, 'governance/stacks/node.toml', 'rules = ["typescript"]\n')
  write(root, 'governance/detect.toml', detect)
}

const packageJson = (deps: Record<string, string>): string =>
  JSON.stringify({ dependencies: deps })

async function proposedRules(stack?: string): Promise<string[]> {
  const result = await detectRules(root, target, stack)
  return result.ok ? result.proposals.map((proposal) => proposal.rule) : []
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-gov-detect-root-'))
  target = mkdtempSync(join(tmpdir(), 'canon-gov-detect-target-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(target, { recursive: true, force: true })
})

describe('detectRules', () => {
  it('should propose a rule from a package.json dependency', async () => {
    seedToolkit()
    write(target, 'package.json', packageJson({ react: '^19.0.0' }))

    const result = await detectRules(root, target)

    expect(result).toEqual({
      ok: true,
      proposals: [
        {
          rule: 'react',
          evidence: [{ kind: 'dep', match: 'react', path: 'package.json' }],
        },
      ],
    })
  })

  it('should propose the ui pointer and no retired ui rule from the shipped table', async () => {
    write(target, 'package.json', packageJson({ react: '^19.0.0' }))

    const result = await detectRules(REPO_ROOT, target)
    const ui = result.ok
      ? result.proposals
          .map((proposal) => proposal.rule)
          .filter((rule) => ['craft', 'a11y', 'design-taste'].includes(rule))
      : []

    expect(ui).toEqual(['craft'])
  })

  it('should propose a rule from a folder holding a workflow', async () => {
    seedToolkit()
    write(target, '.github/workflows/ci.yml', 'on: push\n')

    expect(await proposedRules()).toEqual(['ci-workflow'])
  })

  it('should propose a rule from a pyproject.toml dependency', async () => {
    seedToolkit()
    write(
      target,
      'pyproject.toml',
      '[project]\nname = "svc"\ndependencies = ["Pydantic>=2.0"]\n',
    )

    expect(await proposedRules()).toEqual(['pydantic'])
  })

  it('should match a literal evidence path git would ignore', async () => {
    seedToolkit(`${DETECT}["canvas"]\ndeps = []\nfiles = [".canon/canvas"]\n`)
    write(root, 'governance/rules/ui/canvas.md', '# canvas\n')
    write(target, '.gitignore', '.canon/\n')
    write(target, '.canon/canvas/board.json', '{}\n')
    execFileSync('git', ['init', '-q', target], { env: gitEnv() })

    expect(await proposedRules()).toEqual(['canvas'])
  })

  it('should read a manifest in a workspace package at depth two', async () => {
    seedToolkit()
    write(target, 'package.json', JSON.stringify({ private: true }))
    write(target, 'packages/web/package.json', packageJson({ react: '^19' }))

    const result = await detectRules(root, target)

    expect(result.ok && result.proposals[0]?.evidence).toEqual([
      { kind: 'dep', match: 'react', path: 'packages/web/package.json' },
    ])
  })

  it('should not match a folder-only pattern on a folder holding only a file', async () => {
    seedToolkit(`${DETECT}["design"]\ndeps = []\nfiles = ["canon/design/*/"]\n`)
    write(root, 'governance/rules/ui/design.md', '# design\n')
    write(target, 'canon/design/index.md', '# Design\n')

    expect(await proposedRules()).toEqual([])
  })

  it('should match a folder-only pattern on a folder holding a group folder', async () => {
    seedToolkit(`${DETECT}["design"]\ndeps = []\nfiles = ["canon/design/*/"]\n`)
    write(root, 'governance/rules/ui/design.md', '# design\n')
    write(target, 'canon/design/index.md', '# Design\n')
    write(target, 'canon/design/home/home-dark.png', 'png')

    const result = await detectRules(root, target)

    expect(result.ok && result.proposals[0]?.evidence).toEqual([
      { kind: 'file', match: 'canon/design/*/', path: 'canon/design/home' },
    ])
  })

  it('should leave out a rule the named stack already resolves', async () => {
    seedToolkit()
    write(
      target,
      'package.json',
      packageJson({ react: '^19', typescript: '^5' }),
    )

    expect(await proposedRules('node')).toEqual(['react'])
  })

  it('should refuse a stack the toolkit does not ship', async () => {
    seedToolkit()

    expect(await detectRules(root, target, 'cobol')).toEqual({
      ok: false,
      missingStack: 'cobol',
    })
  })

  it('should propose nothing for a target with no manifest outside git', async () => {
    seedToolkit()
    write(target, 'README.md', '# notes\n')

    expect(await proposedRules()).toEqual([])
  })

  it('should skip a key naming no live rule rather than proposing it', async () => {
    seedToolkit(`${DETECT}["999-retired"]\ndeps = ["react"]\nfiles = []\n`)
    write(target, 'package.json', packageJson({ react: '^19' }))

    expect(await proposedRules()).toEqual(['react'])
  })
})

describe('staleDetectKeys', () => {
  it('should name a key with no rule under governance/rules', () => {
    seedToolkit(`${DETECT}["999-retired"]\ndeps = []\nfiles = []\n`)

    expect(staleDetectKeys(root)).toEqual(['999-retired'])
  })
})
