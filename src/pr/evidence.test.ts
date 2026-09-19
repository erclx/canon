import { describe, expect, it } from 'vitest'
import {
  findEvidenceChecklist,
  findEvidenceCommentId,
  findEvidencePreview,
  groupEvidence,
  renderEvidenceBody,
} from '@/pr/evidence'

describe('groupEvidence', () => {
  it('should refuse when no changed path carries an evidence segment', async () => {
    const reading = await groupEvidence(['src/index.ts'], async () => true)

    expect(reading).toEqual({ kind: 'refused', reason: 'no-evidence' })
  })

  it('should keep only paths under evidence/ that carry an image extension', async () => {
    const reading = await groupEvidence(
      [
        'web/evidence/dark/hero.png',
        'web/evidence/README.md',
        'web/evidence/capture.sh',
        'web/evidence/counts.tsv',
        'web/evidence/meta.json',
        'web/evidence/report.html',
      ],
      async () => true,
    )

    expect(reading).toEqual({
      kind: 'read',
      states: [
        {
          state: 'dark',
          items: [
            { path: 'web/evidence/dark/hero.png', stem: 'hero', added: false },
          ],
        },
      ],
    })
  })

  it('should group by the remainder of the path under the evidence segment', async () => {
    const reading = await groupEvidence(
      [
        'web/evidence/dark/hero.png',
        'web/evidence/light/hero.png',
        'src/index.ts',
      ],
      async () => true,
    )

    expect(reading).toEqual({
      kind: 'read',
      states: [
        {
          state: 'dark',
          items: [
            { path: 'web/evidence/dark/hero.png', stem: 'hero', added: false },
          ],
        },
        {
          state: 'light',
          items: [
            { path: 'web/evidence/light/hero.png', stem: 'hero', added: false },
          ],
        },
      ],
    })
  })

  it('should read an image directly inside evidence/ as the empty state', async () => {
    const reading = await groupEvidence(['evidence/hero.png'], async () => true)

    expect(reading).toEqual({
      kind: 'read',
      states: [
        {
          state: '',
          items: [{ path: 'evidence/hero.png', stem: 'hero', added: false }],
        },
      ],
    })
  })

  it('should sort states and, within a state, sort entries by stem', async () => {
    const reading = await groupEvidence(
      [
        'web/evidence/light/zeta.png',
        'web/evidence/dark/alpha.png',
        'web/evidence/light/alpha.png',
      ],
      async () => true,
    )

    expect(reading.kind).toBe('read')
    if (reading.kind !== 'read') return
    expect(reading.states.map((s) => s.state)).toEqual(['dark', 'light'])
    expect(reading.states[1]?.items.map((i) => i.stem)).toEqual([
      'alpha',
      'zeta',
    ])
  })

  it('should mark a path added when it did not exist at base', async () => {
    const existed = new Set(['web/evidence/dark/hero.png'])

    const reading = await groupEvidence(
      ['web/evidence/dark/hero.png', 'web/evidence/dark/new-case.png'],
      async (path) => existed.has(path),
    )

    expect(reading.kind).toBe('read')
    if (reading.kind !== 'read') return
    const items = reading.states[0]?.items ?? []
    expect(items.find((i) => i.stem === 'hero')?.added).toBe(false)
    expect(items.find((i) => i.stem === 'new-case')?.added).toBe(true)
  })
})

