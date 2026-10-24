import { describe, expect, it } from 'vitest'
import { compareKeyChanges, treeRoots } from '@/pr/bijection'

const TRACKED = [
  '.claude/rules/core/005-behavior.md',
  'claude/skills/git-pr/SKILL.md',
  'docs/agents/index.md',
  'governance/rules/core/005-behavior.md',
  'scripts/core/verify.sh',
  'src/cli.ts',
  'standards/pr.md',
  'CLAUDE.md',
]

function read(body: string, changed: readonly string[]) {
  return compareKeyChanges({
    body,
    changed,
    roots: treeRoots(TRACKED, changed),
    head: 'abc1234',
  })
}

function keyChanges(...bullets: string[]): string {
  return ['## Key changes', '', ...bullets].join('\n')
}

describe('compareKeyChanges', () => {
  it('should refuse a body carrying no Key changes section', () => {
    expect(read('## Summary\n\nProse.\n', ['src/pr/paths.ts'])).toEqual({
      kind: 'refused',
      reason: 'no-section',
    })
  })

  it('should refuse a section that yielded no claim rather than passing it', () => {
    const result = read(
      keyChanges('- Add a task tier ahead of the two existing ones in Step 1.'),
      ['src/pr/paths.ts'],
    )

    expect(result).toEqual({ kind: 'refused', reason: 'no-claims' })
  })

  it('should refuse an empty changed set rather than reading it as met', () => {
    expect(read(keyChanges('- Add `src/pr/paths.ts`.'), [])).toEqual({
      kind: 'refused',
      reason: 'no-changes',
    })
  })
})

describe('compareKeyChanges', () => {
  it('should name a claimed file the diff does not carry', () => {
    const result = read(
      keyChanges(
        '- Correct the happy-path `log_info` line in `sandbox/claude/autoship.sh` that overstated the output.',
        '- Add `sandbox/fixtures/claude/autoship/happy-path/expect.toml`, pinning the completion line.',
      ),
      ['sandbox/fixtures/claude/autoship/happy-path/expect.toml'],
    )

    expect(result.kind === 'measured' && result.unmet).toMatchObject([
      { path: 'sandbox/claude/autoship.sh' },
    ])
    expect(result.kind === 'measured' && result.unnamed).toEqual([])
  })

  it('should name a changed file no bullet reached (#1269)', () => {
    const result = read(
      keyChanges(
        '- Add `readCitations()` in `src/gov/citations.ts`, which extracts a citation from a rule body.',
        '- Add `docs/agents/rule-citations.md` and its rows in `docs/agents/index.md`.',
      ),
      [
        'canon/context/governance/index.md',
        'docs/agents/index.md',
        'docs/agents/rule-citations.md',
        'src/gov/citations.test.ts',
        'src/gov/citations.ts',
      ],
    )

    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unnamed).toEqual([
      'canon/context/governance/index.md',
    ])
    expect(result.kind === 'measured' && result.incidental).toEqual([
      'src/gov/citations.test.ts',
    ])
  })

  it('should credit every changed file a single bullet names (#1329)', () => {
    const result = read(
      keyChanges(
        '- Update `canon/context/cli/packaging.md` with what the check proves, `canon/context/development/gates.md` with the working-tree read, and `canon/context/ci.md` to reverse its stated decision.',
      ),
      [
        'canon/context/ci.md',
        'canon/context/cli/packaging.md',
        'canon/context/development/gates.md',
      ],
    )

    expect(result.kind === 'measured' && result.unnamed).toEqual([])
    expect(result.kind === 'measured' && result.unmet).toEqual([])
  })

  it('should never accuse over a path past its bullet first comma (#1276)', () => {
    const result = read(
      keyChanges(
        '- Add `canon pr key-changes` in `src/commands/pr.ts`, following the exit ladder `src/commands/labels.ts` already carries.',
      ),
      ['src/commands/pr.ts'],
    )

    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unresolved).toMatchObject([
      { path: 'src/commands/labels.ts', anchored: true, leading: false },
    ])
  })

  it('should hold a test, a fixture, and a lockfile apart from unnamed (#1331)', () => {
    const result = read(keyChanges('- Add `src/cli.ts`.'), [
      'bun.lock',
      'docs/agents/index.md',
      'sandbox/fixtures/claude/autoship/expect.toml',
      'src/cli.ts',
      'src/pr/paths.test.ts',
    ])

    expect(result.kind === 'measured' && result.unnamed).toEqual([
      'docs/agents/index.md',
    ])
    expect(result.kind === 'measured' && result.incidental).toEqual([
      'bun.lock',
      'sandbox/fixtures/claude/autoship/expect.toml',
      'src/pr/paths.test.ts',
    ])
  })

  it('should let a directory claim cover every file beneath it', () => {
    const result = read(
      keyChanges('- Rename four sandbox arms under `sandbox/claude/`.'),
      ['sandbox/claude/autoship.sh', 'sandbox/claude/ship.sh'],
    )

    expect(result.kind === 'measured' && result.unnamed).toEqual([])
    expect(result.kind === 'measured' && result.unmet).toEqual([])
  })

  it('should let a partial path credit a changed file without ever accusing one', () => {
    const result = read(
      keyChanges(
        '- Rewrite the addressing ladder in `role-worker/SKILL.md` to resolve a name at send time.',
        '- Point `references/gone.md` at the standard.',
      ),
      ['claude/skills/role-worker/SKILL.md'],
    )

    expect(result.kind === 'measured' && result.unnamed).toEqual([])
    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unresolved).toMatchObject([
      { path: 'references/gone.md' },
    ])
  })

  it('should carry the head the comparison was computed at', () => {
    const result = read(keyChanges('- Add `src/pr/paths.ts`.'), [
      'src/pr/paths.ts',
    ])

    expect(result.kind === 'measured' && result.head).toBe('abc1234')
  })

  it("should credit a claim naming a rename's source path (#1611)", () => {
    const result = compareKeyChanges({
      body: keyChanges(
        '- Move `claude/skills/identity/` to `claude/skills/design-identity/`.',
      ),
      changed: ['claude/skills/design-identity/SKILL.md'],
      roots: treeRoots(TRACKED, ['claude/skills/design-identity/SKILL.md']),
      renames: [
        {
          from: 'claude/skills/identity/SKILL.md',
          to: 'claude/skills/design-identity/SKILL.md',
        },
      ],
    })

    expect(result.kind === 'measured' && result.unmet).toEqual([])
  })

  it('should credit a claim naming an added .gitignore pattern (#1614)', () => {
    const result = compareKeyChanges({
      body: keyChanges('- Ignore `web/screenshots/` and `web/evidence/`.'),
      changed: ['.gitignore'],
      roots: treeRoots(TRACKED, ['.gitignore']),
      ignoreAdditions: ['web/screenshots/', 'web/evidence/'],
    })

    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unnamed).toEqual([])
  })

  it('should downgrade an unmet-bound claim to unresolved when the evidence could not be read', () => {
    const result = compareKeyChanges({
      body: keyChanges(
        '- Move `claude/skills/identity/` to `claude/skills/design-identity/`.',
      ),
      changed: ['claude/skills/design-identity/SKILL.md'],
      roots: treeRoots(TRACKED, ['claude/skills/design-identity/SKILL.md']),
      evidenceUnread: true,
    })

    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unresolved).toMatchObject([
      { path: 'claude/skills/identity/' },
    ])
    expect(result.kind === 'measured' && result.evidenceUnread).toBe(true)
  })

  it('should report evidenceUnread false on an ordinary measured pass', () => {
    const result = read(keyChanges('- Add `src/pr/paths.ts`.'), [
      'src/pr/paths.ts',
    ])

    expect(result.kind === 'measured' && result.evidenceUnread).toBe(false)
  })
})

