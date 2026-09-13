import { describe, expect, it } from 'vitest'
import { extractKeyChangePaths, readSection } from '@/pr/paths'

/**
 * The top-level entries this repository holds, which is what decides whether a
 * claim is whole enough to accuse with. Fixed here rather than read from the
 * tree so a case states the world it is judged against.
 */
const ROOTS = new Set([
  '.claude',
  '.github',
  'assets',
  'claude',
  'docs',
  'governance',
  'internal',
  'scripts',
  'snippets',
  'src',
  'standards',
  'tooling',
])

/** Wraps bullets in the section heading, since the extractor reads one section. */
function body(...bullets: string[]): string {
  return [
    '## Summary',
    '',
    'Prose.',
    '',
    '## Key Changes',
    '',
    ...bullets,
  ].join('\n')
}

function pathsOf(...bullets: string[]): string[] {
  const read = extractKeyChangePaths(body(...bullets), ROOTS)
  return read.kind === 'read' ? read.claims.map((claim) => claim.path) : []
}

describe('readSection', () => {
  it('should return nothing when the body carries no Key Changes heading', () => {
    const read = extractKeyChangePaths('## Summary\n\nProse.\n', ROOTS)

    expect(read.kind).toBe('no-section')
  })

  it('should stop at the next heading of the same level', () => {
    const text = [
      '## Key Changes',
      '',
      '- Add `src/pr/paths.ts`.',
      '',
      '## Technical Context',
      '',
      '- The stamp lands at `docs/agents/index.md` inside a target.',
    ].join('\n')

    expect(readSection(text, 'Key Changes')).not.toContain('docs/agents')
  })

  it('should read a body written with carriage returns', () => {
    const text = '## Key Changes\r\n\r\n- Add `src/pr/paths.ts`.\r\n'

    const read = extractKeyChangePaths(text, ROOTS)

    expect(read.kind === 'read' && read.claims.map((c) => c.path)).toEqual([
      'src/pr/paths.ts',
    ])
  })
})

/**
 * Every case below is a bullet lifted verbatim from a merged pull request in
 * this repository, named by number, because a synthetic bullet proves the
 * extractor against prose nobody writes. The four classes the plan specified
 * are the first four, and the five after them are what a run over the whole
 * merged corpus turned up beside them.
 */
