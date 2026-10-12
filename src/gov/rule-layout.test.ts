import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listRuleSourcePaths, rulesSourceDir } from '@/gov/install'
import { buildRuleEntries } from '@/gov/list'

const REPO_ROOT = join(import.meta.dirname, '..', '..')

// The first segments under `.claude/` the current layout keeps, being where
// the vendor reads rules, skills, hooks, and settings, plus the worktree and
// per-user project folders the harness owns. A root the next layout move
// retires fails here without anyone naming it.
const CURRENT_CLAUDE_ROOTS = [
  'rules',
  'skills',
  'hooks',
  'settings.json',
  'worktrees',
  'projects',
]

const SEED_ROOT = 'tooling/claude/seeds/'
// `*` stays in the segment, so a wildcard-first glob such as `.claude/*.md`
// reads as a root the allow-list never names and fails.
const CLAUDE_PATH = /\.claude\/([^/\s`'")]+)/g

let root: string

function seedRule(rel: string, content: string): void {
  const path = join(rulesSourceDir(root), rel)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

// A bare path ending a clause carries the clause's punctuation into the match.
const TRAILING_PUNCTUATION = /[.,;:]+$/

function retiredClaudePaths(rel: string, text: string): string[] {
  return [...text.matchAll(CLAUDE_PATH)]
    .map((match) => match[1].replace(TRAILING_PUNCTUATION, ''))
    .filter((segment) => !CURRENT_CLAUDE_ROOTS.includes(segment))
    .map(
      (segment) =>
        `${rel}: .claude/${segment} is outside the current layout (${CURRENT_CLAUDE_ROOTS.join(', ')})`,
    )
}

// Both trees install side by side and resolve a stack entry by basename, where a
// folder name wins over a rule of the same name. The numeric prefix once kept
// every basename distinct and off every folder name, and this check holds that
// now the prefix is gone.
function nameCollisions(toolkit: string): string[] {
  const owners = new Map<string, string[]>()
  const folders = new Set<string>()

  for (const tree of [
    rulesSourceDir(toolkit),
    join(toolkit, 'internal', 'rules'),
  ]) {
    for (const rel of new Bun.Glob('**/*.md').scanSync({
      cwd: tree,
      onlyFiles: true,
    })) {
      const name = basename(rel, '.md')
      owners.set(name, [...(owners.get(name) ?? []), rel])
      for (let dir = dirname(rel); dir !== '.'; dir = dirname(dir)) {
        folders.add(basename(dir))
      }
    }
  }

  return [...owners]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([name, rels]) => [
      ...(rels.length > 1 ? [`${name}: repeats at ${rels.join(', ')}`] : []),
      ...(folders.has(name) ? [`${name}: equals a rules folder name`] : []),
    ])
}

function layoutFindings(toolkit: string): string[] {
  const rulesRoot = rulesSourceDir(toolkit)
  const bodies = listRuleSourcePaths(toolkit).flatMap((rel) =>
    retiredClaudePaths(rel, readFileSync(join(rulesRoot, rel), 'utf8')),
  )
  const seedGlobs = buildRuleEntries(toolkit).flatMap((entry) =>
    (entry.paths ?? [])
      .filter((glob) => glob.startsWith(SEED_ROOT))
      .map(
        (glob) =>
          `${entry.domain}/${entry.name}: ${glob} names a path only the toolkit carries`,
      ),
  )
  return [...bodies, ...seedGlobs]
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-rule-layout-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('rule layout', () => {
  it('should name no retired .claude/ root in any shipped rule', () => {
    const findings = layoutFindings(REPO_ROOT)

    expect(findings).toEqual([])
  })

  it('should keep every rule basename unique and off every folder name', () => {
    const findings = nameCollisions(REPO_ROOT)

    expect(findings).toEqual([])
  })

  it('should flag a rule named for a folder and a repeated basename', () => {
    seedRule('ui/ui.md', '# UI\n')
    seedRule('ui/forms.md', '# Forms\n')
    mkdirSync(join(root, 'internal', 'rules', 'core'), { recursive: true })
    writeFileSync(
      join(root, 'internal', 'rules', 'core', 'forms.md'),
      '# Forms\n',
    )

    const findings = nameCollisions(root)

    expect(findings).toEqual([
      'forms: repeats at ui/forms.md, core/forms.md',
      'ui: equals a rules folder name',
    ])
  })

  it('should flag a retired root in a glob and in a body line', () => {
    seedRule(
      'canon/610-context.md',
      "---\npaths:\n  - '.claude/context/**'\n  - '.claude/*.md'\n  - '.claude/**/DESIGN.md'\n---\n\n- Read `.claude/REQUIREMENTS.md` first\n",
    )

    const findings = layoutFindings(root)

    expect(findings).toEqual([
      'canon/610-context.md: .claude/context is outside the current layout (rules, skills, hooks, settings.json, worktrees, projects)',
      'canon/610-context.md: .claude/*.md is outside the current layout (rules, skills, hooks, settings.json, worktrees, projects)',
      'canon/610-context.md: .claude/** is outside the current layout (rules, skills, hooks, settings.json, worktrees, projects)',
      'canon/610-context.md: .claude/REQUIREMENTS.md is outside the current layout (rules, skills, hooks, settings.json, worktrees, projects)',
    ])
  })

  it('should flag a glob under the toolkit seed tree', () => {
    seedRule(
      'claude/576-fixture-settings.md',
      "---\npaths:\n  - '.claude/settings.json'\n  - 'tooling/claude/seeds/.claude/settings.json'\n---\n",
    )

    const findings = layoutFindings(root)

    expect(findings).toEqual([
      'claude/576-fixture-settings: tooling/claude/seeds/.claude/settings.json names a path only the toolkit carries',
    ])
  })

  it('should pass the current roots, including a home-relative one', () => {
    seedRule(
      'claude/566-output.md',
      '- Under `.claude/worktrees/<name>/`, not `~/.claude/projects/`, see `.claude/rules/canon/x.md`\n- Edit .claude/hooks, then .claude/settings.json.\n',
    )

    const findings = layoutFindings(root)

    expect(findings).toEqual([])
  })
})