describe('compareKeyChanges root files', () => {
  it('should credit root files named in code spans beside nested paths', () => {
    const changed = ['README.md', '.gitignore', 'src/pr/paths.ts']
    const result = read(
      keyChanges(
        '- Add `src/pr/paths.ts`.',
        '- Document it in `README.md` and `.gitignore`.',
      ),
      changed,
    )

    expect(result.kind === 'measured' && result.unnamed).toEqual([])
    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(
      result.kind === 'measured' && result.claims.map((c) => c.path),
    ).toEqual(['src/pr/paths.ts', 'README.md', '.gitignore'])
  })

  it('should raise nothing for a bare span matching no changed file', () => {
    const result = read(
      keyChanges('- Add `src/pr/paths.ts`, setting `true` and `bun` aside.'),
      ['src/pr/paths.ts'],
    )

    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unresolved).toEqual([])
  })

  it('should raise nothing for a root file named but unchanged', () => {
    const result = read(
      keyChanges('- `README.md` gains a section.', '- Add `src/pr/paths.ts`.'),
      ['src/pr/paths.ts'],
    )

    expect(result.kind === 'measured' && result.unmet).toEqual([])
    expect(result.kind === 'measured' && result.unresolved).toEqual([])
  })

  it('should not let a root name claim the same file in a nested folder', () => {
    const result = read(keyChanges('- Bump `package.json`.'), [
      'web/package.json',
    ])

    expect(result.kind === 'measured' && result.unnamed).toEqual([
      'web/package.json',
    ])
  })

  it('should credit a root file cited with a line suffix', () => {
    const result = read(keyChanges('- Fix the note at `README.md:12`.'), [
      'README.md',
    ])

    expect(result.kind === 'measured' && result.unnamed).toEqual([])
  })
})

describe('treeRoots', () => {
  it('should admit a top-level folder this branch created', () => {
    expect(
      treeRoots(['src/cli.ts'], ['examples/demo.ts']).has('examples'),
    ).toBe(true)
  })

  it('should ignore a path with no folder above it', () => {
    expect(treeRoots(['README.md'], ['CLAUDE.md']).size).toBe(0)
  })
})
