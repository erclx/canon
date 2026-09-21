import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import {
  isShippedCorpus,
  REFERENCE_MARKER,
  referencesIn,
  SHIPPED_CORPORA,
} from '@/shipped/references'

describe('referencesIn', () => {
  // No test in this top-level block exercises a `docs/`-shaped token, so this
  // fixture root exists only to satisfy the required parameter and is never
  // read. The `DOCS_PATH` describe below owns a root that resolves for real.
  let noDocsRoot: string

  beforeAll(() => {
    noDocsRoot = mkdtempSync(join(tmpdir(), 'canon-references-no-docs-'))
  })

  afterAll(() => {
    rmSync(noDocsRoot, { recursive: true, force: true })
  })

  it('should report a bare pull request number', () => {
    expect(
      referencesIn(
        'claude/skills/alpha/SKILL.md',
        'The poll told an operator the opposite of what the worker said in #1307.',
        noDocsRoot,
      ),
    ).toEqual([
      {
        file: 'claude/skills/alpha/SKILL.md',
        line: 1,
        kind: 'pull-request',
        text: '#1307',
      },
    ])
  })

  it('should report a bare commit sha', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        'Measured at `6c273324`.',
        noDocsRoot,
      ),
    ).toEqual([
      {
        file: 'docs/agents/alpha.md',
        line: 1,
        kind: 'commit',
        text: '6c273324',
      },
    ])
  })

  it('should report an all-digit sha, which requiring a letter would drop', () => {
    const found = referencesIn(
      'claude/skills/alpha/SKILL.md',
      'against `5653721`',
      noDocsRoot,
    )

    expect(found).toHaveLength(1)
    expect(found[0]?.kind).toBe('commit')
    expect(found[0]?.text).toBe('5653721')
  })

  it('should report a seven-digit measurement, which admitting an all-digit sha admits with it', () => {
    const found = referencesIn(
      'docs/agents/alpha.md',
      'The sweep read 2119000 paragraphs.',
      noDocsRoot,
    )

    expect(found).toHaveLength(1)
    expect(found[0]?.kind).toBe('commit')
  })

  it('should let the marker answer a seven-digit measurement, since no narrowing can', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        `The sweep read 2119000 paragraphs. <!-- ${REFERENCE_MARKER}: a count, not a commit -->`,
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should report a pull request number qualified with its own repository', () => {
    expect(
      referencesIn(
        'claude/skills/alpha/SKILL.md',
        'Measured on `erclx/canon#1299`.',
        noDocsRoot,
      ),
    ).toEqual([
      {
        file: 'claude/skills/alpha/SKILL.md',
        line: 1,
        kind: 'pull-request',
        text: 'erclx/canon#1299',
        selfCitation: true,
      },
    ])
  })

  it('should pass the qualified form a shipped body already carries', () => {
    expect(
      referencesIn(
        'claude/skills/session-worktree/SKILL.md',
        'Tracked upstream as `anthropics/claude-code#58345`, closed as not planned.',
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should report a sha qualified with its own repository', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        'A pass written against `erclx/canon@5653721`.',
        noDocsRoot,
      ),
    ).toEqual([
      {
        file: 'docs/agents/alpha.md',
        line: 1,
        kind: 'commit',
        text: 'erclx/canon@5653721',
        selfCitation: true,
      },
    ])
  })

  it('should pass a Tailwind arbitrary hex color, which an unbounded pattern reads as #316', () => {
    expect(
      referencesIn(
        'governance/rules/framework/250-tailwind.md',
        '- Use arbitrary values (`bg-[#316ff6]`) instead.',
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should pass a hex color long enough to reach the sha floor', () => {
    expect(
      referencesIn(
        'standards/design.md',
        'as in `` `#ffffff ? verify` ``',
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should pass a sha embedded in a path segment', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        'Written to `.canon/review/6c273324/report.md`.',
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should report every token on a line rather than the line once', () => {
    const found = referencesIn(
      'claude/skills/role-orchestrator/references/orchestrator-poll.md',
      'Measured on `#1299`, where a pass written against `5653721` landed stamped `a5ceb40`.',
      noDocsRoot,
    )

    expect(found.map((reference) => reference.text)).toEqual([
      '#1299',
      '5653721',
      'a5ceb40',
    ])
  })

  it('should mute a reference marked on its own line', () => {
    expect(
      referencesIn(
        'standards/publish.md',
        `Write \`#123\` there. <!-- ${REFERENCE_MARKER}: illustrates the form this section defines -->`,
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should mute a reference marked on the line above', () => {
    expect(
      referencesIn(
        'standards/diagrams.md',
        `<!-- ${REFERENCE_MARKER}: illustrates the verified field's format -->\nas in \`73e9a3f8 2026-08-02\`.`,
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should mute a same-repository illustration of a date-exclusion clause', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        `Runs on \`erclx/canon#632\` and \`erclx/canon#634\` landed 2026-08-02. <!-- ${REFERENCE_MARKER}: illustrates the input shape the rule reads -->`,
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should mute a same-repository illustration of a definition-versus-edit-target bullet', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        `A bullet can cite where something is defined while claiming an edit somewhere else, as \`erclx/canon#1274\` does. <!-- ${REFERENCE_MARKER}: illustrates the input shape the rule reads -->`,
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should ignore a bare marker token carrying no reason', () => {
    expect(
      referencesIn(
        'standards/publish.md',
        `Write \`#123\` there. <!-- ${REFERENCE_MARKER} -->`,
        noDocsRoot,
      ),
    ).toHaveLength(1)
  })

  it('should report nothing in prose carrying no reference', () => {
    expect(
      referencesIn(
        'docs/agents/alpha.md',
        'The count reads low, and it errs.',
        noDocsRoot,
      ),
    ).toEqual([])
  })

  it('should carry the one-based line a reader clicks', () => {
    const found = referencesIn(
      'docs/agents/alpha.md',
      'first\nsecond\nsee `#516`',
      noDocsRoot,
    )

    expect(found[0]?.line).toBe(3)
  })

  describe('DOCS_PATH', () => {
    let root: string

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'canon-references-'))
      const real = join(root, 'docs/agents/real.md')
      mkdirSync(dirname(real), { recursive: true })
      writeFileSync(real, 'placeholder\n')
    })

    afterEach(() => {
      rmSync(root, { recursive: true, force: true })
    })

    it('should report a docs path that resolves against the checkout', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          'Read `docs/agents/real.md` for the reference shape.',
          root,
        ),
      ).toEqual([
        {
          file: 'claude/skills/alpha/SKILL.md',
          line: 1,
          kind: 'docs-path',
          text: 'docs/agents/real.md',
        },
      ])
    })

    it("should pass a docs path that names a target's own tree rather than this checkout's", () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          'Write the fixture to `docs/retry.md`.',
          root,
        ),
      ).toEqual([])
    })

    it('should pass a resolving docs path cited from inside the docs/ corpus itself', () => {
      expect(
        referencesIn(
          'docs/agents/rule-citations.md',
          'See `docs/agents/real.md` for the shape a citation takes.',
          root,
        ),
      ).toEqual([])
    })

    it('should mute a resolving docs path marked as deliberate', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          `Read \`docs/agents/real.md\` for the reference shape. <!-- ${REFERENCE_MARKER}: illustrates the resolving form -->`,
          root,
        ),
      ).toEqual([])
    })

    it('should pass a bracketed docs path illustrating a placeholder shape', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          'Read `docs/<domain>.md` for the reference shape.',
          root,
        ),
      ).toEqual([])
    })
  })

  describe('STANDARDS_PATH', () => {
    let root: string

    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), 'canon-references-standards-'))
      const real = join(root, 'standards/tasks.md')
      mkdirSync(dirname(real), { recursive: true })
      writeFileSync(real, 'placeholder\n')
    })

    afterEach(() => {
      rmSync(root, { recursive: true, force: true })
    })

    it('should report a bare standards/ path that resolves against the checkout', () => {
      expect(
        referencesIn(
          'claude/skills/role-orchestrator/references/orchestrator-parked.md',
          'since `standards/tasks.md` fixes that file as unordered',
          root,
        ),
      ).toEqual([
        {
          file: 'claude/skills/role-orchestrator/references/orchestrator-parked.md',
          line: 1,
          kind: 'standards-path',
          text: 'standards/tasks.md',
        },
      ])
    })

    it('should pass a standards/ path illustrating a placeholder shape, which resolves nowhere', () => {
      expect(
        referencesIn(
          'claude/skills/create-standard/SKILL.md',
          'Write the file to `standards/<slug>.md`, creating the folder when it is absent.',
          root,
        ),
      ).toEqual([])
    })

    it('should report a bare standards/ path that resolves nowhere, since only shape mutes it now', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          'Read `standards/does-not-exist-xyz.md` for the shape.',
          root,
        ),
      ).toEqual([
        {
          file: 'claude/skills/alpha/SKILL.md',
          line: 1,
          kind: 'standards-path',
          text: 'standards/does-not-exist-xyz.md',
        },
      ])
    })

    it('should pass the resolving ${CLAUDE_SKILL_DIR} form the layout standard requires', () => {
      expect(
        referencesIn(
          'claude/skills/role-orchestrator/references/orchestrator-parked.md',
          'since `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` fixes that file as unordered',
          root,
        ),
      ).toEqual([])
    })

    it('should pass a bare standards/ path cited from the docs/ corpus, which resolves there without a skill context', () => {
      expect(
        referencesIn(
          'docs/agents/tasks.md',
          'Read `standards/tasks.md` for the frontmatter contract.',
          root,
        ),
      ).toEqual([])
    })

    it("should pass a bare standards/ path cited from a skill's own REQUIREMENT.md, which a maintainer reads rather than a session", () => {
      expect(
        referencesIn(
          'claude/skills/task-board/REQUIREMENT.md',
          'Read `standards/tasks.md` before writing a case.',
          root,
        ),
      ).toEqual([])
    })

    it('should mute a bare standards/ path marked as deliberate', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          `Read \`standards/tasks.md\` for the shape. <!-- ${REFERENCE_MARKER}: illustrates the bare form the rule bans -->`,
          root,
        ),
      ).toEqual([])
    })
  })

  describe('RULE_PATH', () => {
    let root: string

    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'canon-references-rule-'))
    })

    afterAll(() => {
      rmSync(root, { recursive: true, force: true })
    })

    it('should report a rule path that resolves against the checkout', () => {
      expect(
        referencesIn(
          'claude/skills/draft-and-pick/SKILL.md',
          "Write scratch to `.claude/rules/canon/core/055-scratch.md`'s location.",
          root,
        ),
      ).toEqual([
        {
          file: 'claude/skills/draft-and-pick/SKILL.md',
          line: 1,
          kind: 'rule-path',
          text: '.claude/rules/canon/core/055-scratch.md',
        },
      ])
    })

    it('should pass a rule path illustrating a placeholder shape', () => {
      expect(
        referencesIn(
          'claude/skills/create-standard/SKILL.md',
          'Repoint the citation at `.claude/rules/canon/core/<n>-<slug>.md`.',
          root,
        ),
      ).toEqual([])
    })

    it("should pass a rule path cited from a skill's own REQUIREMENT.md, which a maintainer reads rather than a session", () => {
      expect(
        referencesIn(
          'claude/skills/task-board/REQUIREMENT.md',
          'See `.claude/rules/canon/core/035-tasks.md` for the file shape.',
          root,
        ),
      ).toEqual([])
    })

    it('should mute a rule path marked as deliberate', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          `See \`.claude/rules/canon/core/055-scratch.md\` for the shape. <!-- ${REFERENCE_MARKER}: illustrates the bare form the rule bans -->`,
          root,
        ),
      ).toEqual([])
    })
  })

  describe('PHASE_LABEL', () => {
    let root: string

    beforeAll(() => {
      root = mkdtempSync(join(tmpdir(), 'canon-references-phase-'))
    })

    afterAll(() => {
      rmSync(root, { recursive: true, force: true })
    })

    it('should report a bare phase-label-shaped token', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          'Named the task `v28.1-trigger-escalation` for tracking.',
          root,
        ),
      ).toEqual([
        {
          file: 'claude/skills/alpha/SKILL.md',
          line: 1,
          kind: 'phase-label',
          text: 'v28.1',
        },
      ])
    })

    it('should pass a bare major version with no decimal group', () => {
      expect(
        referencesIn(
          'claude/skills/alpha/SKILL.md',
          'Inserting a half-step between two existing labels (a `v1.5` between `v1` and `v2`) is fine.',
          root,
        ),
      ).toEqual([
        {
          file: 'claude/skills/alpha/SKILL.md',
          line: 1,
          kind: 'phase-label',
          text: 'v1.5',
        },
      ])
    })

    it('should pass a three-group semver tag, which a two-group phase label never carries', () => {
      expect(
        referencesIn(
          'docs/agents/comments.md',
          'canon comments scan --since v0.5.0',
          root,
        ),
      ).toEqual([])
    })

    it('should mute a phase-label-shaped token marked as an illustration', () => {
      expect(
        referencesIn(
          'standards/versioning.md',
          `Inserting a half-step between two existing labels (a \`v1.5\` between \`v1\` and \`v2\`) is fine. <!-- ${REFERENCE_MARKER}: illustrates the renumbering rule's own format -->`,
          root,
        ),
      ).toEqual([])
    })
  })
})

