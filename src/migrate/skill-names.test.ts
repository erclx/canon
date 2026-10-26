import { describe, expect, it } from 'vitest'
import { isExcludedPath, renamePath, renameText } from '@/migrate/rename'
import {
  SKILL_CITATION_MAP,
  SKILL_NAME_MAP,
  SKILL_NAME_RULES,
} from '@/migrate/skill-names'

describe('SKILL_NAME_MAP', () => {
  it('should carry one row for every renamed skill', () => {
    expect(Object.keys(SKILL_NAME_MAP)).toHaveLength(47)
  })

  it('should retire the prefix on every row', () => {
    const kept = Object.values(SKILL_NAME_MAP).filter((name) =>
      name.startsWith('claude-'),
    )

    expect(kept).toEqual([])
  })

  it('should give every new name two words, since a plugin skill only rarely takes one', () => {
    const single = Object.values(SKILL_NAME_MAP).filter(
      (name) => !name.includes('-'),
    )

    expect(single).toEqual([])
  })

  it('should never map a name onto one the sweep would rewrite again', () => {
    const chained = Object.values(SKILL_NAME_MAP).filter(
      (name) => name in SKILL_NAME_MAP,
    )

    expect(chained).toEqual([])
  })

  it('should let keys share a name only where a retired name was retargeted or several skills merged into one', () => {
    const byName = new Map<string, string[]>()
    for (const [key, name] of Object.entries(SKILL_NAME_MAP)) {
      byName.set(name, [...(byName.get(name) ?? []), key])
    }

    const shared = [...byName.values()].filter((keys) => keys.length > 1)

    expect(shared).toEqual([
      ['claude-diagram', 'draft-diagram', 'draft-figure'],
      ['claude-docs', 'docs-fold'],
      ['claude-ui-test', 'ui-test'],
      ['claude-ux-audit', 'ux-audit'],
      ['claude-ux-measure', 'ux-measure'],
      ['canon-screencast', 'draft-screencast'],
      ['canon-slides-draft', 'draft-slides'],
      [
        'draft-docs',
        'draft-context',
        'draft-wireframes',
        'draft-readme',
        'draft-wiki',
        'draft-doc',
      ],
      ['draft-and-pick', 'pick-by-eye'],
    ])
  })

  it('should carry no single-word key, which wholeToken would rewrite everywhere it appears as an ordinary word', () => {
    const single = Object.keys(SKILL_NAME_MAP).filter(
      (name) => !name.includes('-'),
    )

    expect(single).toEqual([])
  })
})

describe('SKILL_CITATION_MAP', () => {
  it('should qualify every key, since a bare single-word key would rewrite ordinary prose', () => {
    const bare = Object.keys(SKILL_CITATION_MAP).filter(
      (key) => !key.startsWith('canon:') && !key.startsWith('skills/'),
    )

    expect(bare).toEqual([])
  })

  it('should never map a key onto a form the sweep would rewrite again', () => {
    const chained = Object.values(SKILL_CITATION_MAP).filter(
      (value) => value in SKILL_CITATION_MAP,
    )

    expect(chained).toEqual([])
  })
})

describe('renameText under the draft-ready citation rows', () => {
  it('should rewrite the skill folder path', () => {
    expect(
      renameText('claude/skills/draft-ready/SKILL.md', SKILL_NAME_RULES),
    ).toBe('claude/skills/plan-ready/SKILL.md')
  })

  it('should leave the prose sense of a pull request moving from draft to ready', () => {
    expect(
      renameText('The PR is draft-ready once CI passes.', SKILL_NAME_RULES),
    ).toBe('The PR is draft-ready once CI passes.')
  })
})

describe('renameText under the canvas citation rows', () => {
  it('should rewrite the namespaced invocation', () => {
    expect(renameText('run canon:canvas now', SKILL_NAME_RULES)).toBe(
      'run canon:canvas-board now',
    )
  })

  it('should rewrite the skill folder path', () => {
    expect(renameText('claude/skills/canvas/SKILL.md', SKILL_NAME_RULES)).toBe(
      'claude/skills/canvas-board/SKILL.md',
    )
  })

  it.each([
    'canon canvas serve',
    'src/canvas/server.ts',
    '.canon/canvas/drafts/x.html',
    '.claude/skills/internal-canvas/SKILL.md',
    'assets/evidence/canvas/shell/',
    'canon:canvas-board',
    'claude/skills/canvas-board/SKILL.md',
  ])('should leave %s unchanged', (text) => {
    expect(renameText(text, SKILL_NAME_RULES)).toBe(text)
  })
})