describe('renderEvidenceBody', () => {
  it('should render one collapsed section per state, an added case as new, and the trailing marker', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'web/evidence/dark/hero.png', stem: 'hero', added: false },
            {
              path: 'web/evidence/dark/new-case.png',
              stem: 'new-case',
              added: true,
            },
          ],
        },
      ],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
    )

    expect(body).toContain('<summary>dark (2)</summary>')
    expect(body).toContain(
      '![](https://raw.githubusercontent.com/erclx/annex/aaaa000/web/evidence/dark/hero.png)',
    )
    expect(body).toContain(
      '![](https://raw.githubusercontent.com/erclx/annex/bbbb111/web/evidence/dark/hero.png)',
    )
    expect(body).toContain('| new-case | *(new)* |')
    expect(body.trim().endsWith('<!-- pr-evidence: head=bbbb111 -->')).toBe(
      true,
    )
  })

  it('should open the body with the preview address when one is given', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'web/evidence/dark/hero.png', stem: 'hero', added: false },
          ],
        },
      ],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      'https://feat-thing.annex.pages.dev',
    )

    expect(body.split('\n')[0]).toBe(
      '**Preview:** https://feat-thing.annex.pages.dev',
    )
    expect(body).toContain('<summary>dark (1)</summary>')
  })

  it('should render the preview and the marker alone when no evidence changed', () => {
    const body = renderEvidenceBody(
      [],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      'https://feat-thing.annex.pages.dev',
    )

    expect(body).toBe(
      [
        '**Preview:** https://feat-thing.annex.pages.dev',
        '',
        '<!-- pr-evidence: head=bbbb111 -->',
      ].join('\n'),
    )
  })

  it('should render the checklist below the comparison and above the marker', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'web/evidence/dark/hero.png', stem: 'hero', added: false },
          ],
        },
      ],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] the hero settles without a jump',
    )

    const lines = body.split('\n')
    expect(lines.indexOf('## Evidence')).toBeLessThan(
      lines.indexOf('## What to look at'),
    )
    expect(lines.indexOf('## What to look at')).toBeLessThan(
      lines.indexOf('<!-- pr-evidence: head=bbbb111 -->'),
    )
    expect(body).toContain('- [ ] the hero settles without a jump')
  })

  it('should render the checklist alone when no evidence changed', () => {
    const body = renderEvidenceBody(
      [],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] the hero settles without a jump',
    )

    expect(body).toBe(
      [
        '## What to look at',
        '',
        '<!-- pr-checklist:start -->',
        '- [ ] the hero settles without a jump',
        '<!-- pr-checklist:end -->',
        '',
        '<!-- pr-evidence: head=bbbb111 -->',
      ].join('\n'),
    )
  })

  it('should round trip a rendered checklist back through the reader unchanged', () => {
    const checklist =
      '- [x] the hero settles without a jump\n- [ ] the nav wraps at 360px'
    const body = renderEvidenceBody(
      [],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      undefined,
      checklist,
    )

    expect(
      findEvidenceChecklist([
        { url: 'https://github.com/o/r/pull/1#issuecomment-222', body },
      ]),
    ).toBe(checklist)
  })
})

describe('findEvidenceCommentId', () => {
  it('should find the REST id of the comment carrying the marker', () => {
    const id = findEvidenceCommentId([
      { url: 'https://github.com/o/r/pull/1#issuecomment-111', body: 'hi' },
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## Evidence\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(id).toBe(222)
  })

  it('should return undefined when no comment carries the marker', () => {
    const id = findEvidenceCommentId([
      { url: 'https://github.com/o/r/pull/1#issuecomment-111', body: 'hi' },
    ])

    expect(id).toBeUndefined()
  })

  it('should ignore a marker quoted inside a fenced block rather than claimed as the last line', () => {
    const id = findEvidenceCommentId([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-333',
        body: '```\n<!-- pr-evidence: head=abc -->\n```\n\nSome trailing prose.',
      },
    ])

    expect(id).toBeUndefined()
  })
})

describe('findEvidencePreview', () => {
  it('should read the preview address off the marked comment', () => {
    const preview = findEvidencePreview([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '**Preview:** https://feat-x.site.pages.dev\n\n## Evidence\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(preview).toBe('https://feat-x.site.pages.dev')
  })

  it('should return undefined when the marked comment carries no preview', () => {
    const preview = findEvidencePreview([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## Evidence\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(preview).toBeUndefined()
  })

  it('should ignore a preview line on a comment that carries no marker', () => {
    const preview = findEvidencePreview([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-111',
        body: '**Preview:** https://elsewhere.pages.dev',
      },
    ])

    expect(preview).toBeUndefined()
  })
})

describe('findEvidenceChecklist', () => {
  it('should read the checklist out of the marked comment', () => {
    const checklist = findEvidenceChecklist([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## What to look at\n\n<!-- pr-checklist:start -->\n- [x] the hero settles\n<!-- pr-checklist:end -->\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(checklist).toBe('- [x] the hero settles')
  })

  it('should return undefined when the marked comment carries no checklist', () => {
    const checklist = findEvidenceChecklist([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## Evidence\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(checklist).toBeUndefined()
  })

  it('should ignore a checklist on a comment that carries no marker', () => {
    const checklist = findEvidenceChecklist([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-111',
        body: '<!-- pr-checklist:start -->\n- [ ] elsewhere\n<!-- pr-checklist:end -->',
      },
    ])

    expect(checklist).toBeUndefined()
  })
})
