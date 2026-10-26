import { defineRenameRules, type RenameRules } from '@/migrate/rename'

/**
 * The twenty-five shipped skills that carried a `claude-` prefix, and the
 * two-word name each takes instead, plus the four that carried a `canon-`
 * prefix naming a subject other than the toolkit itself.
 *
 * The plugin namespace already resolves every one of them as `canon:<name>`,
 * so the prefix bought grouping rather than uniqueness, and the grouping it
 * bought was the wrong axis: it marked which surface a skill reads rather than
 * what the skill does. The prefixes that replace it name a phase or a role, so
 * a listing groups the review triple, the three planning skills, and the three
 * session roles together.
 *
 * The four `canon-` rows split the same way rather than sharing one
 * replacement prefix. `canon-screencast` and `canon-slides-draft` each make
 * an artifact, so each takes the verb-first name of what it makes,
 * `script-screencast` and `make-deck`. `canon-record` and `canon-frames-read`
 * take `record-screencast` and `read-frames`, reading in sequence with
 * `script-screencast` as one three-step pipeline with no prefix forcing that
 * reading.
 *
 * Two rows rename a skill rather than retiring a prefix. `ui-test` became
 * `ui-checklist` when the skill stopped writing tests and shrank to the
 * checklist a reviewer reads, so the old name described a job it no longer
 * does. `claude-ui-test` is retargeted onto the same destination rather than
 * left pointing at the retired name, which lands a target on the oldest
 * spelling in one pass instead of two.
 *
 * `docs-fold` became `context-fold` because the skill folds a session into the
 * context entries, the canonical records, and the task board, while "docs" in
 * its name collided with `docs-sync`, which owns `docs/`. `claude-docs` is
 * retargeted onto `context-fold` for the same reason `claude-ui-test` was.
 *
 * Five rows merge skills rather than rename one. `draft-docs`,
 * `draft-context`, `draft-wireframes`, `draft-readme`, and `draft-wiki` ran
 * one procedure five times over, differing only in the standard each read and
 * the catalog each checked, so they became one skill, which picks the kind
 * from where the document lands. Every retired name lands on that skill, so a
 * target citing any of them resolves after a single sweep.
 *
 * `draft-diagram` merged into the figure skill the same way, its architecture
 * views becoming one reference the figure skill reads. `claude-diagram` is
 * retargeted onto the figure skill rather than left on a retired name, for the
 * same reason `claude-ui-test` was.
 *
 * The `draft-` family then dissolved. Its seven members shared a verb rather
 * than a phase or a role, so the prefix grouped a deck, a figure, a brand
 * identity, a pick loop, and a thin plan under one word that said nothing
 * about which of them a skill makes. Each took a verb-first name for its
 * output instead: `write-doc`, `draw-figure`, `design-identity`, `make-deck`,
 * `pick-by-eye`, `plan-ready`, and `script-screencast`. Every older key that
 * landed on a `draft-` name is retargeted straight onto its new one, so a
 * target on the oldest spelling lands in one pass rather than two.
 * `draft-ready` alone keys on its namespaced forms below rather than here.
 *
 * Four skills then moved into the family their job belongs to. `pick-by-eye`
 * was the one step of the design flow without the `design-` prefix, so it
 * became `design-pick`. `ui-record` filmed footage while "record" already
 * named the design record, so it became `ui-film`. `ux-audit` and
 * `ux-measure` were the only `ux-` skills beside the `ui-` ones, so they
 * became `ui-audit` and `ui-measure`. `draft-and-pick`, `claude-ux-audit`,
 * and `claude-ux-measure` are retargeted onto the new names for the same
 * reason `claude-ui-test` was.
 *
 * Every name takes two words. Ten of these would have landed as a bare single
 * word under a plain strip, and a bare word such as `review` or `docs` is a
 * substring of ordinary prose with no token left for a later sweep to find.
 *
 * No bare single-word name may ever join this map, whatever prefix it would
 * otherwise take. `wholeToken: true` below matches a standalone word rather
 * than a namespaced compound, so a one-word key rewrites every unrelated use
 * of that word too. `identity` proved it: a dry run against a fifth row
 * reading `'identity': 'draft-identity'` reported 112 occurrences across 43
 * files, most of them a variable, field, or type name spelling the bare word
 * rather than the skill, including `readonly identity: SelfIdentity` at
 * `src/sessions/resolve.ts:255`, which the rewrite would have turned into
 * invalid TypeScript. The row was never added.
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
 * The skills that took a two-word name from a single word, which the map above
 * may not carry as a bare key.
 *
 * `canvas` became `canvas-board`, and a bare `canvas` key would rewrite every
 * unrelated use of the word: `canon canvas serve`, `src/canvas/`,
 * `.canon/canvas/`, and the `internal-canvas` skill. So each row keys on a form
 * only the skill spells, a plugin invocation or a skill folder path. The tail
 * guard rejects a following `-`, so a rewritten `canon:canvas-board` is not
 * matched again.
 *
 * `draft-ready` became `plan-ready` and takes the same treatment for a
 * different reason. It is two words, but they are ordinary prose for a pull
 * request moving from draft to ready, and the sweep takes no scope in a
 * target, so a bare key would rewrite that sentence in every tracked file a
 * project wrote.
 *
 * What this leaves behind is a prose mention of the skill by its bare name,
 * which has no token for a sweep to find and is fixed by hand.
 */
