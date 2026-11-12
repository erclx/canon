import { describe, expect, it } from 'vitest'
import type { AuditResult, AuditSpec } from '@/audits/catalog'
import { AUDITS, auditFor } from '@/audits/catalog'
import type { Delta } from '@/audits/baseline'
import {
  auditsFor,
  EXIT_FINDING,
  EXIT_UNMEASURED,
  exitCodeFor,
  runAudits,
  summarize,
  verdictOf,
} from '@/audits/run'

function specFor(id: string): AuditSpec {
  const spec = auditFor(id)
  if (spec === undefined) throw new Error(`No audit registered as ${id}`)
  return spec
}

function result(id: string, status: AuditResult['status']): AuditResult {
  return {
    id,
    label: id,
    status,
    tracked: true,
    corpus: 'tracked',
    exitCode: 0,
    ms: 0,
  }
}

describe('running the audit set', () => {
  it('should return one result per audit, in catalog order', async () => {
    const results = await runAudits(AUDITS, async () => ({
      exitCode: 0,
      stdout: '',
    }))

    expect(results.map((entry) => entry.id)).toEqual(
      AUDITS.map((audit) => audit.id),
    )
  })

  /**
   * The verbs walk separate trees and share no state, so running them
   * sequentially would make the aggregate the slowest thing in the pipeline
   * for no reason. This pins the batching rather than trusting it.
   */
  it('should start every audit before any of them finishes', async () => {
    let running = 0
    let peak = 0

    await runAudits(AUDITS, async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running -= 1
      return { exitCode: 0, stdout: '{}' }
    })

    expect(peak).toBe(AUDITS.length)
  })

  it('should classify each audit by the exit code its spawn reported', async () => {
    const results = await runAudits([specFor('comments')], async () => ({
      exitCode: 0,
      stdout: '{"snapshot":[{"language":"ts","degradationHits":[{},{}]}]}',
    }))

    expect(results[0].status).toBe('reported')
    expect(results[0].counts).toEqual({ degradationHits: 2 })
  })

  /**
   * A spawn that throws is a binary that could not be started, which is a
   * measure that did not run. Letting it reject would take the whole aggregate
   * down over one absent verb and report nothing about the eleven that worked.
   */
  it('should report an audit whose spawn threw as unmeasured', async () => {
    const results = await runAudits([specFor('markdown')], async () => {
      throw new Error('spawn ENOENT')
    })

    expect(results[0].status).toBe('unmeasured')
    expect(results[0].reason).toContain('spawn ENOENT')
  })

  it('should carry a duration on every result, whichever verb it waited on', async () => {
    const results = await runAudits([specFor('markdown')], async () => ({
      exitCode: 0,
      stdout: '{}',
    }))

    expect(results[0].ms).toBeGreaterThanOrEqual(0)
  })
})

describe('scoping the catalog to a corpus', () => {
  it('should return the whole catalog when no corpus was requested', () => {
    expect(auditsFor(AUDITS, [])).toEqual(AUDITS)
  })

  it('should keep only the specs whose corpus was named', () => {
    const scoped = auditsFor(AUDITS, ['upstream'])

    expect(scoped.every((audit) => audit.corpus === 'upstream')).toBe(true)
    expect(scoped.map((audit) => audit.id)).toContain('deps')
  })

  it('should union more than one requested corpus', () => {
    const scoped = auditsFor(AUDITS, ['tracked', 'per-machine'])

    expect(scoped.some((audit) => audit.corpus === 'upstream')).toBe(false)
    expect(scoped.length).toBe(AUDITS.length - 1)
  })
})

describe('the verdict over a set of results', () => {
  it('should read a set where every audit was quiet as clean', () => {
    expect(verdictOf([result('a', 'clean'), result('b', 'clean')])).toBe(
      'clean',
    )
  })

  it('should read a set carrying a judgment finding as reported', () => {
    expect(verdictOf([result('a', 'clean'), result('b', 'reported')])).toBe(
      'reported',
    )
  })

  it('should read a set carrying a fact as findings', () => {
    expect(verdictOf([result('a', 'reported'), result('b', 'finding')])).toBe(
      'findings',
    )
  })

  /**
   * An audit that did not report outranks a quiet set, because the alternative
   * is publishing a pass over a tree that was never fully measured.
   */
  it('should read a set carrying an unmeasured audit as incomplete', () => {
    expect(verdictOf([result('a', 'clean'), result('b', 'unmeasured')])).toBe(
      'incomplete',
    )
  })

  it('should let a fact outrank an unmeasured audit', () => {
    expect(verdictOf([result('a', 'unmeasured'), result('b', 'finding')])).toBe(
      'findings',
    )
  })

  it('should read an empty set as incomplete rather than clean', () => {
    expect(verdictOf([])).toBe('incomplete')
  })
})