describe('isShippedCorpus', () => {
  it.each(SHIPPED_CORPORA)('should include %s', (corpus) => {
    expect(isShippedCorpus(`${corpus}/alpha.md`)).toBe(true)
  })

  it('should exclude a tree the files field negates', () => {
    expect(isShippedCorpus('scripts/sandbox/claude/review.sh')).toBe(false)
    expect(isShippedCorpus('scripts/eval/run.sh')).toBe(false)
  })

  it('should exclude a test file, which no tarball carries', () => {
    expect(isShippedCorpus('scripts/lib/worktree.test.ts')).toBe(false)
  })

  it('should exclude a corpus whose reader already holds this repository', () => {
    expect(isShippedCorpus('canon/context/development/gates.md')).toBe(false)
    expect(
      isShippedCorpus('internal/rules/claude/598-authoring-layout.md'),
    ).toBe(false)
    expect(isShippedCorpus('wiki/claude/claude-worktrees.md')).toBe(false)
    expect(isShippedCorpus('src/design/base.css')).toBe(false)
  })

  it('should not match a corpus name as a bare prefix of another path', () => {
    expect(isShippedCorpus('docs-site/alpha.md')).toBe(false)
    expect(isShippedCorpus('standards-archive/alpha.md')).toBe(false)
  })
})
