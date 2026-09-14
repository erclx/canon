---
title: Citations
description: Verdict for every rule and standard citing a skill or a sibling document, the two forms that resolve for a target, the moot exception, and the stage that resolves a cited path and an internal frontmatter glob mechanically with the bounds each carries
---

# Citations

## Overview

Owns whether a citation inside `governance/rules/` or `standards/` resolves for the target holding it, and whether the citing body restates the content it points at rather than pointing at it cleanly. Excludes a `## Scope` "Does not govern:" entry, which names an owner rather than asking a reader to load or follow anything, and excludes rule-restates-sibling-rule duplication, which `canon gov restated` covers mechanically.

## The two forms that resolve for a target

- `canon standards <name>` resolves for any target. The verb reads `standards/` at the project root first, then the package corpus, so it needs no fallback behind it. Most citing rules and standards use this form.
- A plugin skill named with the `canon:<skill>` prefix, paired with a line reporting rather than proceeding silently when the skill does not resolve, degrades honestly either way: it loads for a target holding the plugin and names the gap for one holding governance alone.
- A bare skill name carrying neither the prefix nor the fallback line is the defect the two repaired rows below share. It resolves for a plugin-holding target and fails silently for every other one.

## Verdicts

### Rules that point rather than restate

Each rule below cites its standard through `canon standards <name>` alone, keeping only its `Authority` pointer plus any content the standard does not cover. The rule-authoring standard's own scope line settles the shape: a rule points at the standard that owns a convention and never restates it.

- `governance/rules/claude/520-wireframes.md` → `canon standards wireframes`, without restating the ASCII-fence, region-label, copy-verbatim, interaction-intent, or same-PR-update rules.
- `governance/rules/claude/530-requirements.md` → `canon standards requirements`, without restating the goal-as-outcome, non-goal, MVP-lifecycle, later-scope, or `## Distribution` rules.
- `governance/rules/claude/540-architecture.md` → `canon standards architecture`, without restating the decision-H3 or verification-anchor rules.
- `governance/rules/claude/550-design.md` → `canon standards design`, without restating the token-as-intent, no-CSS, table-format, or omission rules.
- `governance/rules/claude/555-tasks.md` → `canon standards tasks`, without restating the origin-line, outcome-sizing, heading, no-implementation-detail, or archiving rules.
- `governance/rules/claude/559-memory.md` → `canon standards memory`, without restating the routing or pen rules.
- `governance/rules/claude/560-diagrams.md` → `canon standards diagrams`, without restating the refresh-only-changed-entries rule, and keeps the `DIAGRAMS.md` migration bullets, which the standard does not state. It also routes at `502-mermaid` rather than citing `mermaid.md` itself, since that rule's own glob already reaches an entry under `.canon/diagrams/`.
- `governance/rules/claude/502-mermaid.md` → `canon standards mermaid`, opening instead on the condition its glob cannot express, since a path match cannot read whether the file holds a fence.
- `governance/rules/claude/562-session.md` → `canon standards session`, without restating the own-file, worktree-root, compaction-only, or citation rules, and keeps the routing bullet pointing at `555-tasks.md`, which the standard does not carry.
- `governance/rules/claude/570-skill.md` → `canon standards skill`, without restating the `REQUIREMENT.md` gap-line rule, and keeps the `create-skill` question bullet and the after-editing bullets, none of which the standard states.
- `governance/rules/claude/580-readme.md` → `canon standards readme`, without restating the audience-and-voice rules.
- `governance/rules/claude/590-rule-authoring.md` → `canon standards rule`, without restating the numbering or body rules.
- `governance/rules/claude/591-standard-authoring.md` → `canon standards standard`, without restating the scope-statement rules.
- `governance/rules/claude/510-context.md` → `canon standards context`, without restating the supersede-in-place rule. Moot for a target holding governance alone, per the row below.
- `governance/rules/claude/556-groundwork.md` → `canon standards groundwork`, without restating the folder-name or measuring-and-closing rules. Moot for the same reason.
- `governance/rules/claude/557-intake.md` → `canon standards intake`, without restating the folder-name or answer-contract rules. Moot for the same reason.
- `governance/rules/claude/561-teach.md` → `canon standards teach`, without restating the workspace-conventions rules. Moot for the same reason.

### Skill citations carrying the prefix and fallback

Every rule and standard below cites its skill with the `canon:` prefix plus a line reporting rather than proceeding silently when the skill does not resolve, which is what keeps the citation resolving honestly for a target holding governance alone.