export const SKILL_CITATION_MAP: Readonly<Record<string, string>> = {
  'canon:canvas': 'canon:canvas-board',
  'skills/canvas': 'skills/canvas-board',
  'canon:draft-ready': 'canon:plan-ready',
  'skills/draft-ready': 'skills/plan-ready',
}

/**
 * The old `draft-` names that still answer as a pointer skill, each naming the
 * skill it became.
 *
 * Each pointer's own files spell the old name on purpose, so the sweep must
 * never reach them. A later run would otherwise move the stub onto the real
 * body at the new name. Their paths join the exclusions only once the sweep
 * that moved the real bodies has run, since excluding them first leaves each
 * body unmoved at its old path.
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
 * The skill rename.
 *
 * It protects nothing. The `aitk` sweep had to guard a sibling repository
 * whose name contained the token, and no string here contains a skill name
 * while meaning something else. Two rows overlap another row: `claude-intake`
 * inside `claude-intake-answer`, and `ui-test` inside `claude-ui-test`. The
 * longest-first ordering settles both rather than a protected form. Reading
 * either off the output would report a pass anyway, since each pair lands on
 * one destination, so the ordering is asserted directly.
 *
 * It matches whole tokens. A skill name is a complete name rather than a word
 * stem, and a word can open with a name and mean something else: a filename
 * such as `claude-worktrees.md` names the harness feature, not the skill, and
 * a stem matching by prefix would move it to a name that no longer describes
 * what the file documents.
 *
 * No article fixup travels with it. `auto-ship` is the one destination opening
 * on a vowel sound, and the corpus spells an article before it once, which is
 * cheaper to repair by hand than to state as a rule the rest of the map never
 * fires.
 *
 * The map's own module and its test state the rename rather than using the old
 * names, so a sweep over them turns each key into its own replacement and
 * leaves a rewriter that matches nothing. The changelog and an eval transcript
 * are excluded on the argument the `aitk` preset already carries: each records
 * what shipped or what a session ran under whatever name was current then, so
 * rewriting one makes it testify to a release or a run that never happened.
 *
 * A replay fixture is excluded on the same argument. It records a real
 * project's tree as that project held it, so a rewrite changes what the replay
 * proves.
 *
 * The record archives need no entry here. They are gitignored, so the tracked
 * listing every sweep reads never reaches them.
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
