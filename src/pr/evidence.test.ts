import { describe, expect, it } from 'vitest'
import {
  countEvidenceCases,
  findEvidenceChecklist,
  findEvidenceCommentId,
  findEvidenceHead,
  findEvidenceLocal,
  findEvidencePreview,
  findEvidenceReel,
  nextEvidenceReel,
  groupEvidence,
  type EvidenceItem,
  type EvidenceState,
  hasMarkedEvidenceComment,
  type OwedInput,
  readChecklistBoxes,
  readOwed,
  readPngWidth,
  renderEvidenceBody,
  settleChecklist,
} from '@/pr/evidence'

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
      '<img src="https://github.com/erclx/annex/blob/aaaa000/web/evidence/dark/hero.png?raw=true" width="1000" alt="hero base">',
    )
    expect(body).toContain(
      '<img src="https://github.com/erclx/annex/blob/bbbb111/web/evidence/dark/hero.png?raw=true" width="1000" alt="hero head">',
    )
    expect(body).toContain('**new-case** *(new)*')
    expect(body.trim().endsWith('<!-- pr-evidence: head=bbbb111 -->')).toBe(
      true,
    )
  })

  describe('image width', () => {
    function render(items: EvidenceState['items']): string {
      return renderEvidenceBody(
        [{ state: 'dark', items }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )
    }

    it('should show a small image at its own width', () => {
      const body = render([
        { path: 'evidence/dark/a.png', stem: 'a', added: true, width: 38 },
      ])

      expect(body).toContain('width="38" alt="a head"')
    })

    it('should cap a large image at the ceiling', () => {
      const body = render([
        { path: 'evidence/dark/a.png', stem: 'a', added: true, width: 2880 },
      ])

      expect(body).toContain('width="1000" alt="a head"')
    })

    it('should fall back to the ceiling when no width was read', () => {
      const body = render([
        { path: 'evidence/dark/a.png', stem: 'a', added: true },
      ])

      expect(body).toContain('width="1000" alt="a head"')
    })

    it('should give base and head of one case their own widths', () => {
      const body = render([
        {
          path: 'evidence/dark/a.png',
          stem: 'a',
          added: false,
          width: 400,
          baseWidth: 38,
        },
      ])

      expect(body).toContain('width="38" alt="a base"')
      expect(body).toContain('width="400" alt="a head"')
    })

    it('should still count a case whose image carries a narrow width', () => {
      const body = render([
        { path: 'evidence/dark/a.png', stem: 'a', added: true, width: 38 },
      ])

      expect(countEvidenceCases(body)).toBe(1)
    })
  })

  describe('head first', () => {
    const HEAD =
      '<img src="https://github.com/o/r/blob/bbbb111/evidence/dark/a.png?raw=true" width="1000" alt="a head">'
    const BASE =
      '<img src="https://github.com/o/r/blob/aaaa000/evidence/dark/a.png?raw=true" width="1000" alt="a base">'

    it('should show a modified case as its label, its head on its own line, and its base folded under it', () => {
      const body = renderEvidenceBody(
        [
          {
            state: 'dark',
            items: [{ path: 'evidence/dark/a.png', stem: 'a', added: false }],
          },
        ],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain(
        [
          '**a**',
          '',
          HEAD,
          '',
          '<details>',
          '<summary>Base</summary>',
          '',
          BASE,
          '',
          '</details>',
        ].join('\n'),
      )
      expect(body).not.toContain('| ')
    })

    it('should show an added case as its head alone with no fold beneath it', () => {
      const body = renderEvidenceBody(
        [
          {
            state: 'dark',
            items: [{ path: 'evidence/dark/a.png', stem: 'a', added: true }],
          },
        ],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain(`**a**\n\n${HEAD}\n\n</details>`)
      expect(body).not.toContain('<summary>Base</summary>')
      expect(body).not.toContain('alt="a base"')
    })
  })

  it('should drop the new mark for a state whose cases are all added', () => {
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
      'aaaa000',
      'bbbb111',
    )

    expect(body).toContain('**a**\n')
    expect(body).toContain('**b**\n')
    expect(body).not.toContain('*(new)*')
  })

  it('should decide the new mark per state, keeping it only on the added cases of a mixed one', () => {
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
          items: [{ path: 'evidence/light/a.png', stem: 'a', added: true }],
        },
      ],
      'o/r',
      'aaaa000',
      'bbbb111',
    )

    expect(body.match(/^\*\*a\*\* \*\(new\)\*$/gm)).toHaveLength(1)
    expect(body.match(/^\*\*b\*\*$/gm)).toHaveLength(1)
    expect(body.match(/^\*\*a\*\*$/gm)).toHaveLength(1)
    expect(body.match(/<summary>Base<\/summary>/g)).toHaveLength(1)
  })

  it('should escape a stem carrying a pipe or an angle bracket in the label and the alt text', () => {
    const body = renderEvidenceBody(
      [
        {
          state: 'dark',
          items: [{ path: 'evidence/dark/a.png', stem: 'a|<b>"', added: true }],
        },
      ],
      'o/r',
      'aaaa000',
      'bbbb111',
    )

    expect(body).toContain('**a&#124;&lt;b&gt;&quot;**\n')
    expect(body).toContain('alt="a&#124;&lt;b&gt;&quot; head">')
    expect(countEvidenceCases(body)).toBe(1)
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
      '**Base:** [`aaaa000`](https://github.com/erclx/annex/commit/aaaa000) · **Head:** [`bbbb111`](https://github.com/erclx/annex/commit/bbbb111)',
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
      '- [x] the hero settles without a jump · passed at `bbbb111`\n- [ ] the nav wraps at 360px'
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

    it('should open every state when the comment carries exactly six head images, leaving folded bases uncounted', () => {
      const body = renderEvidenceBody(
        [stateOf('dark', 4, false), stateOf('light', 2, false)],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body.match(/^<details open>$/gm)).toHaveLength(2)
      expect(
        body.match(/^<details>\n<summary>Base<\/summary>$/gm),
      ).toHaveLength(6)
    })

    it('should close every state at seven head images', () => {
      const body = renderEvidenceBody(
        [stateOf('dark', 4, false), stateOf('light', 3, true)],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(
        body.match(/^<details>\n<summary>(dark|light) \(\d\)<\/summary>$/gm),
      ).toHaveLength(2)
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

  describe('within tolerance', () => {
    function folded(path: string, stem: string): EvidenceItem {
      return { path, stem, added: false, withinTolerance: true }
    }

    function moved(path: string, stem: string): EvidenceItem {
      return { path, stem, added: false, withinTolerance: false }
    }

    it('should fold matched cases into one closed block after every state and before the checklist', () => {
      const body = renderEvidenceBody(
        [
          {
            state: 'dark',
            items: [
              folded('evidence/dark/a.png', 'a'),
              moved('evidence/dark/b.png', 'b'),
            ],
          },
          {
            state: 'light',
            items: [folded('evidence/light/a.png', 'a')],
          },
        ],
        'o/r',
        'aaaa000',
        'bbbb111',
        undefined,
        '- [ ] look',
      )

      const lightBlock = body.indexOf('<summary>light')
      const foldBlock = body.indexOf(
        '<details>\n<summary>Within tolerance (2)</summary>',
      )
      const checklist = body.indexOf('## What to look at')
      expect(body).toContain('<summary>dark (1)</summary>')
      expect(lightBlock).toBe(-1)
      expect(foldBlock).toBeGreaterThan(body.indexOf('<summary>dark (1)'))
      expect(checklist).toBeGreaterThan(foldBlock)
    })

    it('should label each folded case by its state and view', () => {
      const body = renderEvidenceBody(
        [
          {
            state: 'dark',
            items: [
              folded('evidence/dark/home-light-1280.png', 'home-light-1280'),
              folded('evidence/dark/stray.png', 'stray'),
            ],
          },
          { state: '', items: [folded('evidence/root.png', 'root')] },
        ],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('**dark / home · 1280 · light**')
      expect(body).toContain('**dark / stray**')
      expect(body).toContain('**root**')
    })

    it('should keep the head and folded base of a matched case', () => {
      const body = renderEvidenceBody(
        [{ state: 'dark', items: [folded('evidence/dark/a.png', 'a')] }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('alt="a head"')
      expect(body).toContain('alt="a base"')
    })

    it('should leave a compared case that moved in its state block', () => {
      const body = renderEvidenceBody(
        [{ state: 'dark', items: [moved('evidence/dark/a.png', 'a')] }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('<summary>dark (1)</summary>')
      expect(body).not.toContain('Within tolerance')
    })

    it('should open six moved cases beside forty folded ones', () => {
      const body = renderEvidenceBody(
        [
          {
            state: 'dark',
            items: Array.from({ length: 6 }, (_, index) =>
              moved(`evidence/dark/m-${index}.png`, `m-${index}`),
            ),
          },
          {
            state: 'light',
            items: Array.from({ length: 40 }, (_, index) =>
              folded(`evidence/light/f-${index}.png`, `f-${index}`),
            ),
          },
        ],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('<details open>\n<summary>dark (6)</summary>')
      expect(body).toContain(
        '<details>\n<summary>Within tolerance (40)</summary>',
      )
    })

    it('should render the folded block alone when every case folds', () => {
      const body = renderEvidenceBody(
        [{ state: 'dark', items: [folded('evidence/dark/a.png', 'a')] }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('**Base:**')
      expect(body).toContain('<summary>Within tolerance (1)</summary>')
      expect(body).not.toContain('<summary>dark')
    })
  })

  describe('view grouping', () => {
    const THEMES = ['dark', 'light'] as const
    const WIDTHS = [320, 768, 1024, 1440]

    function viewItems(view: string, added: boolean): EvidenceItem[] {
      return THEMES.flatMap((theme) =>
        WIDTHS.map((width) => ({
          path: `evidence/${view}-${theme}-${width}.png`,
          stem: `${view}-${theme}-${width}`,
          added,
        })),
      )
    }

    function render(items: EvidenceItem[], state = ''): string {
      return renderEvidenceBody([{ state, items }], 'o/r', 'aaaa000', 'bbbb111')
    }

    function labels(body: string): string[] {
      return [...body.matchAll(/^\*\*(\d+ · (?:dark|light))\*\*/gm)].map(
        (match) => match[1] ?? '',
      )
    }

    it('should render eight view cases as one block labeled by width and theme', () => {
      const body = render(viewItems('grid', true))

      expect(body.match(/<details/g)).toHaveLength(1)
      expect(body).toContain('<summary>grid (8)</summary>')
      expect(labels(body)).toHaveLength(8)
      expect(countEvidenceCases(body)).toBe(8)
    })

    it('should order the cases by width numerically and then dark before light', () => {
      const body = render(viewItems('grid', true))

      expect(labels(body)).toEqual([
        '320 · dark',
        '320 · light',
        '768 · dark',
        '768 · light',
        '1024 · dark',
        '1024 · light',
        '1440 · dark',
        '1440 · light',
      ])
      expect(body).toMatch(
        /\*\*320 · dark\*\*\n\n<img [^>]*alt="grid-dark-320 head">/,
      )
    })

    it('should split a view name that carries a hyphen at the theme rather than the first hyphen', () => {
      const body = render([
        {
          path: 'evidence/menu-open-light-1440.png',
          stem: 'menu-open-light-1440',
          added: true,
        },
      ])

      expect(body).toContain('<summary>menu-open (1)</summary>')
      expect(labels(body)).toEqual(['1440 · light'])
    })

    it('should fold a base under every case when a view already exists at the base', () => {
      const body = render(viewItems('grid', false))

      expect(body.match(/<summary>Base<\/summary>/g)).toHaveLength(8)
      expect(body).toMatch(
        /alt="grid-dark-320 head">\n\n<details>\n<summary>Base<\/summary>\n\n<img [^>]*alt="grid-dark-320 base">/,
      )
      expect(countEvidenceCases(body)).toBe(8)
    })

    it('should mark the theme that is new and fold a base only under the one that is not', () => {
      const body = render([
        {
          path: 'evidence/grid-dark-320.png',
          stem: 'grid-dark-320',
          added: false,
        },
        {
          path: 'evidence/grid-light-320.png',
          stem: 'grid-light-320',
          added: true,
        },
      ])

      expect(body).toContain('**320 · dark**\n')
      expect(body).toContain('**320 · light** *(new)*\n')
      expect(body.match(/<summary>Base<\/summary>/g)).toHaveLength(1)
      expect(body).toContain('alt="grid-dark-320 base"')
      expect(body).not.toContain('alt="grid-light-320 base"')
      expect(countEvidenceCases(body)).toBe(2)
    })

    it('should render nothing for a theme missing at a width and still count three cases', () => {
      const body = render([
        { path: 'e/g-dark-320.png', stem: 'g-dark-320', added: true },
        { path: 'e/g-dark-768.png', stem: 'g-dark-768', added: true },
        { path: 'e/g-light-320.png', stem: 'g-light-320', added: true },
      ])

      expect(labels(body)).toEqual(['320 · dark', '320 · light', '768 · dark'])
      expect(body).not.toContain('768 · light')
      expect(countEvidenceCases(body)).toBe(3)
    })

    it('should name a block by its state and view when the state directory is not empty', () => {
      const body = render(
        [
          {
            path: 'evidence/before/grid-dark-320.png',
            stem: 'grid-dark-320',
            added: true,
          },
        ],
        'before',
      )

      expect(body).toContain('<summary>before / grid (1)</summary>')
    })

    it('should render a single case as one label over its head', () => {
      const body = render([
        { path: 'e/g-dark-320.png', stem: 'g-dark-320', added: true },
      ])

      expect(labels(body)).toEqual(['320 · dark'])
      expect(body).toMatch(
        /\*\*320 · dark\*\*\n\n<img [^>]*alt="g-dark-320 head">/,
      )
    })

    it('should escape the view in the summary and the alt text', () => {
      const body = render([
        { path: 'e/a.png', stem: 'a|<b>"-dark-320', added: true },
      ])

      expect(body).toContain('<summary>a&#124;&lt;b&gt;&quot; (1)</summary>')
      expect(body).toContain('alt="a&#124;&lt;b&gt;&quot;-dark-320 head"')
      expect(countEvidenceCases(body)).toBe(1)
    })

    it('should land a name outside the form in a flat fallback block and count it', () => {
      const body = render([
        ...viewItems('grid', true).slice(0, 2),
        { path: 'evidence/board.png', stem: 'board', added: true },
      ])

      expect(body).toContain('<summary>grid (2)</summary>')
      expect(body).toContain('<summary>evidence (1)</summary>')
      expect(body).toContain('**board**\n')
      expect(countEvidenceCases(body)).toBe(3)
    })

    it('should send a second file sharing a view cell to the flat block so both still show', () => {
      const body = render([
        {
          path: 'evidence/grid-dark-320.png',
          stem: 'grid-dark-320',
          added: true,
        },
        {
          path: 'evidence/grid-dark-320.webp',
          stem: 'grid-dark-320',
          added: true,
        },
      ])

      expect(body).toContain('<summary>grid (1)</summary>')
      expect(body).toContain('<summary>evidence (1)</summary>')
      expect(countEvidenceCases(body)).toBe(2)
    })

    it('should open every block together while the whole comment is within the image limit', () => {
      const body = render(viewItems('grid', true).slice(0, 6))

      expect(body.match(/^<details open>$/gm)).toHaveLength(1)
    })

    it('should count as many cases as the body has head images', () => {
      const body = render([
        ...viewItems('grid', false),
        ...viewItems('card', true),
        { path: 'evidence/board.png', stem: 'board', added: false },
      ])

      expect(countEvidenceCases(body)).toBe(17)
      expect(body.match(/alt="[^"]* head"/g)).toHaveLength(17)
    })
  })

  describe('commit line', () => {
    const states = [
      {
        state: 'dark',
        items: [{ path: 'evidence/dark/hero.png', stem: 'hero', added: false }],
      },
    ]

    it('should link both commits as short shas right after the heading', () => {
      const body = renderEvidenceBody(states, 'o/r', 'aaaa000', 'bbbb111')

      const lines = body.split('\n')
      expect(lines.slice(0, 3)).toEqual([
        '## Evidence',
        '',
        '**Base:** [`aaaa000`](https://github.com/o/r/commit/aaaa000) · **Head:** [`bbbb111`](https://github.com/o/r/commit/bbbb111)',
      ])
    })

    it('should show seven characters while the links and image urls keep the full sha', () => {
      const base = 'a'.repeat(40)
      const head = 'b'.repeat(40)

      const body = renderEvidenceBody(states, 'o/r', base, head)

      expect(body).toContain(
        `**Base:** [\`aaaaaaa\`](https://github.com/o/r/commit/${base}) · **Head:** [\`bbbbbbb\`](https://github.com/o/r/commit/${head})`,
      )
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

describe('the reel line', () => {
  const LINK =
    'https://github.com/o/r/blob/canon/frames/pr-1/bbbb111/20261026T120000Z/reel.webp?raw=true'
  const states: EvidenceState[] = [
    {
      state: '',
      items: [{ path: 'evidence/hero.png', stem: 'hero', added: false }],
    },
  ]

  it('should sit under the address line and name the head it was filmed at', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] the menu opens',
      'http://localhost:5173',
      { link: LINK, head: 'bbbb1112222' },
    )

    expect(body.split('\n').slice(0, 7)).toEqual([
      '## Evidence',
      '',
      '**Local preview:** http://localhost:5173',
      '',
      `**Reel** filmed at \`bbbb111\`:<br><img src="${LINK}" width="960" alt="reel filmed at bbbb111">`,
      '',
      '## What to look at',
    ])
  })

  it('should sit above the Base line and outside the case blocks, adding no case', () => {
    const body = renderEvidenceBody(
      states,
      'o/r',
      'aaaa000',
      'bbbb111',
      undefined,
      undefined,
      undefined,
      { link: LINK, head: 'bbbb111' },
    )
    const lines = body.split('\n')
    const reel = lines.findIndex((line) => line.startsWith('**Reel**'))
    const base = lines.findIndex((line) => line.startsWith('**Base:**'))
    const firstBlock = lines.findIndex((line) => line.startsWith('<details'))

    expect(reel).toBeGreaterThan(-1)
    expect(reel).toBeLessThan(base)
    expect(base).toBeLessThan(firstBlock)
    expect(countEvidenceCases(body)).toBe(1)
  })

  it('should leave a body without a reel exactly as before', () => {
    const args = [
      states,
      'o/r',
      'aaaa000',
      'bbbb111',
      'https://x.dev',
      '- [ ] look',
      'http://localhost:5173',
    ] as const

    expect(renderEvidenceBody(...args, undefined)).toBe(
      renderEvidenceBody(...args),
    )
    expect(renderEvidenceBody(...args)).not.toContain('**Reel**')
  })

  it('should read the reel back without disturbing the other fields', () => {
    const body = renderEvidenceBody(
      states,
      'o/r',
      'aaaa000',
      'bbbb111',
      'https://x.dev',
      '- [ ] look',
      'http://localhost:5173',
      { link: LINK, head: 'bbbb111' },
    )

    const comments = [
      { url: 'https://github.com/o/r/pull/1#issuecomment-9', body },
    ]
    expect(findEvidenceReel(comments)).toEqual({ link: LINK, head: 'bbbb111' })
    expect(findEvidencePreview(comments)).toBe('https://x.dev')
    expect(findEvidenceLocal(comments)).toBe('http://localhost:5173')
    expect(findEvidenceChecklist(comments)).toBe('- [ ] look')
    expect(countEvidenceCases(body)).toBe(1)
  })

  it('should read no reel off an unmarked comment or one without the line', () => {
    expect(
      findEvidenceReel([
        { body: `**Reel** filmed at \`bbbb111\`:<br><img src="${LINK}">` },
      ]),
    ).toBeUndefined()
    expect(
      findEvidenceReel([
        { body: '## Evidence\n\n<!-- pr-evidence: head=bbbb111 -->' },
      ]),
    ).toBeUndefined()
  })

  describe('nextEvidenceReel', () => {
    const carried = [
      {
        body: renderEvidenceBody(
          [],
          'o/r',
          'aaaa000',
          'bbbb111',
          undefined,
          '- [ ] look',
          undefined,
          { link: LINK, head: 'bbbb111' },
        ),
      },
    ]

    it('should carry the posted reel forward under its old head when none is passed', () => {
      expect(nextEvidenceReel(undefined, 'cccc222', carried)).toEqual({
        link: LINK,
        head: 'bbbb111',
      })
    })

    it('should replace a carried reel with a passed one filmed at this head', () => {
      expect(nextEvidenceReel('https://new.link', 'cccc222', carried)).toEqual({
        link: 'https://new.link',
        head: 'cccc222',
      })
    })

    it('should give no reel when none is passed or posted', () => {
      expect(nextEvidenceReel(undefined, 'cccc222', [])).toBeUndefined()
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