- `governance/rules/core/045-memory.md` cites `canon:memory-capture` and `canon:docs-fold`, each with a report-if-missing line, and points at its standard through `canon standards memory` rather than a vague sibling-file description.
- `governance/rules/lang/120-bash.md` cites `canon:bash-script` and `canon:bash-cli-script`, each with a report-if-missing line.
- `governance/rules/claude/561-teach.md` and `standards/teach.md` both cite `canon:teach-workspace`, each with its own report-if-missing line, the rule's own and the standard's "say so and stop".
- `governance/rules/claude/570-skill.md` cites `canon:create-skill`, twice, each with a report-if-missing line.
- `standards/markdown.md` cites `canon:write-human` in the sentence explaining why cadence and rhythm are excluded from this file's scope. Unlike the "Does not govern:" bullets the Gotchas section exempts, this sentence sits in ordinary prose describing where a markdown edit routes, so it reads as a citation rather than a boundary statement.

A rule stating a general fact and wanting to point at where the local decision lives has nowhere to point, since a rule ships through `canon gov sync` with no path on the reader's machine resolving to this repository's own context entries. A rule states its facts and names no path instead, leaving the local answer to be reached from the entry rather than from the rule. <!-- audit-ignore-citations: .claude/context/development/hooks.md -->

### Moot: the target cannot reach the governed surface

A rule scoped to a folder only a plugin skill creates is inert rather than broken for a target holding governance alone. The folder never exists there, so the file glob never matches and the citation never fires. No repair applies. The row exists so a later pass does not misread inertness as a defect.

- `governance/rules/claude/510-context.md`, scoped to `canon/context/**`. Nothing but `docs-fold` and `memory-capture` writes an entry there.
- `governance/rules/claude/556-groundwork.md`, scoped to `.canon/groundwork/**`. Nothing but `plan-groundwork` creates a track folder.
- `governance/rules/claude/557-intake.md`, scoped to `.canon/intake/**`. Nothing but `plan-intake` creates a dump folder.
- `governance/rules/claude/561-teach.md`, scoped to `.canon/teach/**`. Nothing but `teach-workspace` creates a workspace.
- `governance/rules/core/025-indexes.md` names both `canon/context/` and `canon/wireframes/` as places to check an index before searching. Only the second is moot. A governance-only target can hand-author a wireframe entry against `standards/wireframes.md` with no plugin skill involved, so that half of the rule is a clean pointer.
- `governance/rules/snippets/600-at-references.md`, an always-on rule with no `paths:` glob, carries no skill or standard citation and states what to do when a snippet is referenced with `@`. Nothing installs `.claude/snippets/` for a governance-only target, so it has no `@`-reference the rule ever fires on. The inertness reasons the same way as the other four rows even though the mechanism differs: theirs is a glob that never matches, this one is a rule that always loads but governs a reference that never appears.

Each of the four entries that point at their standard rather than restating it also carries a moot verdict here, which only matters for the plugin-holding target that can actually reach the folder. The verdict table above reflects that: each of the four is listed both as pointing rather than restating and as moot, since the two verdicts answer different questions about the same file. The fifth row, `600-at-references.md`, carries no standard citation and is listed here for the moot verdict alone.

### Clean pointer, no other note

- `governance/rules/claude/500-prose.md` → the `write-human` skill, named with the fallback line.
- `governance/rules/claude/501-markdown.md` → `canon standards markdown`.
- `standards/skill.md` → several sibling standards by path, all within the flat `standards/` corpus every delivery route carries whole.
- `standards/tasks.md` → `standards/versioning.md` and `standards/plan.md`, same reasoning.

### Standards corpus, examined and excluded

Across the standards corpus, `skill.md` and `tasks.md` carry a genuine sibling-standard citation and sit in the clean-pointer list above. `markdown.md` and `teach.md` sit in the skill-citation list above. The rest, `diagrams.md`, `glossary.md`, `groundwork.md`, `intake.md`, `issue.md`, `memory.md`, `plan.md`, `pr.md`, `publish.md`, `readme.md`, `snippets.md`, `standard.md`, `versioning.md`, and `wireframes.md`, name `write-human` or `markdown.md` only inside a `## Scope` "Does not govern:" bullet, which the Gotchas exclusion below covers, and carry no citation this entry verdicts.

`diagrams.md` and `wireframes.md` each carry one further mention outside that bullet, in a sentence naming a "voice yield" a sibling standard grants the surface. `diagrams.md` says a section "claims the yield the `write-human` skill grants." `wireframes.md` says its Behavior and Copy prose "follows `markdown.md` and the `write-human` skill." Read as describing a cross-standard relationship rather than instructing the reader to load anything, the same reasoning the Gotchas exclusion applies to a "Does not govern:" bullet. `markdown.md`'s repaired sentence reads differently: it states where a markdown edit routes, which is closer to a directive than a boundary description, and that difference is why one got a verdict and the other two did not.

