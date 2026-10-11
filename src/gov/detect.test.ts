import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectRules, staleDetectKeys } from '@/gov/detect'

let root: string
let target: string

const DETECT = [
  '["200-react"]',
  'deps = ["react"]',
  'files = []',
  '',
  '["700-ci-workflow"]',
  'deps = []',
  'files = [".github/workflows"]',
  '',
  '["340-pydantic"]',
  'deps = ["pydantic"]',
  'files = []',
  '',
  '["100-typescript"]',
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
    'framework/200-react',
    'tooling/700-ci-workflow',
    'lib/340-pydantic',
    'lang/100-typescript',
  ]) {
    write(root, `governance/rules/${rule}.md`, `# ${rule}\n`)
  }
  write(root, 'governance/stacks/node.toml', 'rules = ["100-typescript"]\n')
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
          rule: '200-react',
          evidence: [{ kind: 'dep', match: 'react', path: 'package.json' }],
        },
      ],
    })
  })

  it('should propose a rule from a folder holding a workflow', async () => {
    seedToolkit()
    write(target, '.github/workflows/ci.yml', 'on: push\n')

    expect(await proposedRules()).toEqual(['700-ci-workflow'])
  })

  it('should propose a rule from a pyproject.toml dependency', async () => {
    seedToolkit()
    write(
      target,
      'pyproject.toml',
      '[project]\nname = "svc"\ndependencies = ["Pydantic>=2.0"]\n',
    )

    expect(await proposedRules()).toEqual(['340-pydantic'])
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

  it('should leave out a rule the named stack already resolves', async () => {
    seedToolkit()
    write(
      target,
      'package.json',
      packageJson({ react: '^19', typescript: '^5' }),
    )

    expect(await proposedRules('node')).toEqual(['200-react'])
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

    expect(await proposedRules()).toEqual(['200-react'])
  })
})

describe('staleDetectKeys', () => {
  it('should name a key with no rule under governance/rules', () => {
    seedToolkit(`${DETECT}["999-retired"]\ndeps = []\nfiles = []\n`)

    expect(staleDetectKeys(root)).toEqual(['999-retired'])
  })
})
