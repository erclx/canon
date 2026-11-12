import { describe, expect, it } from 'vitest'
import {
  countDrivable,
  countEvidenceCases,
  findEvidenceChecklist,
  findEvidenceCommentId,
  findEvidenceHead,
  findEvidenceLocal,
  findEvidencePreview,
  groupEvidence,
  hasMarkedEvidenceComment,
  type OwedInput,
  readChecklistBoxes,
  readOwed,
  readPngWidth,
  readUncaptured,
  renderEvidenceBody,
  settleChecklist,
} from '@/pr/evidence'
import { DEFAULT_PAINTED } from '@/pr/painted'

describe('readPngWidth', () => {
  function header(width: number): Uint8Array {
    const bytes = new Uint8Array(24)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    new DataView(bytes.buffer).setUint32(16, width)
    return bytes
  }

  it('should read the width from the IHDR chunk', () => {
    expect(readPngWidth(header(2880))).toBe(2880)
  })

  it('should return undefined for bytes that are not a PNG', () => {
    expect(readPngWidth(new Uint8Array(24).fill(0xff))).toBeUndefined()
  })

  it('should return undefined for a truncated header', () => {
    expect(readPngWidth(header(38).subarray(0, 10))).toBeUndefined()
  })
})

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

  it('should read a renamed path as not added and keep its old path as the base', async () => {
    const reading = await groupEvidence(
      ['web/evidence/dark/hero.png'],
      async () => false,
      new Map([['web/evidence/dark/hero.png', 'web/evidence/hero-dark.png']]),
    )

    expect(reading).toEqual({
      kind: 'read',
      states: [
        {
          state: 'dark',
          items: [
            {
              path: 'web/evidence/dark/hero.png',
              stem: 'hero',
              added: false,
              basePath: 'web/evidence/hero-dark.png',
            },
          ],
        },
      ],
    })
  })

  it('should still mark a copied path added, since it has no entry in the rename map', async () => {
    const reading = await groupEvidence(
      ['web/evidence/dark/copy.png'],
      async () => false,
      new Map(),
    )

    expect(reading.kind).toBe('read')
    if (reading.kind !== 'read') return
    expect(reading.states[0]?.items[0]).toEqual({
      path: 'web/evidence/dark/copy.png',
      stem: 'copy',
      added: true,
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

  it('should count the head images folded as within tolerance', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            {
              path: 'evidence/dark/a.png',
              stem: 'a',
              added: false,
              withinTolerance: true,
            },
            {
              path: 'evidence/dark/b.png',
              stem: 'b',
              added: false,
              withinTolerance: true,
            },
          ],
        },
      ],
      'o/r',
      'base',
      'head',
    )

    expect(countEvidenceCases(body)).toBe(2)
  })

  it('should count the rows of a body posted in the three-column markdown image shape', () => {
    const body = [
      '| Case | Base | Head |',
      '| --- | --- | --- |',
      '| a | *(new)* | ![](https://github.com/o/r/blob/h/a.png?raw=true) |',
      '| b | ![](https://github.com/o/r/blob/b/b.png?raw=true) | ![](https://github.com/o/r/blob/h/b.png?raw=true) |',
    ].join('\n')

    expect(countEvidenceCases(body)).toBe(2)
  })

  it('should count the rows of a two-column body', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'evidence/dark/a.png', stem: 'a', added: true },
            { path: 'evidence/dark/b.png', stem: 'b', added: true },
          ],
        },
      ],
      'o/r',
      'base',
      'head',
    )

    expect(countEvidenceCases(body)).toBe(2)
  })

  it('should count the rows of a three-column body in the img shape', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [
            { path: 'evidence/dark/a.png', stem: 'a', added: true },
            { path: 'evidence/dark/b.png', stem: 'b', added: false },
          ],
        },
      ],
      'o/r',
      'base',
      'head',
    )

    expect(countEvidenceCases(body)).toBe(2)
  })

  it('should count a body with its head images on their own lines the same as the table of those cases', () => {
    const table = [
      '| Case | Base | Head |',
      '| --- | --- | --- |',
      '| a | *(new)* | <img src="h/a.png" width="1000" alt="a head"> |',
      '| b | <img src="b/b.png" width="1000" alt="b base"> | <img src="h/b.png" width="1000" alt="b head"> |',
    ].join('\n')
    const stacked = [
      '**a** *(new)*',
      '',
      '<img src="h/a.png" width="1000" alt="a head">',
      '',
      '**b**',
      '',
      '<img src="h/b.png" width="1000" alt="b head">',
      '',
      '<details>',
      '<summary>Base</summary>',
      '',
      '<img src="b/b.png" width="1000" alt="b base">',
      '',
      '</details>',
    ].join('\n')

    expect(countEvidenceCases(stacked)).toBe(2)
    expect(countEvidenceCases(stacked)).toBe(countEvidenceCases(table))
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

describe('readUncaptured', () => {
  const frameboard117 = [
    'canon/design/board/claim-dark.png',
    'canon/design/board/claim-light.png',
    'src/client/styles.css',
    'src/client/board.test.ts',
    'src/test/contrast.ts',
  ]

  it('should name the stylesheet a pull request changed with no evidence image beside it', () => {
    expect(readUncaptured(frameboard117, DEFAULT_PAINTED, true)).toEqual([
      'src/client/styles.css',
    ])
  })

  it('should name nothing for a change confined to design references', () => {
    const designOnly = [
      'canon/design/board/claim-dark.png',
      'canon/design/board/claim.html',
    ]

    expect(readUncaptured(designOnly, DEFAULT_PAINTED, true)).toEqual([])
  })

  it('should name nothing once any evidence image changed beside the stylesheet', () => {
    const recaptured = [...frameboard117, 'e2e/evidence/dark/board.png']

    expect(readUncaptured(recaptured, DEFAULT_PAINTED, true)).toEqual([])
  })

  it('should name nothing for a change confined to tests', () => {
    const testOnly = ['src/client/board.test.tsx', 'src/test/contrast.ts']

    expect(readUncaptured(testOnly, DEFAULT_PAINTED, true)).toEqual([])
  })

  it('should not count a file kept beside the captures as uncaptured', () => {
    const besideCaptures = ['e2e/evidence/report.html']

    expect(readUncaptured(besideCaptures, DEFAULT_PAINTED, true)).toEqual([])
  })

  it('should honor a path a project adds to the painted set', () => {
    const patterns = {
      painted: [...DEFAULT_PAINTED.painted, 'src/theme/**'],
      unpainted: DEFAULT_PAINTED.unpainted,
    }

    expect(readUncaptured(['src/theme/tokens.ts'], patterns, true)).toEqual([
      'src/theme/tokens.ts',
    ])
  })

  it('should answer nothing when the base keeps no capture', () => {
    expect(
      readUncaptured(frameboard117, DEFAULT_PAINTED, false),
    ).toBeUndefined()
  })

  it('should answer nothing when the base tree was not read', () => {
    expect(
      readUncaptured(frameboard117, DEFAULT_PAINTED, undefined),
    ).toBeUndefined()
  })
})

describe('checklist boxes', () => {
  it('should number each box with its tick, stamp, and taste mark', () => {
    const boxes = readChecklistBoxes(
      [
        '- [x] hero settles · passed at `abc1234`',
        '- [ ] nav wraps',
        '- [ ] type feels calm (taste)',
      ].join('\n'),
    )

    expect(boxes.map((box) => [box.number, box.isTicked, box.stamp])).toEqual([
      [1, true, 'abc1234'],
      [2, false, undefined],
      [3, false, undefined],
    ])
    expect(boxes.map((box) => box.isTaste)).toEqual([false, false, true])
  })

  it('should count an indented box and a capital X the way GitHub renders them', () => {
    const boxes = readChecklistBoxes('### Hero\n  - [X] settles\n- [ ] wraps')

    expect(boxes.map((box) => [box.number, box.isTicked])).toEqual([
      [1, true],
      [2, false],
    ])
  })

  it('should read taste in any order within the trailing marker run', () => {
    const boxes = readChecklistBoxes(
      [
        '- [ ] reel paces (local only) (taste)',
        '- [ ] reel paces (taste) (local only)',
        '- [ ] reel paces (taste) (needs fixture)',
        '- [ ] the (taste) toggle → opens',
        '- [ ] the toggle opens (local only)',
      ].join('\n'),
    )

    expect(boxes.map((box) => box.isTaste)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ])
  })

  it('should count the boxes a driver can run apart from taste ones', () => {
    const mixed = readChecklistBoxes(
      '- [ ] opens\n- [ ] calm (taste)\n- [ ] paces (taste) (local only)',
    )
    const allTaste = readChecklistBoxes(
      '- [ ] calm (taste)\n- [ ] paces (local only) (taste)',
    )

    expect(countDrivable(mixed)).toBe(1)
    expect(countDrivable(allTaste)).toBe(0)
  })

  it('should read a stamp only as the trailing segment of a line', () => {
    const [box] = readChecklistBoxes(
      '- [x] the footer says passed at `abc1234` in its copy',
    )

    expect(box?.stamp).toBeUndefined()
    expect(box?.text).toBe('the footer says passed at `abc1234` in its copy')
  })
})

describe('settleChecklist', () => {
  const stamped = '- [x] hero settles · passed at `aaaa000`'

  it('should keep a tick stamped at the render head', () => {
    expect(settleChecklist(stamped, 'aaaa000ffff', 'aaaa000ffff')).toBe(stamped)
  })

  it('should clear a tick and drop its stamp stamped at another head', () => {
    expect(settleChecklist(stamped, 'bbbb111ffff', 'aaaa000ffff')).toBe(
      '- [ ] hero settles',
    )
  })

  it('should clear an unstamped tick when the comment described another head', () => {
    expect(settleChecklist('- [x] by hand', 'bbbb111', 'aaaa000')).toBe(
      '- [ ] by hand',
    )
  })

  it('should keep an unstamped tick when the comment described this head', () => {
    expect(settleChecklist('- [x] by hand', 'aaaa000', 'aaaa000')).toBe(
      '- [x] by hand',
    )
  })

  it('should leave empty boxes and other lines as they are', () => {
    const text = '### Group\n- [ ] one\nplain'

    expect(settleChecklist(text, 'bbbb111', 'aaaa000')).toBe(text)
  })
})

describe('findEvidenceHead', () => {
  it('should read the head the marker names', () => {
    const body = renderEvidenceBody([], 'o/r', 'aaaa000', 'bbbb111')

    expect(findEvidenceHead([{ body }])).toBe('bbbb111')
  })

  it('should be undefined when no comment is marked', () => {
    expect(findEvidenceHead([{ body: 'hello' }])).toBeUndefined()
  })
})