describe('the exit code the aggregate sets', () => {
  it('should exit clean when every audit reported and none carried a fact', () => {
    expect(exitCodeFor([result('a', 'clean'), result('b', 'reported')])).toBe(0)
  })

  /**
   * A judgment moves no exit code. Failing a push on one teaches contributors
   * to route around the stage, which is the split this repository records and
   * the reason the aggregate adds nothing to what already gates.
   */
  it('should not fail on a judgment finding alone', () => {
    expect(exitCodeFor([result('a', 'reported')])).toBe(0)
  })

  it('should fail on a fact', () => {
    expect(exitCodeFor([result('a', 'finding')])).toBe(EXIT_FINDING)
  })

  it('should fail when an audit did not report', () => {
    expect(exitCodeFor([result('a', 'clean'), result('b', 'unmeasured')])).toBe(
      EXIT_UNMEASURED,
    )
  })

  it('should report a fact ahead of an unmeasured audit', () => {
    expect(
      exitCodeFor([result('a', 'unmeasured'), result('b', 'finding')]),
    ).toBe(EXIT_FINDING)
  })
})

describe('the flat summary a shell stage reads', () => {
  const deltas: Delta[] = [
    {
      id: 'markdown',
      kind: 'compared',
      moved: [
        { key: 'heavyBullets', from: 1, to: 50, delta: 49 },
        { key: 'heavyParagraphs', from: 22, to: 12, delta: -10 },
      ],
      steady: ['bans'],
      added: [],
      dropped: [],
    },
    { id: 'skills', kind: 'unrecorded' },
    { id: 'records-plans', kind: 'per-machine' },
    { id: 'context', kind: 'unmeasured' },
  ]

  it('should count each moved key by the direction it went', () => {
    const summary = summarize(
      [result('markdown', 'reported'), result('context', 'unmeasured')],
      deltas,
    )

    expect(summary.grown).toBe(1)
    expect(summary.shrunk).toBe(1)
  })

  /**
   * A growth inside its tolerance stays visible in `moved` but leaves `grown`
   * alone, so a gate reading `grown` sees only growth past the tolerance.
   */
  it('should leave a tolerated growth out of grown and count one past it', () => {
    const summary = summarize(
      [result('census', 'reported')],
      [
        {
          id: 'census',
          kind: 'compared',
          moved: [
            { key: 'files', from: 2170, to: 2183, delta: 13, tolerated: true },
            { key: 'lines', from: 1000, to: 1200, delta: 200 },
          ],
          steady: [],
          added: [],
          dropped: [],
        },
      ],
    )

    expect(summary).toMatchObject({ grown: 1, shrunk: 0 })
  })

  it('should count the audits that reported apart from those that did not', () => {
    const summary = summarize(
      [result('markdown', 'reported'), result('context', 'unmeasured')],
      deltas,
    )

    expect(summary.audited).toBe(1)
    expect(summary.unmeasured).toBe(1)
    expect(summary.verdict).toBe('incomplete')
  })

  it('should count the tracked audits carrying no recorded floor', () => {
    expect(summarize([result('skills', 'clean')], deltas).unrecorded).toBe(1)
  })

  /**
   * A per-machine delta contributes to no growth figure. Its counts are one
   * machine's, so folding them in would report movement every other clone
   * cannot reproduce.
   */
  it('should leave a per-machine delta out of every count it publishes', () => {
    const summary = summarize(
      [result('records-plans', 'reported')],
      [{ id: 'records-plans', kind: 'per-machine' }],
    )

    expect(summary).toMatchObject({ grown: 0, shrunk: 0, unrecorded: 0 })
  })

  it('should count each fact the set carries', () => {
    const summary = summarize(
      [result('a', 'finding'), result('b', 'finding'), result('c', 'clean')],
      [],
    )

    expect(summary.facts).toBe(2)
    expect(summary.verdict).toBe('findings')
  })
})
