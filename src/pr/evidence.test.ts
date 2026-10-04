import { describe, expect, it } from 'vitest'
import {
  countEvidenceCases,
  findEvidenceChecklist,
  findEvidenceCommentId,
  findEvidenceLocal,
  findEvidencePreview,
  groupEvidence,
  type EvidenceState,
  hasMarkedEvidenceComment,
  type OwedInput,
  readOwed,
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
      '![](https://github.com/erclx/annex/blob/aaaa000/web/evidence/dark/hero.png?raw=true)',
    )
    expect(body).toContain(
      '![](https://github.com/erclx/annex/blob/bbbb111/web/evidence/dark/hero.png?raw=true)',
    )
    expect(body).toContain('| new-case | *(new)* |')
    expect(body.trim().endsWith('<!-- pr-evidence: head=bbbb111 -->')).toBe(
      true,
    )
  })

  it('should open the body with the heading and the preview address under it', () => {
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

    expect(body.split('\n').slice(0, 5)).toEqual([
      '## Evidence',
      '',
      '**Preview:** https://feat-thing.annex.pages.dev',
      '',
      '**Base:** `aaaa000` · **Head:** `bbbb111`',
    ])
    expect(body).toContain('<summary>dark (1)</summary>')
  })

  it('should render the heading, the preview, and the marker alone when no evidence changed', () => {
    const body = renderEvidenceBody(
      [],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      'https://feat-thing.annex.pages.dev',
    )

    expect(body).toBe(
      [
        '## Evidence',
        '',
        '**Preview:** https://feat-thing.annex.pages.dev',
        '',
        '<!-- pr-evidence: head=bbbb111 -->',
      ].join('\n'),
    )
  })

  it('should join the hosted and local addresses on one line when both are given', () => {
    const body = renderEvidenceBody(
      [],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      'https://feat-thing.annex.pages.dev',
      undefined,
      'http://localhost:5173',
    )

    expect(body).toBe(
      [
        '## Evidence',
        '',
        '**Preview:** https://feat-thing.annex.pages.dev · **Local preview:** http://localhost:5173',
        '',
        '<!-- pr-evidence: head=bbbb111 -->',
      ].join('\n'),
    )
  })

  it('should carry the local address alone on the line when no hosted preview is given', () => {
    const body = renderEvidenceBody(
      [],
      'erclx/annex',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] the hero settles',
      'http://localhost:5173',
    )

    expect(body.split('\n').slice(0, 5)).toEqual([
      '## Evidence',
      '',
      '**Local preview:** http://localhost:5173',
      '',
      '## What to look at',
    ])
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
        '## Evidence',
        '',
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

  describe('open by default', () => {
    function stateOf(
      name: string,
      count: number,
      added: boolean,
    ): EvidenceState {
      return {
        state: name,
        items: Array.from({ length: count }, (_, index) => ({
          path: `evidence/${name}/case-${index}.png`,
          stem: `case-${index}`,
          added,
        })),
      }
    }

    it('should open every state when the comment carries exactly six images', () => {
      const body = renderEvidenceBody(
        [stateOf('dark', 2, false), stateOf('light', 1, false)],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body.match(/^<details open>$/gm)).toHaveLength(2)
      expect(body).not.toContain('<details>')
    })

    it('should close every state at seven images, counting an added row once', () => {
      const body = renderEvidenceBody(
        [stateOf('dark', 3, false), stateOf('light', 1, true)],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body.match(/^<details>$/gm)).toHaveLength(2)
      expect(body).not.toContain('<details open>')
    })

    it('should open a comment of added rows whose image count is at the limit', () => {
      const body = renderEvidenceBody(
        [stateOf('dark', 6, true)],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('<details open>')
    })
  })

  describe('commit line', () => {
    const states = [
      {
        state: 'dark',
        items: [{ path: 'evidence/dark/hero.png', stem: 'hero', added: false }],
      },
    ]

    it('should name both commits as short shas right after the heading', () => {
      const body = renderEvidenceBody(states, 'o/r', 'aaaa000', 'bbbb111')

      const lines = body.split('\n')
      expect(lines.slice(0, 3)).toEqual([
        '## Evidence',
        '',
        '**Base:** `aaaa000` · **Head:** `bbbb111`',
      ])
    })

    it('should show seven characters while the image urls keep the full sha', () => {
      const base = 'a'.repeat(40)
      const head = 'b'.repeat(40)

      const body = renderEvidenceBody(states, 'o/r', base, head)

      expect(body).toContain('**Base:** `aaaaaaa` · **Head:** `bbbbbbb`')
      expect(body).toContain(`/blob/${head}/evidence/dark/hero.png?raw=true`)
    })

    it('should read every field back from a body carrying both addresses and a checklist', () => {
      const body = renderEvidenceBody(
        states,
        'o/r',
        'aaaa000',
        'bbbb111',
        'https://x.dev',
        '- [ ] look',
        'http://localhost:5173',
      )

      const comments = [
        { url: 'https://github.com/o/r/pull/1#issuecomment-9', body },
      ]
      expect(findEvidencePreview(comments)).toBe('https://x.dev')
      expect(findEvidenceLocal(comments)).toBe('http://localhost:5173')
      expect(findEvidenceChecklist(comments)).toBe('- [ ] look')
      expect(countEvidenceCases(body)).toBe(1)
    })

    it('should carry no commit line when there are no states', () => {
      const body = renderEvidenceBody(
        [],
        'o/r',
        'aaaa000',
        'bbbb111',
        'https://x.dev',
      )

      expect(body).not.toContain('**Base:**')
    })
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
  it('should read the preview address off an old-layout comment that opens with it', () => {
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

  it('should read the preview segment off the address line under the heading', () => {
    const preview = findEvidencePreview([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## Evidence\n\n**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173\n\n**Base:** `aaaa000` · **Head:** `bbbb111`\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(preview).toBe('https://feat-x.site.pages.dev')
  })

  it('should not read a local first line as a hosted preview', () => {
    const preview = findEvidencePreview([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(preview).toBeUndefined()
  })
})

describe('findEvidenceLocal', () => {
  it('should read the local segment after the hosted one on the address line', () => {
    const local = findEvidenceLocal([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## Evidence\n\n**Preview:** https://feat-x.site.pages.dev · **Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(local).toBe('http://localhost:5173')
  })

  it('should read the local address under a hosted preview in the old layout', () => {
    const local = findEvidenceLocal([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '**Preview:** https://feat-x.site.pages.dev\n**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(local).toBe('http://localhost:5173')
  })

  it('should read the local address when it opens the body alone', () => {
    const local = findEvidenceLocal([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '**Local preview:** http://localhost:5173\n\n## Evidence\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(local).toBe('http://localhost:5173')
  })

  it('should return undefined when the marked comment carries only a hosted preview', () => {
    const local = findEvidenceLocal([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '**Preview:** https://feat-x.site.pages.dev\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(local).toBeUndefined()
  })

  it('should ignore a local line below the opening block', () => {
    const local = findEvidenceLocal([
      {
        url: 'https://github.com/o/r/pull/1#issuecomment-222',
        body: '## What to look at\n\n**Local preview:** http://localhost:5173\n\n<!-- pr-evidence: head=abc -->',
      },
    ])

    expect(local).toBeUndefined()
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

describe('countEvidenceCases', () => {
  it('should count one per case row across several states', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'evidence/dark/a.png', stem: 'a', added: true },
            { path: 'evidence/dark/b.png', stem: 'b', added: false },
          ],
        },
        {
          state: 'light',
          items: [{ path: 'evidence/light/a.png', stem: 'a', added: false }],
        },
      ],
      'o/r',
      'base',
      'head',
    )

    expect(countEvidenceCases(body)).toBe(3)
  })

  it('should count zero for a preview-only body', () => {
    const body = renderEvidenceBody([], 'o/r', 'base', 'head', 'https://x.dev')

    expect(countEvidenceCases(body)).toBe(0)
  })

  it('should count zero for a checklist-only body', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'base',
      'head',
      undefined,
      '| a | b |\n- [ ] look',
    )

    expect(countEvidenceCases(body)).toBe(0)
  })
})

describe('hasMarkedEvidenceComment', () => {
  it('should find a marked comment that carries no url', () => {
    expect(
      hasMarkedEvidenceComment([{ body: 'x\n\n<!-- pr-evidence: head=a -->' }]),
    ).toBe(true)
  })

  it('should not read a checklist posted on its own as marked', () => {
    expect(hasMarkedEvidenceComment([{ body: '- [ ] look' }])).toBe(false)
  })
})

describe('readOwed', () => {
  function owedInput(overrides: Partial<OwedInput> = {}): OwedInput {
    return {
      hasEvidenceChange: false,
      hasMarkedComment: false,
      carriedPreview: false,
      deployServesChange: false,
      ...overrides,
    }
  }

  it('should owe evidence and preview in that order when an evidence change has no comment and a deploy resolves', () => {
    const owed = readOwed(
      owedInput({ hasEvidenceChange: true, deployServesChange: true }),
    )

    expect(owed).toEqual(['evidence', 'preview'])
  })

  it('should owe evidence alone when no deploy workflow resolves', () => {
    const owed = readOwed(owedInput({ hasEvidenceChange: true }))

    expect(owed).toEqual(['evidence'])
  })

  it('should owe a preview when a marked comment opens with no preview line', () => {
    const owed = readOwed(
      owedInput({ hasMarkedComment: true, deployServesChange: true }),
    )

    expect(owed).toEqual(['preview'])
  })

  it('should owe a preview for a checklist-only branch once its marked comment exists', () => {
    const owed = readOwed(
      owedInput({
        hasEvidenceChange: false,
        hasMarkedComment: hasMarkedEvidenceComment([
          {
            body: '<!-- pr-checklist:start -->\n- [ ] look\n<!-- pr-checklist:end -->\n\n<!-- pr-evidence: head=abc -->',
          },
        ]),
        deployServesChange: true,
      }),
    )

    expect(owed).toEqual(['preview'])
  })

  it('should owe nothing when the marked comment carries a preview', () => {
    const owed = readOwed(
      owedInput({
        hasEvidenceChange: true,
        hasMarkedComment: true,
        carriedPreview: true,
        deployServesChange: true,
      }),
    )

    expect(owed).toEqual([])
  })

  it('should owe nothing when the pull request has no evidence change and no marked comment', () => {
    const owed = readOwed(owedInput({ deployServesChange: true }))

    expect(owed).toEqual([])
  })
})
