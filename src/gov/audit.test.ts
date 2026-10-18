import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  auditExit,
  measureRule,
  readRuleAudit,
  type RuleAuditReport,
} from '@/gov/audit'

let ROOT: string

function write(path: string, body: string): void {
  const full = join(ROOT, path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, `${body}\n`)
}

function rule(body: string): string {
  return ['---', 'description: Fixture', '---', '', body].join('\n')
}

function bullets(count: number, text = 'Keep it short.'): string {
  return Array.from({ length: count }, () => `- ${text}`).join('\n')
}

function limits(text: string): string[] {
  return measureRule(text).findings.map((finding) => finding.limit)
}

function measured(
  report: RuleAuditReport,
): Extract<RuleAuditReport, { kind: 'measured' }> {
  if (report.kind !== 'measured') throw new Error(report.message)
  return report
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'gov-audit-'))
})

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('measureRule', () => {
  it('should pass a body at 15 bullets', () => {
    const text = rule(
      ['# R', '## A', bullets(7), '## B', bullets(7), '## C', bullets(1)].join(
        '\n',
      ),
    )

    expect(limits(text)).toEqual([])
  })

  it('should report a body at 16 bullets', () => {
    const text = rule(
      ['# R', '## A', bullets(6), '## B', bullets(6), '## C', bullets(4)].join(
        '\n',
      ),
    )

    expect(measureRule(text).findings).toEqual([
      { limit: 'bullets', count: 16, max: 15 },
    ])
  })

  it('should pass 7 bullets under one H2', () => {
    expect(limits(rule(['# R', '## A', bullets(7)].join('\n')))).toEqual([])
  })

  it('should report 8 bullets under one H2', () => {
    expect(limits(rule(['# R', '## A', bullets(8)].join('\n')))).toEqual([
      'perH2',
    ])
  })

  it('should count a body with no H2 as one group', () => {
    expect(limits(rule(['# R', bullets(8)].join('\n')))).toEqual(['perH2'])
  })

  it('should pass 6 H2s and report 7', () => {
    const headings = (count: number) =>
      Array.from({ length: count }, (_, i) => `## H${i}\n- One.`).join('\n')

    expect(limits(rule(`# R\n${headings(6)}`))).toEqual([])
    expect(limits(rule(`# R\n${headings(7)}`))).toEqual(['h2'])
  })

  it('should pass 300 words and report 301', () => {
    const words = (count: number) => Array(count).fill('word').join(' ')

    expect(limits(rule(words(300)))).toEqual([])
    expect(limits(rule(words(301)))).toEqual(['words'])
  })

  it('should pass a 200 character bullet and report one at 201 with its line', () => {
    const at = `- ${'a'.repeat(199)}.`
    const past = `- ${'a'.repeat(200)}.`

    expect(limits(rule(at))).toEqual([])
    expect(measureRule(rule(past)).findings).toEqual([
      { limit: 'chars', count: 201, max: 200, line: 5 },
    ])
  })

  it('should fold a continuation line into the bullet above it', () => {
    const text = rule(`- ${'a'.repeat(150)}\n  ${'b'.repeat(60)}.`)

    expect(limits(text)).toEqual(['chars'])
  })

  it('should pass two sentences in a bullet and report three', () => {
    expect(limits(rule('- Do this. Unless that.'))).toEqual([])
    expect(limits(rule('- Do this. Unless that. Because of it.'))).toEqual([
      'sentences',
    ])
  })

  it('should read no sentence end inside a code span or an abbreviation', () => {
    expect(
      limits(rule('- Run `a. b. c.` here, e.g. on a push, i.e. always.')),
    ).toEqual([])
  })

  it('should report an emphasis word in a bullet', () => {
    expect(limits(rule('- You MUST run it.'))).toEqual(['emphasis'])
    expect(limits(rule('- you must run it.'))).toEqual(['emphasis'])
  })

  it('should read no emphasis word inside a code span', () => {
    expect(limits(rule('- Quote `IMPORTANT` as written.'))).toEqual([])
  })

  it('should count no bullet inside a fenced block', () => {
    const text = rule(['# R', '```', bullets(8), '```', bullets(1)].join('\n'))

    expect(measureRule(text).bullets).toBe(1)
  })
})