describe('SKILL_NAME_RULES ordering', () => {
  it('should try a name ahead of the shorter name it contains', () => {
    const order = SKILL_NAME_RULES.tokenOrder
    const longer = order.indexOf('claude-intake-answer')
    const shorter = order.indexOf('claude-intake')

    expect(longer).toBeLessThan(shorter)
  })

  it('should try the prefixed ui name ahead of the bare one it contains', () => {
    const order = SKILL_NAME_RULES.tokenOrder

    expect(order.indexOf('claude-ui-test')).toBeLessThan(
      order.indexOf('ui-test'),
    )
  })

  it('should order every token longest first', () => {
    const lengths = SKILL_NAME_RULES.tokenOrder.map((token) => token.length)
    const descending = [...lengths].sort((left, right) => right - left)

    expect(lengths).toEqual(descending)
  })
})

describe('renameText under the skill preset', () => {
  it('should rewrite a plugin-namespaced invocation', () => {
    expect(renameText('run canon:claude-docs now', SKILL_NAME_RULES)).toBe(
      'run canon:context-fold now',
    )
  })

  it('should rename the fold skill onto the name that states what it edits', () => {
    expect(renameText('run canon:docs-fold now', SKILL_NAME_RULES)).toBe(
      'run canon:context-fold now',
    )
  })

  it('should rewrite the longer name rather than its prefix', () => {
    expect(renameText('claude-intake-answer', SKILL_NAME_RULES)).toBe(
      'plan-intake-answer',
    )
  })

  it('should rewrite the shorter name where it stands alone', () => {
    expect(renameText('claude-intake', SKILL_NAME_RULES)).toBe('plan-intake')
  })

  it('should leave a name the map does not carry', () => {
    expect(renameText('canon:claude-cli', SKILL_NAME_RULES)).toBe(
      'canon:claude-cli',
    )
  })

  it('should leave a longer word that only opens with a skill name', () => {
    expect(
      renameText('see claude-worktrees for the rules', SKILL_NAME_RULES),
    ).toBe('see claude-worktrees for the rules')
  })

  it('should rewrite a skill name a punctuation mark follows', () => {
    expect(renameText('`claude-worktree`, then ship', SKILL_NAME_RULES)).toBe(
      '`session-worktree`, then ship',
    )
  })

  it('should rewrite nothing on a second pass over its own output', () => {
    const once = renameText(
      'claude-review and claude-pr-review and claude-intake-answer',
      SKILL_NAME_RULES,
    )

    expect(renameText(once, SKILL_NAME_RULES)).toBe(once)
  })

  it('should leave a line carrying the keep marker', () => {
    const line = 'const retired = "claude-docs" // canon-keep-retired'

    expect(renameText(line, SKILL_NAME_RULES)).toBe(line)
  })

  it('should leave the aitk token alone, which is a different sweep', () => {
    expect(renameText('run aitk gov sync', SKILL_NAME_RULES)).toBe(
      'run aitk gov sync',
    )
  })

  it('should land the two canon- names that once joined the draft- family on their verb-first names in one pass', () => {
    expect(
      renameText(
        'canon:canon-screencast and canon:canon-slides-draft',
        SKILL_NAME_RULES,
      ),
    ).toBe('canon:script-screencast and canon:make-deck')
  })

  it('should land both ui spellings on the new name in one pass', () => {
    expect(
      renameText('canon:claude-ui-test and canon:ui-test', SKILL_NAME_RULES),
    ).toBe('canon:ui-checklist and canon:ui-checklist')
  })

  it('should land the five merged drafters on the one skill that replaced them', () => {
    expect(
      renameText(
        'canon:draft-docs, draft-context, draft-wireframes, draft-readme, draft-wiki',
        SKILL_NAME_RULES,
      ),
    ).toBe('canon:write-doc, write-doc, write-doc, write-doc, write-doc')
  })

  it('should land both diagram spellings on the figure skill that absorbed them', () => {
    expect(
      renameText(
        'canon:claude-diagram and canon:draft-diagram',
        SKILL_NAME_RULES,
      ),
    ).toBe('canon:draw-figure and canon:draw-figure')
  })

  it.each([
    ['draft-doc', 'write-doc'],
    ['draft-figure', 'draw-figure'],
    ['draft-identity', 'design-identity'],
    ['draft-slides', 'make-deck'],
    ['draft-and-pick', 'design-pick'],
    ['draft-ready', 'plan-ready'],
    ['draft-screencast', 'script-screencast'],
  ])('should rename %s for what it makes', (old, name) => {
    expect(renameText(`run canon:${old} now`, SKILL_NAME_RULES)).toBe(
      `run canon:${name} now`,
    )
  })

  it.each([
    ['pick-by-eye', 'design-pick'],
    ['ui-record', 'ui-film'],
    ['ux-audit', 'ui-audit'],
    ['ux-measure', 'ui-measure'],
  ])('should move %s into the family its job belongs to', (old, name) => {
    expect(renameText(`run canon:${old} now`, SKILL_NAME_RULES)).toBe(
      `run canon:${name} now`,
    )
  })

  it('should land every older key on a family name in one pass rather than on the name it replaced', () => {
    expect(
      renameText(
        'canon:draft-and-pick, canon:claude-ux-audit, canon:claude-ux-measure',
        SKILL_NAME_RULES,
      ),
    ).toBe('canon:design-pick, canon:ui-audit, canon:ui-measure')
  })

  it('should land the merged docs drafter on the new doc skill rather than on the retired draft-doc', () => {
    expect(renameText('canon:draft-docs', SKILL_NAME_RULES)).toBe(
      'canon:write-doc',
    )
  })

  it('should leave a longer name that only opens with a renamed draft- name', () => {
    expect(
      renameText('draft-docsets and draft-ready-made', SKILL_NAME_RULES),
    ).toBe('draft-docsets and draft-ready-made')
  })

  it('should rewrite the two canon- names that take a standalone verb-first name', () => {
    expect(
      renameText(
        'canon:canon-record and canon:canon-frames-read',
        SKILL_NAME_RULES,
      ),
    ).toBe('canon:record-screencast and canon:read-frames')
  })
})

