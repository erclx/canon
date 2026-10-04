import { execaSync } from 'execa'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { gitEnv } from '@/git/env'
import { readTestOrder, type TestOrderReport } from '@/gov/test-order'

let ROOT: string

function git(...args: string[]): string {
  return execaSync('git', ['-C', ROOT, ...args], {
    env: gitEnv(),
    extendEnv: false,
  }).stdout
}

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${body}\n`)
}

function commit(message: string, files: Record<string, string>): void {
  for (const [path, body] of Object.entries(files)) write(path, body)
  git('add', '--all')
  git('commit', '-m', message)
}

function measured(
  report: TestOrderReport,
): Extract<TestOrderReport, { kind: 'measured' }> {
  if (report.kind !== 'measured') {
    throw new Error(`Expected a measured report, got: ${report.reason}`)
  }
  return report
}

function subjects(records: readonly { subject: string }[]): string[] {
  return records.map((record) => record.subject)
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'canon-gov-test-order-'))
  git('init', '--initial-branch=main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  commit('chore: init', { 'README.md': 'seed' })
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('readTestOrder', () => {
  it('should report a pair whose test reached history first as satisfied', () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('test: cover the parser', { 'src/parser.test.ts': 'test' })
    commit('feat: add the parser', { 'src/parser.ts': 'code' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.satisfied)).toEqual(['src/parser.ts'])
    expect(report.findings).toEqual([])
    expect(report.unclassified).toEqual([])
  })

  it('should report a pair whose implementation reached history first as a finding', () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('feat: add the parser', { 'src/parser.ts': 'code' })
    commit('test: cover the parser', { 'src/parser.test.ts': 'test' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.findings)).toEqual(['src/parser.ts'])
    expect(report.findings[0].test).toBe('src/parser.test.ts')
    expect(report.satisfied).toEqual([])
  })

  it('should report a refactor of an existing module as unclassified rather than as either', () => {
    commit('feat: add the parser', {
      'src/parser.ts': 'code',
      'src/parser.test.ts': 'test',
    })
    const base = git('rev-parse', 'HEAD').trim()
    commit('refactor: rename the local', { 'src/parser.ts': 'renamed local' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.unclassified)).toEqual(['src/parser.ts'])
    expect(report.findings).toEqual([])
    expect(report.satisfied).toEqual([])
  })

  it('should count one commit carrying both sides as satisfied', () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('feat: add the parser with its test', {
      'src/parser.ts': 'code',
      'src/parser.test.ts': 'test',
    })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.satisfied)).toEqual(['src/parser.ts'])
    expect(report.findings).toEqual([])
  })

  it('should count an implementation whose test predates the range as satisfied', () => {
    commit('test: cover the parser', { 'src/parser.test.ts': 'test' })
    const base = git('rev-parse', 'HEAD').trim()
    commit('feat: add the parser', { 'src/parser.ts': 'code' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.satisfied)).toEqual(['src/parser.ts'])
    expect(report.findings).toEqual([])
  })

  it('should report an implementation no test names as unclassified', () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('feat: add the parser', { 'src/parser.ts': 'code' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.unclassified)).toEqual(['src/parser.ts'])
    expect(report.unclassified[0].reason).toMatch(/no test/i)
    expect(report.findings).toEqual([])
  })

  it('should report a test added for an implementation the range never introduced as unclassified', () => {
    commit('feat: add the parser', { 'src/parser.ts': 'code' })
    const base = git('rev-parse', 'HEAD').trim()
    commit('test: cover the parser', { 'src/parser.test.ts': 'test' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(subjects(report.unclassified)).toEqual(['src/parser.ts'])
    expect(report.findings).toEqual([])
    expect(report.satisfied).toEqual([])
  })

  it('should name every path it read past rather than counting it as a pass', () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('docs: rewrite the guide', {
      'docs/guide.md': 'prose',
      'scripts/run.sh': 'shell',
    })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(report.ignored).toEqual(['docs/guide.md', 'scripts/run.sh'])
    expect(report.satisfied).toEqual([])
    expect(report.findings).toEqual([])
    expect(report.unclassified).toEqual([])
  })

  it('should read the trunk as the default base when none is passed', () => {
    git('checkout', '-q', '-b', 'feat/parser')
    commit('feat: add the parser', { 'src/parser.ts': 'code' })

    const report = measured(readTestOrder(ROOT))

    expect(subjects(report.unclassified)).toEqual(['src/parser.ts'])
  })

  it('should resolve a named base to the merge base when the trunk has moved past it', () => {
    const mergeBase = git('rev-parse', 'HEAD').trim()
    git('checkout', '-q', '-b', 'feat/parser')
    commit('test: cover the parser', { 'src/parser.test.ts': 'test' })
    commit('feat: add the parser', { 'src/parser.ts': 'code' })
    git('checkout', '-q', 'main')
    commit('feat: add the widget', { 'src/widget.ts': 'code' })
    git('checkout', '-q', 'feat/parser')

    const report = measured(readTestOrder(ROOT, { base: 'main' }))

    expect(report.base).toBe(mergeBase)
  })

  it('should report a declaration file as read past rather than as an implementation', () => {
    const base = git('rev-parse', 'HEAD').trim()
    commit('chore: declare the shim', { 'src/shim.d.ts': 'declare' })

    const report = measured(readTestOrder(ROOT, { base }))

    expect(report.ignored).toEqual(['src/shim.d.ts'])
    expect(report.unclassified).toEqual([])
  })

  it('should refuse a root carrying no repository', () => {
    const empty = mkdtempSync(join(tmpdir(), 'canon-gov-test-order-empty-'))

    const report = readTestOrder(empty)

    expect(report.kind).toBe('unreadable')
    rmSync(empty, { recursive: true, force: true })
  })

  it('should refuse a base ref the tree does not carry', () => {
    const report = readTestOrder(ROOT, { base: 'no-such-ref' })

    expect(report.kind).toBe('unreadable')
    if (report.kind === 'unreadable') {
      expect(report.reason).toBe('bad-base')
      expect(report.message).toContain('no-such-ref')
    }
  })

  it('should write a parseable reason on every refusal path', () => {
    const empty = mkdtempSync(join(tmpdir(), 'canon-gov-test-order-empty-'))

    const report = readTestOrder(empty)

    expect(report.kind).toBe('unreadable')
    if (report.kind === 'unreadable') {
      expect(report.reason).toBe('no-history')
      expect(report.message.length).toBeGreaterThan(0)
    }
    rmSync(empty, { recursive: true, force: true })
  })
})
