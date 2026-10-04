import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type HeadingCitation,
  headingCitationsIn,
} from '@/claude/skills-headings'

/** The repository root, resolved the way `src/cli/ui.test.ts` resolves it. */
const ROOT = join(import.meta.dirname, '..', '..')

/** The tree that installs into a target, which is the whole corpus at risk. */
const CORPUS = 'claude/skills'

describe('headingCitationsIn', () => {
  it('should catch the See spelling every shipped body used', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        'Resolve at the main root. See Worktrees in `CLAUDE.md`.',
      ),
    ).toEqual([
      {
        file: 'alpha/SKILL.md',
        line: 1,
        text: 'Resolve at the main root. See Worktrees in `CLAUDE.md`.',
      },
    ])
  })

  it('should catch the per spelling mid-sentence', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        'Read the board at the main root per Worktrees in `CLAUDE.md`:',
      ),
    ).toHaveLength(1)
  })

  it('should catch a sentence-initial Per', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        'Per the plan lifecycle rule in `CLAUDE.md`, the file is archived.',
      ),
    ).toHaveLength(1)
  })

  it('should report the one-based line a reader clicks', () => {
    const text = ['# Alpha', '', 'See Worktrees in `CLAUDE.md`.'].join('\n')

    expect(headingCitationsIn('alpha/SKILL.md', text)[0]?.line).toBe(3)
  })

  it('should report every hit in one body', () => {
    const text = [
      'See Worktrees in `CLAUDE.md`.',
      'Nothing here.',
      'Resolve it per Worktrees in `CLAUDE.md`.',
    ].join('\n')

    expect(headingCitationsIn('alpha/SKILL.md', text)).toHaveLength(2)
  })

  it('should accept a body that names the file without pointing into it', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        '- `CLAUDE.md`: project type, conventions, and commands',
      ),
    ).toEqual([])
  })

  it('should not reach across a sentence boundary to the file name', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        'See the sibling skill. The baseline lives in `CLAUDE.md` today.',
      ),
    ).toEqual([])
  })

  it('should catch a citation that backticks the section name', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        'See the `Parallel sessions` heading in `CLAUDE.md`.',
      ),
    ).toHaveLength(1)
  })

  it('should accept the sibling-skill form that replaced the citation', () => {
    expect(
      headingCitationsIn(
        'alpha/SKILL.md',
        'Resolve that root the way `session-worktree` does.',
      ),
    ).toEqual([])
  })
})

describe('the shipped skill corpus', () => {
  const files = readdirSync(join(ROOT, CORPUS), { recursive: true })
    .map(String)
    .filter((rel) => rel.endsWith('.md'))
    .sort()

  it('should read a corpus that is actually on disk', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it("should cite no section of the reader's own root file", () => {
    const citations: HeadingCitation[] = []

    for (const file of files) {
      const posix = file.replaceAll('\\', '/')
      const text = readFileSync(join(ROOT, CORPUS, file), 'utf8')
      citations.push(...headingCitationsIn(`${CORPUS}/${posix}`, text))
    }

    expect(citations).toEqual([])
  })
})
