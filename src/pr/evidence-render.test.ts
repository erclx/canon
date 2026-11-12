import { describe, expect, it } from 'vitest'
import {
  countEvidenceCases,
  type EvidenceItem,
  type EvidenceState,
  findEvidenceChecklist,
  findEvidenceLocal,
  findEvidencePreview,
  findEvidenceReel,
  findEvidenceSkips,
  hasMarkedEvidenceComment,
  nextEvidenceReel,
  readOwed,
  renderEvidenceBody,
} from '@/pr/evidence'

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

  describe('a renamed image', () => {
    const renamed = (
      verdict: 'identical' | 'near' | 'changed',
    ): EvidenceItem => ({
      path: 'evidence/dark/a.png',
      stem: 'a',
      added: false,
      basePath: 'evidence/a-dark.png',
      withinTolerance: verdict !== 'changed',
      identical: verdict === 'identical',
    })

    it('should drop a byte-identical rename from the listing and count it on one line', () => {
      const body = renderEvidenceBody(
        [{ state: 'dark', items: [renamed('identical')] }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('**Moved unchanged:** 1 image')
      expect(body).not.toContain('<summary>')
      expect(body).not.toContain('alt="a head"')
    })

    it('should count several unchanged renames in the plural', () => {
      const body = renderEvidenceBody(
        [
          {
            state: 'dark',
            items: [
              renamed('identical'),
              {
                ...renamed('identical'),
                path: 'evidence/dark/b.png',
                stem: 'b',
              },
            ],
          },
        ],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('**Moved unchanged:** 2 images')
    })

    it('should render a rename with edits as head over a base read from the old path, with no new mark', () => {
      const body = renderEvidenceBody(
        [{ state: 'dark', items: [renamed('changed')] }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('/blob/bbbb111/evidence/dark/a.png?raw=true')
      expect(body).toContain('/blob/aaaa000/evidence/a-dark.png?raw=true')
      expect(body).not.toContain('*(new)*')
      expect(body).not.toContain('Moved unchanged')
    })

    it('should fold a rename within tolerance but not byte-identical, keeping both images', () => {
      const body = renderEvidenceBody(
        [{ state: 'dark', items: [renamed('near')] }],
        'o/r',
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('<summary>Within tolerance (1)</summary>')
      expect(body).toContain('/blob/aaaa000/evidence/a-dark.png?raw=true')
      expect(body).not.toContain('Moved unchanged')
    })

    it('should render a copy as added, with its head alone', () => {
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
        'aaaa000',
        'bbbb111',
      )

      expect(body).toContain('**a** *(new)*')
      expect(body).not.toContain('alt="a base"')
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

describe('the skip lines', () => {
  const LINK = 'https://github.com/o/r/blob/canon/frames/reel.webp?raw=true'
  const states: EvidenceState[] = [
    {
      state: '',
      items: [{ path: 'evidence/hero.png', stem: 'hero', added: false }],
    },
  ]

  function marked(body: string): { url: string; body: string }[] {
    return [{ url: 'https://github.com/o/r/pull/1#issuecomment-9', body }]
  }

  it('should render each skip on its own line under the addresses, local first', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      'bbbb111',
      'https://x.dev',
      '- [ ] look',
      undefined,
      undefined,
      { local: 'no-server: nothing listens', reel: 'no-server' },
    )

    expect(body.split('\n').slice(0, 9)).toEqual([
      '## Evidence',
      '',
      '**Preview:** https://x.dev',
      '',
      '**No local preview:** no-server: nothing listens',
      '',
      '**No reel:** no-server',
      '',
      '## What to look at',
    ])
  })

  it('should drop the local skip when a local address renders beside it', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] look',
      'http://localhost:5173',
      undefined,
      { local: 'no-server' },
    )

    expect(body).toContain('**Local preview:** http://localhost:5173')
    expect(body).not.toContain('No local preview')
  })

  it('should drop the reel skip when a reel filmed at the head renders beside it', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] look',
      undefined,
      { link: LINK, head: 'bbbb111' },
      { reel: 'no-checklist' },
    )

    expect(body).toContain('**Reel** filmed at `bbbb111`')
    expect(body).not.toContain('No reel')
  })

  it('should keep the reel skip beside a reel filmed at an earlier head', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      'cccc222',
      undefined,
      '- [ ] look',
      undefined,
      { link: LINK, head: 'bbbb111' },
      { reel: 'reel-too-large' },
    )

    expect(body).toContain('**Reel** filmed at `bbbb111`')
    expect(body).toContain('**No reel:** reel-too-large')
  })

  it('should fold a multi-line reason onto one escaped line', () => {
    const body = renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      'bbbb111',
      undefined,
      '- [ ] look',
      undefined,
      undefined,
      { reel: 'film-failed: exit 1\n  <stderr> | tail' },
    )

    expect(body).toContain(
      '**No reel:** film-failed: exit 1 &lt;stderr&gt; &#124; tail',
    )
  })

  it('should leave a body with no skips exactly as before', () => {
    const args = [
      states,
      'o/r',
      'aaaa000',
      'bbbb111',
      'https://x.dev',
      '- [ ] look',
      'http://localhost:5173',
      { link: LINK, head: 'bbbb111' },
    ] as const

    expect(renderEvidenceBody(...args, {})).toBe(renderEvidenceBody(...args))
  })

  it('should read both skips back, unescaped, without disturbing the other fields', () => {
    const comments = marked(
      renderEvidenceBody(
        states,
        'o/r',
        'aaaa000',
        'bbbb111',
        'https://x.dev',
        '- [ ] look',
        undefined,
        undefined,
        { local: 'no-server: a <b> | c', reel: 'no-server' },
      ),
    )

    expect(findEvidenceSkips(comments)).toEqual({
      local: 'no-server: a <b> | c',
      reel: 'no-server',
    })
    expect(findEvidencePreview(comments)).toBe('https://x.dev')
    expect(findEvidenceLocal(comments)).toBeUndefined()
    expect(findEvidenceReel(comments)).toBeUndefined()
    expect(findEvidenceChecklist(comments)).toBe('- [ ] look')
    expect(countEvidenceCases(comments[0]?.body ?? '')).toBe(1)
  })

  it('should read no skips off an unmarked comment or one below the addresses', () => {
    expect(findEvidenceSkips([{ body: '**No reel:** no-server' }])).toEqual({})
    expect(
      findEvidenceSkips(
        marked(
          '## Evidence\n\n## What to look at\n\n**No reel:** quoted\n\n<!-- pr-evidence: head=bbbb111 -->',
        ),
      ),
    ).toEqual({})
  })

  it('should not count a skip-only body as owing evidence once it is marked', () => {
    const comments = marked(
      renderEvidenceBody(
        [],
        'o/r',
        'aaaa000',
        'bbbb111',
        undefined,
        '- [ ] look',
        undefined,
        undefined,
        { local: 'no-server', reel: 'no-server' },
      ),
    )

    expect(hasMarkedEvidenceComment(comments)).toBe(true)
    expect(
      readOwed({
        hasEvidenceChange: true,
        hasMarkedComment: hasMarkedEvidenceComment(comments),
        carriedPreview: findEvidencePreview(comments) !== undefined,
        deployServesChange: false,
      }),
    ).toEqual([])
  })
})