## What the stage resolves and what it cannot

`canon gov citations` resolves every path a rule body cites across `governance/rules/` and `internal/rules/`, plus every frontmatter `paths:` glob under `internal/rules/`, and `bun run check` gates on it as the `Rule citations` stage. The verdicts above stay a manual read: the stage answers whether a citation resolves at all, and nothing here answers whether a resolving citation points at the right file or restates what it points at.

At `2e912110` the corpus holds 36 body citations across 77 rules. Twenty are `canon standards <name>`, fifteen are backticked paths, one names a sibling rule by filename. All 36 resolve or are excused, and all 14 internal globs across 7 rules match, so the gate ships as a floor rather than as a repair.

The glob half reads one corpus. A rule under `governance/rules/` installs into a target and its globs name that project's shape, so 32 of the 72 there match nothing in this tree and every one is correct, `src/pages/**` in the Astro rule being indistinguishable by pattern from a path here. Gating them would ship an exemption list the length of the corpus. `internal/rules/` ships nowhere, which makes the tree it governs the tree present.

What it reads is bounded three ways, and each bound is a shape the corpus already writes.

- A placeholder or glob segment is declined, since it describes a shape rather than naming a file. `standards/<name>.md` and `app/**/route.ts` are the two forms.
- A span carrying no file extension is declined as a folder or a module specifier. This costs one real path, `claude/standards`, which the stage cannot tell from `next/font` by looking at it.
- A path written without backticks is not read at all, since matching one would report every sentence that happens to name a file.
- A glob that matches real files and still reaches none of the work it was scoped at is not read. `lib/305-e2e-reliability.md` scopes itself at `e2e/*.ts` and `e2e/**/*.ts`, and no probe here is written under `e2e/`, so the rule asking a session to watch a new guard fail never fired for the session writing guards. Resolution is mechanical and reach is a judgment about where the work happens.

Two classes resolve to nothing and are correct to, and both are reported by name rather than dropped.

- **Governed.** A path the citing rule spells exactly in its own frontmatter `paths:` names an artifact a target holds rather than a file here. `claude/560-diagrams.md` declares `.claude/DIAGRAMS.md` and then tells its reader to convert one an older install left. Only an exact declaration excuses, never a glob match against one, so a typo under `.canon/diagrams/**` is still a finding.
- **Ignored.** A path git ignores is session scratch no clone holds. `claude/555-tasks.md` cites `.canon/tasks/index.md`, which is real at the main root and absent from a fresh clone and from every linked worktree. Without this the verdict would depend on which tree the stage ran in.

The ignored class is what makes the counts tree-dependent, and the two readings were taken side by side on 2026-08-31 over one corpus and one commit. From the main worktree the run reports 34 resolved and 0 ignored, since the board is there and the path resolves. From a linked worktree it reports 33 and 1. The verdict is the same either way, which is the whole point of the exemption, so a count quoted from one tree names which tree it came from.

A standard name resolves against `standards/` alone, matching `standardRoots` in `src/standards/read.ts`, which reads the working root and then the package corpus. Those are one directory wherever this stage runs, since it refuses a tree holding no rule corpus. `internal/standards/` is not a candidate: `canon standards <name>` never reaches it, so admitting it would pass a citation that refuses for the session opening it. The set it would have covered is empty today, and a gate failing open is worth closing before it is not.

## Gotchas

- A "Does not govern:" line naming a skill or a sibling standard is a scope exclusion, not a citation. `standards/standard.md` requires exactly this shape for every excluded concern, so the many "the `write-human` skill" mentions across the standards corpus carry no verdict here.
- The mechanical duplication sweep behind `canon gov restated` catches a rule restating a sibling rule or `CLAUDE.md`. It does not catch a rule restating the standard it cites, which is this entry's subject and stayed a manual read for that reason.
- `canon gov citations` and `canon gov superseded` read one corpus and answer different questions. The first asks whether a cited path resolves at all, the second whether a citation still names a value a changed convention no longer produces. A citation can pass either and fail the other, so neither folds into the other.
- The consumed-copy drift stage passes an authored rule and its copy that are wrong together, which is how `claude/561-teach.md` shipped a `references/glossary.md` that had never existed. Two files agreeing is not either one being right about the tree.
- A rule can carry both the restated-its-target and the moot verdict at once. Moot says the citation never fires for a target holding governance alone. Restated says the rule's own bullets duplicated its standard regardless. Neither excuses the other.
