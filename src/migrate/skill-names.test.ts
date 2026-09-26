import { describe, expect, it } from 'vitest'
import { planRename } from '@/migrate/plan'
import { isExcludedPath, renamePath, renameText } from '@/migrate/rename'
import { SKILL_NAME_MAP, SKILL_NAME_RULES } from '@/migrate/skill-names'

describe('SKILL_NAME_MAP', () => {
  it('should carry one row for every renamed skill', () => {
    expect(Object.keys(SKILL_NAME_MAP)).toHaveLength(31)
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

  it('should let two keys share a name only where a retired name was retargeted past its first rename', () => {
    const byName = new Map<string, string[]>()
    for (const [key, name] of Object.entries(SKILL_NAME_MAP)) {
      byName.set(name, [...(byName.get(name) ?? []), key])
    }

    const shared = [...byName.values()].filter((keys) => keys.length > 1)

    expect(shared).toEqual([
      ['claude-docs', 'docs-fold'],
      ['claude-ui-test', 'ui-test'],
    ])
  })

  it('should carry no single-word key, which wholeToken would rewrite everywhere it appears as an ordinary word', () => {
    const single = Object.keys(SKILL_NAME_MAP).filter(
      (name) => !name.includes('-'),
    )

    expect(single).toEqual([])
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

  it('should rewrite the two canon- names that join the draft- family', () => {
    expect(
      renameText(
        'canon:canon-screencast and canon:canon-slides-draft',
        SKILL_NAME_RULES,
      ),
    ).toBe('canon:draft-screencast and canon:draft-slides')
  })

  it('should land both ui spellings on the new name in one pass', () => {
    expect(
      renameText('canon:claude-ui-test and canon:ui-test', SKILL_NAME_RULES),
    ).toBe('canon:ui-checklist and canon:ui-checklist')
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
    expect(
      renamePath('scripts/sandbox/claude/feature.sh', SKILL_NAME_RULES),
    ).toBe('scripts/sandbox/claude/feature.sh')
  })

  it('should leave the wiki page whose filename only opens with a skill name', () => {
    expect(
      renamePath('wiki/claude/claude-worktrees.md', SKILL_NAME_RULES),
    ).toBe('wiki/claude/claude-worktrees.md')
  })

  it('should move the sandbox arm script named for the skill it drives', () => {
    expect(
      renamePath('scripts/sandbox/claude/canon-record.sh', SKILL_NAME_RULES),
    ).toBe('scripts/sandbox/claude/record-screencast.sh')
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

  it('should not exclude an ordinary shipped body', () => {
    expect(
      isExcludedPath('claude/skills/claude-docs/SKILL.md', SKILL_NAME_RULES),
    ).toBe(false)
  })

  it('should leave the pointer at the old fold name unplanned, so a later run never moves it onto the survivor', () => {
    const plan = planRename(
      [
        { path: 'claude/skills/docs-fold/SKILL.md', text: 'name: docs-fold' },
        {
          path: 'claude/skills/docs-fold/REQUIREMENT.md',
          text: '# docs-fold',
        },
      ],
      SKILL_NAME_RULES,
    )

    expect(plan.entries).toEqual([])
  })

  it('should not exclude the aitk token map, which carries no skill name', () => {
    expect(isExcludedPath('src/migrate/rename.ts', SKILL_NAME_RULES)).toBe(
      false,
    )
  })
})