describe('the uncaptured line', () => {
  const LINK = 'https://github.com/o/r/blob/canon/frames/reel.webp?raw=true'
  const HEAD = 'bbbb111bbbb111bbbb111bbbb111bbbb111bbbb1'
  const LATER = 'cccc222cccc222cccc222cccc222cccc222cccc2'

  function render(
    head: string,
    uncaptured: readonly string[],
    reel?: { link: string; head: string },
  ): string {
    return renderEvidenceBody(
      [],
      'o/r',
      'aaaa000',
      head,
      'https://x.dev',
      undefined,
      undefined,
      reel,
      {},
      uncaptured,
    )
  }

  it('should list each uncaptured path on one line under the addresses', () => {
    const body = render(HEAD, ['src/app.css', 'src/board.tsx'])

    expect(body.split('\n').slice(0, 5)).toEqual([
      '## Evidence',
      '',
      '**Preview:** https://x.dev',
      '',
      '**Uncaptured:** `src/app.css`, `src/board.tsx`',
    ])
  })

  it('should render the line again at a later head while the paths stay uncaptured', () => {
    const body = render(LATER, ['src/board.tsx'])

    expect(body).toContain('**Uncaptured:** `src/board.tsx`')
    expect(body).toContain('<!-- pr-evidence: head=cccc222')
  })

  it('should drop the line once a capture empties the list', () => {
    expect(render(HEAD, [])).not.toContain('Uncaptured')
  })

  it('should drop the line beside a reel filmed at the head', () => {
    const body = render(HEAD, ['src/board.tsx'], { link: LINK, head: HEAD })

    expect(body).not.toContain('Uncaptured')
  })

  it('should keep the line beside a reel filmed at an earlier head', () => {
    const body = render(LATER, ['src/board.tsx'], { link: LINK, head: HEAD })

    expect(body).toContain('**Uncaptured:** `src/board.tsx`')
  })

  it('should leave the carried preview readable beside the line', () => {
    const body = render(HEAD, ['src/board.tsx'])

    expect(findEvidencePreview([{ body }])).toBe('https://x.dev')
  })
})