describe('readRuleAudit in a canon checkout', () => {
  const practice = join('governance', 'rules', 'lang', 'go.md')
  const ledger = join('governance', 'ledger', 'lang', 'go.md')

  function table(rows: number): string {
    return [
      '| Bullet | Source |',
      '| ------ | ------ |',
      ...Array.from({ length: rows }, (_, i) => `| b${i} | house choice |`),
    ].join('\n')
  }

  beforeEach(() => {
    write(practice, rule(['# Go', '## Errors', bullets(2)].join('\n')))
  })

  it('should report a practice rule with no ledger', async () => {
    const report = measured(await readRuleAudit(ROOT))

    expect(report.rules[0]?.ledger).toEqual({ status: 'missing', path: ledger })
  })

  it('should pass a ledger with one row per bullet under the same heading', async () => {
    write(ledger, `# Go ledger\n\n## Errors\n\n${table(2)}`)

    const report = measured(await readRuleAudit(ROOT))

    expect(report.rules[0]?.ledger).toEqual({
      status: 'present',
      path: ledger,
      mismatches: [],
    })
  })

  it('should report a heading whose ledger is a row short', async () => {
    write(ledger, `# Go ledger\n\n## Errors\n\n${table(1)}`)

    const report = measured(await readRuleAudit(ROOT))

    expect(report.rules[0]?.ledger).toEqual({
      status: 'present',
      path: ledger,
      mismatches: [{ heading: 'Errors', bullets: 2, rows: 1 }],
    })
  })

  it('should ask no ledger of a behavioral or internal rule', async () => {
    write(join('governance', 'rules', 'canon', 'git.md'), rule(bullets(1)))
    write(join('internal', 'rules', 'core', 'cli.md'), rule(bullets(1)))

    const report = measured(await readRuleAudit(ROOT))
    const unrequired = report.rules.filter(
      (reading) => reading.ledger.status === 'not-required',
    )

    expect(unrequired.map((reading) => reading.file)).toEqual([
      join('governance', 'rules', 'canon', 'git.md'),
      join('internal', 'rules', 'core', 'cli.md'),
    ])
  })

  it('should measure every rule under a folder argument, trailing slash or not', async () => {
    write(join('governance', 'rules', 'canon', 'a.md'), rule(bullets(1)))
    write(join('governance', 'rules', 'canon', 'b.md'), rule(bullets(1)))
    const files = [
      join('governance', 'rules', 'canon', 'a.md'),
      join('governance', 'rules', 'canon', 'b.md'),
    ]

    const bare = measured(
      await readRuleAudit(ROOT, [join('governance', 'rules', 'canon')]),
    )
    const slashed = measured(
      await readRuleAudit(ROOT, [join('governance', 'rules', 'canon') + '/']),
    )

    expect(bare.rules.map((reading) => reading.file)).toEqual(files)
    expect(slashed.rules.map((reading) => reading.file)).toEqual(files)
  })

  it('should read a folder beside a file named with it', async () => {
    write(join('governance', 'rules', 'canon', 'a.md'), rule(bullets(1)))

    const report = measured(
      await readRuleAudit(ROOT, [
        join('governance', 'rules', 'canon'),
        practice,
      ]),
    )

    expect(report.rules.map((reading) => reading.file)).toEqual([
      join('governance', 'rules', 'canon', 'a.md'),
      practice,
    ])
  })

  it('should refuse a folder holding no rule with no-rules naming it', async () => {
    mkdirSync(join(ROOT, 'governance', 'rules', 'empty'), { recursive: true })

    const report = await readRuleAudit(ROOT, [
      join('governance', 'rules', 'empty'),
    ])

    expect(report).toMatchObject({ kind: 'unreadable', reason: 'no-rules' })
    expect(report.kind === 'unreadable' && report.message).toContain(
      join('governance', 'rules', 'empty'),
    )
  })
})

