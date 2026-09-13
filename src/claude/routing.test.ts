import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  coveringRule,
  namedPaths,
  readRuleGlobs,
  scanRouting,
  splitSections,
} from '@/claude/routing'

let root: string

function write(rel: string, text: string): void {
  const path = join(root, rel)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'canon-routing-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('namedPaths', () => {
  it('should read a backticked folder as a named path', () => {
    expect(namedPaths('- Write scratch to `.claude/.tmp/`.')).toEqual([
      '.claude/.tmp/',
    ])
  })

  it('should read a root file with an alphabetic extension', () => {
    expect(namedPaths('- Add the term to `cspell.json`.')).toEqual([
      'cspell.json',
    ])
  })

  it('should reject a flag, a bare word, and a version string', () => {
    expect(
      namedPaths('- Pass `--json` to `canon`, released as `3.6.0`.'),
    ).toEqual([])
  })

  it('should read a shape as the folder above its placeholder', () => {
    expect(namedPaths('- Read `canon/context/<domain>.md` first.')).toEqual([
      'canon/context/',
    ])
  })

  it('should reject a shape whose placeholder opens the first segment', () => {
    expect(namedPaths('- Load `<skill>/SKILL.md` before editing.')).toEqual([])
  })

  it('should list each distinct path once in reading order', () => {
    expect(
      namedPaths('- `src/cli.ts` and `src/ui.ts` and `src/cli.ts` again.'),
    ).toEqual(['src/cli.ts', 'src/ui.ts'])
  })
})

describe('splitSections', () => {
  it('should count only top-level bullets under the heading that owns them', () => {
    const sections = splitSections(
      [
        '# Root',
        '',
        '## Behavior',
        '',
        '- one',
        '  - nested',
        '- two',
        '',
      ].join('\n'),
    )

    expect(sections).toHaveLength(1)
    expect(sections[0]?.heading).toBe('Behavior')
    expect(sections[0]?.lines).toEqual(['- one', '- two'])
  })

  it('should qualify a subsection with the section containing it', () => {
    const sections = splitSections(
      ['## Behavior', '', '- one', '', '### Scope', '', '- two', ''].join('\n'),
    )

    expect(sections.map((section) => section.heading)).toEqual([
      'Behavior',
      'Behavior / Scope',
    ])
  })

  it('should ignore a bullet inside a fenced block', () => {
    const sections = splitSections(
      [
        '## Commands',
        '',
        '```sh',
        '- not a bullet',
        '```',
        '',
        '- real',
        '',
      ].join('\n'),
    )

    expect(sections[0]?.lines).toEqual(['- real'])
  })

  it('should drop a heading that carries no bullet', () => {
    expect(
      splitSections(['## Empty', '', 'Prose only.', ''].join('\n')),
    ).toEqual([])
  })
})

describe('readRuleGlobs', () => {
  it('should collect every glob a rule declares', () => {
    write(
      '.claude/rules/claude/510-context.md',
      [
        '---',
        'description: x',
        'paths:',
        "  - 'canon/context/**'",
        '---',
        '',
      ].join('\n'),
    )

    expect(readRuleGlobs(root)).toEqual([
      { rule: 'claude/510-context.md', globs: ['canon/context/**'] },
    ])
  })

  it('should ignore a quoted bullet in the body', () => {
    write(
      '.claude/rules/claude/510-context.md',
      [
        '---',
        'description: x',
        'paths:',
        "  - 'canon/context/**'",
        '---',
        '',
        '# Context entry standards',
        '',
        "- Never write to 'wiki/**' from here.",
        '',
      ].join('\n'),
    )

    expect(readRuleGlobs(root)).toEqual([
      { rule: 'claude/510-context.md', globs: ['canon/context/**'] },
    ])
  })

  it('should skip an always-on rule that declares no paths', () => {
    write(
      '.claude/rules/core/000-constitution.md',
      ['---', 'description: x', '---', ''].join('\n'),
    )

    expect(readRuleGlobs(root)).toEqual([])
  })
})

describe('coveringRule', () => {
  const globs = [
    { rule: 'claude/510-context.md', globs: ['canon/context/**'] },
    { rule: 'claude/501-markdown.md', globs: ['**/*.md'] },
    { rule: 'claude/592-claude-md.md', globs: ['CLAUDE.md'] },
    { rule: 'core/097-non-interactive.md', globs: ['src/**/*.ts'] },
  ]

  it('should name the rule whose glob reaches under a named folder', () => {
    expect(coveringRule('canon/context/', globs)).toBe('claude/510-context.md')
  })

  it('should reach a folder whose files are not markdown', () => {
    expect(coveringRule('src/', globs)).toBe('core/097-non-interactive.md')
  })

  it('should match a named file against the rule anchored to it', () => {
    expect(coveringRule('CLAUDE.md', globs)).toBe('claude/592-claude-md.md')
  })

  it('should not count a corpus-wide glob as covering a path', () => {
    expect(coveringRule('README.md', globs)).toBeUndefined()
  })

  it('should return undefined when no glob reaches the path', () => {
    expect(coveringRule('wiki/', globs)).toBeUndefined()
  })
})

describe('scanRouting', () => {
  it('should refuse a tree with no CLAUDE.md', () => {
    write('.claude/rules/core/000-x.md', '---\ndescription: x\n---\n')

    expect(scanRouting(root)).toEqual({
      kind: 'refused',
      reason: 'no-claude-md',
    })
  })

  it('should refuse a tree with no installed rules', () => {
    write('CLAUDE.md', '## Behavior\n\n- one\n')

    expect(scanRouting(root)).toEqual({ kind: 'refused', reason: 'no-rules' })
  })

  it('should report per section how many bullets name a path and how many a rule covers', () => {
    write(
      '.claude/rules/claude/510-context.md',
      [
        '---',
        'description: x',
        'paths:',
        "  - 'canon/context/**'",
        '---',
        '',
      ].join('\n'),
    )
    write(
      'CLAUDE.md',
      [
        '# Root',
        '',
        '## Behavior',
        '',
        '- Confirm before editing.',
        '- Read `canon/context/index.md` first.',
        '- Never write to `wiki/` unasked.',
        '',
      ].join('\n'),
    )

    const report = scanRouting(root)
    expect(report.kind).toBe('measured')
    if (report.kind !== 'measured') return

    expect(report.rules).toBe(1)
    expect(report.sections).toHaveLength(1)

    const [section] = report.sections
    expect(section?.bullets).toBe(3)
    expect(section?.pathScoped).toBe(2)
    expect(section?.covered).toBe(1)
    expect(section?.uncovered).toEqual(['wiki/'])
  })
})