describe('extractKeyChangePaths', () => {
  it('should drop a bare name a compound bullet leaves as a fragment (#1267)', () => {
    expect(
      pathsOf(
        '- Update `canon/context/sandbox/overview.md`, `running.md`, and `coverage.md` to describe the per-run id.',
      ),
    ).toEqual(['canon/context/sandbox/overview.md'])
  })

  it('should drop an angle-bracket placeholder naming no real file (#1248)', () => {
    expect(
      pathsOf(
        '- Add a "Determine provenance" step to the enumeration in `claude/skills/git-worktree/SKILL.md`: a non-main row whose path is not under `<MAIN_ROOT>/.claude/worktrees/` is marked `foreign`.',
      ),
    ).toEqual(['claude/skills/git-worktree/SKILL.md'])
  })

  it('should drop a backticked command carrying a slash (#1254)', () => {
    expect(
      pathsOf(
        "- The orchestrator pins the wave and checks each target's branch with `canon sessions list --branch chore/agents --repository <clone>`.",
      ),
    ).toEqual([])
  })

  it('should drop a bare fragment with no full path in the bullet (#1233)', () => {
    expect(
      pathsOf(
        '- `board-write` stages a board and asserts a worker reports a needed row rather than writing `priority.md` or `backlog.md`.',
      ),
    ).toEqual([])
  })

  it('should mark a file named for context after the claim as trailing (#1265)', () => {
    const read = extractKeyChangePaths(
      body(
        '- Add `canon autoship classify` in `src/commands/autoship.ts`, following `src/commands/labels.ts` for the frame, the stream split, and the exit ladder.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'src/commands/autoship.ts', leading: true },
      { path: 'src/commands/labels.ts', leading: false },
    ])
  })

  it('should drop a grep pattern that reads as a folder (#1241)', () => {
    expect(
      pathsOf(
        '- Add `TEST_CORPORA_PATTERNS` to `scripts/core/verify.sh`, and join it into `TEST_CORPORA` for the Tests guard to read beside `^src/`.',
      ),
    ).toEqual(['scripts/core/verify.sh'])
  })

  it('should drop a dotted number that is not an extension (#1256)', () => {
    expect(
      pathsOf(
        '- Add `startServer()` and `respond()` in `src/serve/static.ts`, binding `127.0.0.1` only and sending `cache-control: no-store`.',
      ),
    ).toEqual(['src/serve/static.ts'])
  })

  it('should resolve a non-directory span with no extension', () => {
    expect(
      pathsOf('- Add the post-merge hook at `scripts/hooks/post-merge`.'),
    ).toEqual(['scripts/hooks/post-merge'])
  })

  it('should drop a dotted-decimal span sitting behind a folder prefix', () => {
    expect(
      pathsOf('- Bind the loopback address `scripts/serve/127.0.0.1`.'),
    ).toEqual([])
  })

  it('should drop a bare top-level folder nobody claims to have rewritten (#1250)', () => {
    expect(
      pathsOf(
        '- Rename the eight internal skills under `.claude/skills/` from `canon-<domain>` to `internal-<domain>`, matching the `internal/` folder that already marks the boundary.',
      ),
    ).toEqual(['.claude/skills/'])
  })

  it('should drop a bullet that disclaims the change it names (#1274)', () => {
    expect(
      pathsOf(
        '- Leave `scripts/sandbox/fixtures/claude/autoship/prose-executable/expect.toml` untouched, since the decision keeps the receipt rather than retiring it.',
      ),
    ).toEqual([])
  })

  it('should keep a claim whose comma-free bullet uses alone restrictively (#1276)', () => {
    expect(
      pathsOf('- Move the threshold read into `src/gate/stages.ts` alone.'),
    ).toEqual(['src/gate/stages.ts'])
  })

  it('should keep the region before the comma when alone follows it restrictively (#1276)', () => {
    expect(
      pathsOf('- Rewrite `src/pr/paths.ts` alone and leave the rest.'),
    ).toEqual(['src/pr/paths.ts'])
  })

  it('should drop a bullet that opens by refusing an action', () => {
    expect(
      pathsOf(
        '- Do not edit `src/tasks/validate.ts`, which another row holds.',
      ),
    ).toEqual([])
  })

  it('should keep every span past a doubled-backtick span earlier in the bullet', () => {
    const read = extractKeyChangePaths(
      body(
        '- Reading ``canon markdown audit``, then rewrite `src/pr/paths.ts` and add a case in `src/pr/paths.test.ts`.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'src/pr/paths.ts', leading: false },
      { path: 'src/pr/paths.test.ts', leading: false },
    ])
  })

  it('should cut the claim region at the comma outside a doubled-backtick span rather than the one inside it', () => {
    const read = extractKeyChangePaths(
      body(
        '- Reading ``a, b`` then rewrite `src/pr/paths.ts`, and add `src/pr/paths.test.ts`.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'src/pr/paths.ts', leading: true },
      { path: 'src/pr/paths.test.ts', leading: false },
    ])
  })

  it('should keep a file:line span naming a third, distinct file with no bare-line companion', () => {
    expect(
      pathsOf(
        '- Update `src/pr/paths.ts` and `src/pr/paths.test.ts`, and reword the row at `docs/agents/key-changes.md:12`.',
      ),
    ).toEqual([
      'src/pr/paths.ts',
      'src/pr/paths.test.ts',
      'docs/agents/key-changes.md',
    ])
  })

  it('should drop a line citation that follows the bullet own claim (#1236)', () => {
    expect(
      pathsOf(
        '- Add a `## Gotchas` entry to `canon/context/development/verification.md` stating that the Types and Tests stages at `scripts/core/verify.sh:634` and `:642` skip a branch editing a corpus outside `src/`.',
      ),
    ).toEqual(['canon/context/development/verification.md'])
  })
})

