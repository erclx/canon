import { describe, expect, it } from 'vitest'
import { isToolkitOwned, planRename, type RenameSource } from '@/migrate/plan'
import { AITK_RULES } from '@/migrate/rename'
import { SKILL_NAME_RULES } from '@/migrate/skill-names'

function source(path: string, text: string): RenameSource {
  return { path, text }
}

describe('planRename', () => {
  it('should carry a file whose content changes', () => {
    const plan = planRename([source('src/cli.ts', 'run aitk gov')], AITK_RULES)

    expect(plan.entries).toHaveLength(1)
    expect(plan.entries[0]?.text).toBe('run canon gov')
    expect(plan.renamed).toBe(1)
  })

  it('should drop a file carrying no token', () => {
    const plan = planRename([source('src/cli.ts', 'nothing here')], AITK_RULES)

    expect(plan.entries).toHaveLength(0)
  })

  it('should carry a file that only moves', () => {
    const plan = planRename(
      [source('claude/skills/aitk-cli/x.png', 'binary')],
      AITK_RULES,
    )

    expect(plan.entries[0]?.movesTo).toBe('claude/skills/canon-cli/x.png')
  })

  it('should record both the move and the rewrite for one file', () => {
    const entry = planRename(
      [source('claude/skills/aitk-cli/SKILL.md', 'call aitk cli')],
      AITK_RULES,
    ).entries[0]

    expect(entry?.movesTo).toBe('claude/skills/canon-cli/SKILL.md')
    expect(entry?.text).toBe('call canon cli')
  })

  it('should list an excluded file rather than rewriting it', () => {
    const plan = planRename(
      [source('CHANGELOG.md', 'aitk shipped')],
      AITK_RULES,
    )

    expect(plan.entries).toHaveLength(0)
    expect(plan.excluded).toEqual(['CHANGELOG.md'])
  })

  it('should total what it rewrote and what it protected across files', () => {
    const plan = planRename(
      [source('a.md', 'aitk and aitk-sandbox'), source('b.md', 'AITK')],
      AITK_RULES,
    )

    expect(plan.renamed).toBe(2)
    expect(plan.protectedCount).toBe(1)
  })

  it('should count a move even when the content is unchanged', () => {
    const plan = planRename(
      [source('claude/skills/aitk-cli/x.png', 'binary')],
      AITK_RULES,
    )

    expect(plan.moves).toBe(1)
    expect(plan.renamed).toBe(0)
  })

  it('should keep a protected path from moving', () => {
    const plan = planRename(
      [source('scripts/aitk-sandbox/run.sh', 'echo')],
      AITK_RULES,
    )

    expect(plan.entries).toHaveLength(0)
  })

  it('should rewrite a seeded hook body carrying the retired binary', () => {
    const plan = planRename(
      [source('.claude/hooks/memory-index.sh', 'aitk indexes regen')],
      AITK_RULES,
    )

    expect(plan.entries[0]?.text).toBe('canon indexes regen')
  })

  it('should rewrite only the binary name in a customized hook body', () => {
    const plan = planRename(
      [
        source(
          '.claude/hooks/memory-index.sh',
          'echo "custom line"\naitk indexes regen',
        ),
      ],
      AITK_RULES,
    )

    expect(plan.entries[0]?.text).toBe(
      'echo "custom line"\ncanon indexes regen',
    )
  })

  it('should move a skill folder and rewrite its body under the skill preset', () => {
    const entry = planRename(
      [
        source(
          'claude/skills/claude-docs/SKILL.md', // canon-keep-retired
          'name: claude-docs\nrun canon:claude-docs', // canon-keep-retired
        ),
      ],
      SKILL_NAME_RULES,
    ).entries[0]

    expect(entry?.movesTo).toBe('claude/skills/context-fold/SKILL.md')
    expect(entry?.text).toBe('name: context-fold\nrun canon:context-fold')
  })

  it('should leave the aitk token alone under the skill preset', () => {
    const plan = planRename(
      [source('src/cli.ts', 'run aitk gov')],
      SKILL_NAME_RULES,
    )

    expect(plan.entries).toHaveLength(0)
  })
})

describe('isToolkitOwned', () => {
  it('should own the stamp folder', () => {
    expect(isToolkitOwned('.claude/aitk/config.json')).toBe(true)
  })

  it('should own the stamp folder at its moved root', () => {
    expect(isToolkitOwned('canon/config/config.json')).toBe(true)
  })

  it('should own an installed rule', () => {
    expect(isToolkitOwned('.claude/rules/core/005-behavior.md')).toBe(true)
  })

  it('should not own prose the project wrote', () => {
    expect(isToolkitOwned('docs/my-notes.md')).toBe(false)
  })

  it('should not own the project root file', () => {
    expect(isToolkitOwned('CLAUDE.md')).toBe(false)
  })

  it('should own a seeded hook', () => {
    expect(isToolkitOwned('.claude/hooks/memory-index.sh')).toBe(true)
  })
})