describe('renamePath under the skill preset', () => {
  it('should move a skill folder', () => {
    expect(
      renamePath('claude/skills/claude-worktree/SKILL.md', SKILL_NAME_RULES),
    ).toBe('claude/skills/session-worktree/SKILL.md')
  })

  it('should move a nested reference beside its skill', () => {
    expect(
      renamePath(
        'claude/skills/claude-teach/references/glossary.md',
        SKILL_NAME_RULES,
      ),
    ).toBe('claude/skills/teach-workspace/references/glossary.md')
  })

  it('should leave the sandbox domain folder, which names the harness rather than a skill', () => {
    expect(renamePath('sandbox/claude/feature.sh', SKILL_NAME_RULES)).toBe(
      'sandbox/claude/feature.sh',
    )
  })

  it('should leave a filename that only opens with a skill name', () => {
    expect(renamePath('docs/claude-worktrees.md', SKILL_NAME_RULES)).toBe(
      'docs/claude-worktrees.md',
    )
  })

  it('should move the sandbox arm script named for the skill it drives', () => {
    expect(renamePath('sandbox/claude/canon-record.sh', SKILL_NAME_RULES)).toBe(
      'sandbox/claude/record-screencast.sh',
    )
  })
})

describe('isExcludedPath under the skill preset', () => {
  it('should exclude the changelog, which records what shipped under the old names', () => {
    expect(isExcludedPath('CHANGELOG.md', SKILL_NAME_RULES)).toBe(true)
  })

  it('should exclude its own map, which the sweep would otherwise flatten', () => {
    expect(isExcludedPath('src/migrate/skill-names.ts', SKILL_NAME_RULES)).toBe(
      true,
    )
  })

  it('should exclude its own tests, whose assertions name both spellings', () => {
    expect(
      isExcludedPath('src/migrate/skill-names.test.ts', SKILL_NAME_RULES),
    ).toBe(true)
  })

  it('should exclude a transcript, which records what a session ran', () => {
    expect(
      isExcludedPath('scripts/eval/result-seed.md', SKILL_NAME_RULES),
    ).toBe(true)
  })

  it.each([
    'claude/skills/draft-doc/SKILL.md',
    'claude/skills/draft-doc/REQUIREMENT.md',
    'claude/skills/draft-figure/SKILL.md',
    'claude/skills/draft-figure/REQUIREMENT.md',
    'claude/skills/draft-identity/SKILL.md',
    'claude/skills/draft-identity/REQUIREMENT.md',
    'claude/skills/draft-slides/SKILL.md',
    'claude/skills/draft-slides/REQUIREMENT.md',
    'claude/skills/draft-and-pick/SKILL.md',
    'claude/skills/draft-and-pick/REQUIREMENT.md',
    'claude/skills/draft-ready/SKILL.md',
    'claude/skills/draft-ready/REQUIREMENT.md',
    'claude/skills/draft-screencast/SKILL.md',
    'claude/skills/draft-screencast/REQUIREMENT.md',
  ])(
    'should exclude the pointer file %s, which a later sweep would move onto its survivor',
    (path) => {
      expect(isExcludedPath(path, SKILL_NAME_RULES)).toBe(true)
    },
  )

  it('should exclude a replay fixture, which records a real project tree as it was', () => {
    expect(
      isExcludedPath(
        'sandbox/fixtures/replay/jobtriage/.claude/rules/canon/core/045-memory.md.fixture',
        SKILL_NAME_RULES,
      ),
    ).toBe(true)
  })

  it('should still move a reference left under an old draft- folder', () => {
    expect(
      isExcludedPath(
        'claude/skills/draft-doc/references/doc.md',
        SKILL_NAME_RULES,
      ),
    ).toBe(false)
  })

  it('should not exclude an ordinary shipped body', () => {
    expect(
      isExcludedPath('claude/skills/claude-docs/SKILL.md', SKILL_NAME_RULES),
    ).toBe(false)
  })

  it('should not exclude the aitk token map, which carries no skill name', () => {
    expect(isExcludedPath('src/migrate/rename.ts', SKILL_NAME_RULES)).toBe(
      false,
    )
  })
})
