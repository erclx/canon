import { describe, expect, it } from 'vitest'
import {
  isExcludedPath,
  MOVED_ENTRIES,
  movedPath,
  planSurfaceRootsMove,
  referencesExcluded,
  rewriteText,
  scanText,
} from '@/migrate/surface-roots'

function source(path: string, text = '') {
  return { path, text }
}

describe('MOVED_ENTRIES', () => {
  it('should carry the seven tracked surfaces the move relocates', () => {
    expect([...MOVED_ENTRIES].sort()).toEqual([
      'ARCHITECTURE.md',
      'DESIGN.md',
      'REQUIREMENTS.md',
      'canon',
      'context',
      'decisions',
      'wireframes',
    ])
  })
})

describe('movedPath', () => {
  it('should move a loose document to the new root', () => {
    expect(movedPath('.claude/ARCHITECTURE.md')).toBe('canon/ARCHITECTURE.md')
  })

  it('should move a file inside a moved folder', () => {
    expect(movedPath('.claude/context/cli/index.md')).toBe(
      'canon/context/cli/index.md',
    )
  })

  it('should leave a vendor-read folder where it is', () => {
    expect(movedPath('.claude/rules/core/005-behavior.md')).toBeUndefined()
  })

  it('should move the install stamp folder, respelled as canon/config/', () => {
    expect(movedPath('.claude/canon/pr-labels.toml')).toBe(
      'canon/config/pr-labels.toml',
    )
  })

  it('should not treat a longer sibling name as the moved folder', () => {
    expect(movedPath('.claude/contexts/x.md')).toBeUndefined()
  })
})

describe('rewriteText', () => {
  it('should rewrite a citation carrying a trailing path', () => {
    expect(rewriteText('see `.claude/context/cli/index.md` first')).toBe(
      'see `canon/context/cli/index.md` first',
    )
  })

  it('should rewrite a bare folder citation with no trailing slash', () => {
    expect(rewriteText('entries live in .claude/context')).toBe(
      'entries live in canon/context',
    )
  })

  it('should rewrite an eager import of a loose document', () => {
    expect(rewriteText('@.claude/ARCHITECTURE.md')).toBe(
      '@canon/ARCHITECTURE.md',
    )
  })

  it('should not rewrite a longer sibling folder name', () => {
    expect(rewriteText('.claude/contexts/x.md')).toBe('.claude/contexts/x.md')
  })

  it('should leave a vendor-read folder alone', () => {
    const text = '.claude/rules/core/005.md and .claude/skills/x/SKILL.md'
    expect(rewriteText(text)).toBe(text)
  })

  it('should rewrite the install stamp folder, respelled as canon/config/', () => {
    expect(rewriteText('.claude/canon/pr-labels.toml')).toBe(
      'canon/config/pr-labels.toml',
    )
  })

  it('should keep a line carrying the keep marker', () => {
    const text = 'fallback .claude/context/ <!-- canon-keep-surface-root -->'
    expect(rewriteText(text)).toBe(text)
  })

  it('should keep a line whose nearest non-blank line above carries the marker', () => {
    const text =
      '// canon-keep-surface-root\n\nconst old = ".claude/wireframes"'
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave a citation inside a dated paragraph alone', () => {
    const text = 'Read `.claude/context/x.md`. Measured on 2026-08-20.'
    expect(rewriteText(text)).toBe(text)
  })

  it('should leave a frontmatter paths glob alone', () => {
    const text = "---\npaths:\n  - '.claude/context/**'\n---\n"
    expect(rewriteText(text)).toBe(text)
  })
})

describe('scanText', () => {
  it('should count kept and rewritten citations apart', () => {
    const text = [
      '.claude/context/a.md',
      '.claude/DESIGN.md <!-- canon-keep-surface-root -->',
    ].join('\n')

    expect(scanText(text)).toMatchObject({ rewritten: 1, kept: 1 })
  })
})

describe('isExcludedPath', () => {
  it('should exclude the changelog', () => {
    expect(isExcludedPath('CHANGELOG.md')).toBe(true)
  })

  it('should exclude both root resolver modules', () => {
    expect(isExcludedPath('src/surface-root.ts')).toBe(true)
    expect(isExcludedPath('src/record-root.ts')).toBe(true)
  })

  it('should exclude the migrate modules', () => {
    expect(isExcludedPath('src/migrate/surface-roots.ts')).toBe(true)
  })

  it('should exclude an eval result transcript', () => {
    expect(isExcludedPath('scripts/eval/result-01.md')).toBe(true)
  })

  it('should exclude the live hooks and the seeded copies', () => {
    expect(isExcludedPath('.claude/hooks/index-reminder.sh')).toBe(true)
    expect(
      isExcludedPath('tooling/claude/seeds/.claude/hooks/index-reminder.sh'),
    ).toBe(true)
  })

  it('should not exclude a test file by its suffix alone', () => {
    expect(isExcludedPath('src/context/audit.test.ts')).toBe(false)
  })
})

describe('referencesExcluded', () => {
  it('should read a quoted excluded path as coupling', () => {
    expect(referencesExcluded('see src/surface-root.ts')).toBe(true)
  })
})

describe('planSurfaceRootsMove', () => {
  it('should move a file and rewrite what it cites in one entry', () => {
    const plan = planSurfaceRootsMove([
      source('.claude/context/index.md', 'see .claude/wireframes/index.md'),
    ])

    expect(plan.entries).toEqual([
      {
        path: '.claude/context/index.md',
        movesTo: 'canon/context/index.md',
        text: 'see canon/wireframes/index.md',
        rewritten: 1,
        kept: 0,
      },
    ])
  })

  it('should move a file that cites nothing without carrying text', () => {
    const plan = planSurfaceRootsMove([source('.claude/DESIGN.md', '# D\n')])

    expect(plan.entries).toEqual([
      {
        path: '.claude/DESIGN.md',
        movesTo: 'canon/DESIGN.md',
        rewritten: 0,
        kept: 0,
      },
    ])
    expect(plan.moves).toBe(1)
  })

  it('should drop a file that neither moves nor cites', () => {
    const plan = planSurfaceRootsMove([source('docs/a.md', 'nothing here')])

    expect(plan.entries).toEqual([])
  })

  it('should report an excluded file carrying a citation without rewriting it', () => {
    const plan = planSurfaceRootsMove([
      source('CHANGELOG.md', 'moved .claude/context/'),
    ])

    expect(plan.entries).toEqual([])
    expect(plan.excluded).toEqual(['CHANGELOG.md'])
  })

  it('should move the install stamp folder and respell its citations', () => {
    const plan = planSurfaceRootsMove([
      source('.claude/canon/pr-labels.toml', 'see .claude/canon/config.json'),
    ])

    expect(plan.entries).toEqual([
      {
        path: '.claude/canon/pr-labels.toml',
        movesTo: 'canon/config/pr-labels.toml',
        text: 'see canon/config/config.json',
        rewritten: 1,
        kept: 0,
      },
    ])
  })

  it('should report nothing on an already-moved tree', () => {
    const plan = planSurfaceRootsMove([
      source('canon/context/index.md', 'see canon/wireframes/index.md'),
      source('docs/a.md', 'read canon/ARCHITECTURE.md'),
    ])

    expect(plan.entries).toEqual([])
    expect(plan.rewritten).toBe(0)
    expect(plan.moves).toBe(0)
  })
})