describe('extractKeyChangePaths', () => {
  it('should take every path a bullet names across its commas (#1329)', () => {
    expect(
      pathsOf(
        '- Update `canon/context/cli/packaging.md` with what the check now proves and what it still cannot see, `canon/context/development/gates.md` with the working-tree read the pack replaces the last-commit read with, and `canon/context/ci.md` to reverse its stated decision.',
      ),
    ).toEqual([
      'canon/context/cli/packaging.md',
      'canon/context/development/gates.md',
      'canon/context/ci.md',
    ])
  })

  it('should mark only the path ahead of the first comma as leading (#1329)', () => {
    const read = extractKeyChangePaths(
      body(
        '- Update `canon/context/cli/packaging.md` with what the check proves, `canon/context/ci.md` to reverse its stated decision.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'canon/context/cli/packaging.md', leading: true },
      { path: 'canon/context/ci.md', leading: false },
    ])
  })

  it('should drop a trailing path when the bullet opens by disclaiming (#1274)', () => {
    expect(
      pathsOf(
        '- Leave `scripts/sandbox/fixtures/claude/autoship/prose-executable/expect.toml` untouched, since `src/autoship/paths.ts` already reads the set.',
      ),
    ).toEqual([])
  })

  it('should drop a bullet disclaiming with as written past a leading path', () => {
    expect(
      pathsOf('- Ship `standards/plan.md` as written, and add `docs/plan.md`.'),
    ).toEqual([])
  })

  it('should keep the first reading when a path repeats leading in a later bullet', () => {
    const read = extractKeyChangePaths(
      body(
        '- Add `src/pr/paths.ts`, following `src/pr/bijection.ts` for the shape.',
        '- Rewrite `src/pr/bijection.ts` to split the second direction.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'src/pr/paths.ts', leading: true },
      { path: 'src/pr/bijection.ts', leading: false },
    ])
  })

  it('should take every path in a claim region with no comma (#1269)', () => {
    expect(
      pathsOf(
        '- Add `docs/agents/rule-citations.md` and its rows in `docs/agents/commands.md` and `docs/agents/index.md`.',
      ),
    ).toEqual([
      'docs/agents/rule-citations.md',
      'docs/agents/commands.md',
      'docs/agents/index.md',
    ])
  })

  it('should take a line citation that leads its bullet (#1241)', () => {
    expect(
      pathsOf(
        '- Widen the Tests guard at `scripts/core/verify.sh:665` and reword its skip line, leaving the Types guard at `:657` alone.',
      ),
    ).toEqual(['scripts/core/verify.sh'])
  })

  it('should take a nested folder as a directory claim (#1250)', () => {
    const read = extractKeyChangePaths(
      body(
        '- Rename four sandbox arms under `scripts/sandbox/claude/` and two fixture directories under `scripts/sandbox/fixtures/claude/`.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'scripts/sandbox/claude/', directory: true },
      { path: 'scripts/sandbox/fixtures/claude/', directory: true },
    ])
  })

  it('should mark a partially written path unanchored (#1259)', () => {
    const read = extractKeyChangePaths(
      body(
        '- Rewrite the addressing ladder in `role-worker/SKILL.md` to resolve a name from the carried id at send time.',
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { path: 'role-worker/SKILL.md', anchored: false },
    ])
  })

  it('should keep a compound sibling folder unanchored rather than dropping it (#1253)', () => {
    const read = extractKeyChangePaths(
      body(
        "- Add `scripts/sandbox/fixtures/claude/autoship/prose-informational/expect.toml` and `prose-executable/expect.toml`, asserting Step 5's review-skip split against `.claude/review/branch/review-<slug>.md`.",
      ),
      ROOTS,
    )

    expect(read.kind === 'read' && read.claims).toMatchObject([
      { anchored: true },
      { path: 'prose-executable/expect.toml', anchored: false },
    ])
  })

  it('should keep a claim whose bullet only mentions leaving other lines alone (#1269)', () => {
    expect(
      pathsOf(
        '- Add the `Rule citations` stage to `scripts/core/verify.sh` as one insertion that touches no other line.',
      ),
    ).toEqual(['scripts/core/verify.sh'])
  })

  it('should fold a wrapped continuation line into the bullet above it', () => {
    expect(
      pathsOf(
        '- Add `src/pr/paths.ts` and',
        '  `src/pr/bijection.ts` to lift path spans out of a bullet.',
      ),
    ).toEqual(['src/pr/paths.ts', 'src/pr/bijection.ts'])
  })

  it('should separate a section that carries no resolvable claim from an absent one', () => {
    const read = extractKeyChangePaths(
      body(
        '- Add a task tier ahead of the two existing ones in `auto-ship` Step 1.',
      ),
      ROOTS,
    )

    expect(read).toEqual({ kind: 'read', claims: [], bullets: 1 })
  })
})
