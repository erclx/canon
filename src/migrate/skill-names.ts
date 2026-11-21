import { defineRenameRules, type RenameRules } from '@/migrate/rename'

/**
 * Each retired skill name and the name it takes now, pointing straight at the current one.
 * Every destination takes two words, and no bare single-word key may join, since
 * `wholeToken: true` would rewrite every variable spelling that word.
 */
export const SKILL_NAME_MAP: Readonly<Record<string, string>> = {
  'claude-address-review': 'review-address',
  'claude-autoship': 'auto-ship',
  'claude-design-extract': 'design-extract',
  'claude-diagram': 'draw-figure',
  'claude-docs': 'context-fold',
  'docs-fold': 'context-fold',
  'claude-feature': 'plan-feature',
  'claude-groundwork': 'plan-groundwork',
  'claude-intake': 'plan-intake',
  'claude-intake-answer': 'plan-intake-answer',
  'claude-markdown-propose': 'markdown-propose',
  'claude-memory-capture': 'memory-capture',
  'claude-memory-review': 'memory-review',
  'claude-orchestrate': 'role-orchestrator',
  'claude-planner': 'role-planner',
  'claude-pr-review': 'review-pr',
  'claude-review': 'review-branch',
  'claude-seed-sync': 'seed-sync',
  'claude-standards-audit': 'standards-audit',
  'claude-tasks': 'task-board',
  'claude-teach': 'teach-workspace',
  'claude-ui-test': 'ui-checklist',
  'ui-test': 'ui-checklist',
  'claude-ux-audit': 'ui-audit',
  'claude-ux-measure': 'ui-measure',
  'ux-audit': 'ui-audit',
  'ux-measure': 'ui-measure',
  'claude-worker': 'role-worker',
  'claude-worktree': 'session-worktree',
  'canon-screencast': 'script-screencast',
  'canon-slides-draft': 'make-deck',
  'canon-record': 'record-screencast',
  'canon-frames-read': 'read-frames',
  'draft-docs': 'write-doc',
  'draft-context': 'write-doc',
  'draft-wireframes': 'write-doc',
  'draft-readme': 'write-doc',
  'draft-wiki': 'write-doc',
  'draft-diagram': 'draw-figure',
  'draft-doc': 'write-doc',
  'draft-figure': 'draw-figure',
  'draft-identity': 'design-identity',
  'draft-slides': 'make-deck',
  'draft-and-pick': 'design-pick',
  'draft-screencast': 'script-screencast',
  'pick-by-eye': 'design-pick',
  'ui-record': 'ui-film',
}

/**
 * The skills that took a two-word name from a single word or from ordinary prose. Each row
 * keys on a form only the skill spells, and the tail guard rejects a following `-`. A prose
 * mention by bare name has no token for a sweep and is fixed by hand.
 */
export const SKILL_CITATION_MAP: Readonly<Record<string, string>> = {
  'canon:canvas': 'canon:canvas-board',
  'skills/canvas': 'skills/canvas-board',
  'canon:draft-ready': 'canon:plan-ready',
  'skills/draft-ready': 'skills/plan-ready',
}

/**
 * The old `draft-` names that still answer as a pointer skill, each naming the skill it
 * became. Their files spell the old name on purpose, and join the exclusions only once the
 * sweep that moved the real bodies has run.
 */
export const RENAMED_DRAFT_POINTERS: readonly string[] = [
  'draft-doc',
  'draft-figure',
  'draft-identity',
  'draft-slides',
  'draft-and-pick',
  'draft-ready',
  'draft-screencast',
]

/**
 * The skill rename. It matches whole tokens, since a word can open with a skill name,
 * and overlapping keys settle by longest-first. The map's own module and test are excluded,
 * and so are the records that name what ran under the name current then.
 */
export const SKILL_NAME_RULES: RenameRules = defineRenameRules({
  replacements: { ...SKILL_NAME_MAP, ...SKILL_CITATION_MAP },
  keepMarker: 'canon-keep-retired',
  wholeToken: true,
  excludedPrefixes: ['scripts/eval/result-', 'sandbox/fixtures/replay/'],
  excludedPaths: [
    'CHANGELOG.md',
    'src/migrate/skill-names.ts',
    'src/migrate/skill-names.test.ts',
    ...RENAMED_DRAFT_POINTERS.flatMap((name) => [
      `claude/skills/${name}/SKILL.md`,
      `claude/skills/${name}/REQUIREMENT.md`,
    ]),
  ],
})