describe('readRuleAudit in a target', () => {
  it('should read .claude/rules/project/ alone and ask no ledger', async () => {
    write(join('.claude', 'rules', 'project', 'api.md'), rule(bullets(16)))
    write(join('.claude', 'rules', 'canon', 'git.md'), rule(bullets(16)))

    const report = measured(await readRuleAudit(ROOT))

    expect(report.scope).toBe('target')
    expect(report.rules.map((reading) => reading.file)).toEqual([
      join('.claude', 'rules', 'project', 'api.md'),
    ])
    expect(report.rules[0]?.ledger.status).toBe('not-required')
    expect(report.rules[0]?.findings.map((finding) => finding.limit)).toEqual([
      'bullets',
      'perH2',
    ])
  })

  it('should refuse a tree holding no rule corpus', async () => {
    const report = await readRuleAudit(ROOT)

    expect(report).toMatchObject({ kind: 'unreadable', reason: 'no-rules' })
  })

  it('should refuse a named path that does not exist', async () => {
    const report = await readRuleAudit(ROOT, ['nope.md'])

    expect(report).toMatchObject({ kind: 'unreadable', reason: 'no-path' })
  })

  it('should refuse a named path outside the root', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'gov-audit-outside-'))
    writeFileSync(join(outside, 'go.md'), rule(bullets(1)))

    const report = await readRuleAudit(ROOT, [join(outside, 'go.md')])
    rmSync(outside, { recursive: true, force: true })

    expect(report).toMatchObject({ kind: 'unreadable', reason: 'outside-root' })
  })

  it('should resolve a named path against the root rather than the cwd', async () => {
    write(join('.claude', 'rules', 'project', 'api.md'), rule(bullets(1)))

    const report = measured(
      await readRuleAudit(ROOT, [
        join('.claude', 'rules', 'project', 'api.md'),
      ]),
    )

    expect(report.rules.map((reading) => reading.file)).toEqual([
      join('.claude', 'rules', 'project', 'api.md'),
    ])
  })
})

describe('auditExit', () => {
  const framework = join('governance', 'rules', 'framework', 'react.md')

  beforeEach(() => {
    write(framework, rule(bullets(16)))
  })

  it('should exit 2 on any finding without the gate flag', async () => {
    const report = measured(await readRuleAudit(ROOT))

    expect(auditExit(report, { gate: false, gated: [] })).toBe(2)
  })

  it('should exit 0 under the gate flag while the folder is ungated', async () => {
    const report = measured(await readRuleAudit(ROOT))

    expect(auditExit(report, { gate: true, gated: [] })).toBe(0)
  })

  it('should exit 2 under the gate flag once the folder is gated', async () => {
    const report = measured(await readRuleAudit(ROOT))

    expect(
      auditExit(report, {
        gate: true,
        gated: [join('governance', 'rules', 'framework') + '/'],
      }),
    ).toBe(2)
  })

  it('should exit 0 under the gate flag when the finding is in an exempt file', async () => {
    const canvas = join('governance', 'rules', 'ui', 'canvas.md')
    write(canvas, rule(bullets(16)))
    const report = measured(await readRuleAudit(ROOT))

    expect(
      auditExit(report, {
        gate: true,
        gated: [join('governance', 'rules', 'ui') + '/'],
        exempt: [canvas],
      }),
    ).toBe(0)
  })

  it('should exit 2 under the gate flag when a sibling of an exempt file has a finding', async () => {
    const canvas = join('governance', 'rules', 'ui', 'canvas.md')
    write(canvas, rule(bullets(16)))
    write(join('governance', 'rules', 'ui', 'forms.md'), rule(bullets(16)))
    const report = measured(await readRuleAudit(ROOT))

    expect(
      auditExit(report, {
        gate: true,
        gated: [join('governance', 'rules', 'ui') + '/'],
        exempt: [canvas],
      }),
    ).toBe(2)
  })

  it('should exit 0 on a clean corpus', async () => {
    write(framework, rule(bullets(1)))
    write(
      join('governance', 'ledger', 'framework', 'react.md'),
      '# L\n\n| B | S |\n| - | - |\n| a | b |',
    )

    const report = measured(await readRuleAudit(ROOT))

    expect(auditExit(report, { gate: false, gated: [] })).toBe(0)
  })
})
