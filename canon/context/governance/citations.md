---
title: Citations
description: Verdict for every rule and standard citing a skill or a sibling document, the two forms that resolve for a target, the moot exception, and the stage that resolves a cited path and an internal frontmatter glob mechanically with the bounds each carries
---

# Citations

## Overview

Owns whether a citation inside `governance/rules/` or `standards/` resolves for the target holding it, and whether the citing body restates the content it points at rather than pointing at it cleanly. Excludes a `## Scope` "Does not govern:" entry, which names an owner rather than asking a reader to load anything, and excludes a rule restating a sibling rule, which `canon gov restated` covers mechanically.

## Decisions

### Two forms resolve for a target

- `canon standards <name>` resolves for any target. The verb reads `standards/` at the project root first, then the package corpus, so it needs no fallback behind it. Most citing rules and standards use this form.
- A plugin skill named with the `canon:` prefix, paired with a line reporting rather than proceeding silently when the skill does not resolve, degrades honestly: it loads for a target holding the plugin and names the gap for one holding governance alone.

A bare skill name carrying neither the prefix nor the fallback line resolves for a plugin-holding target and fails silently for every other one, which is the defect both forms exist to close.

### A rule names no path into this repository

A rule stating a general fact has nowhere to point for the local decision, since it ships through `canon gov sync` and no path on a target's machine resolves to this repository's context entries. A rule states its facts and names no path, and the local answer is reached from the entry rather than from the rule.

### What the stage resolves and what it cannot

`canon gov citations` resolves every path a rule body cites across `governance/rules/` and `internal/rules/`, plus every frontmatter `paths:` glob under `internal/rules/`, and `bun run check` gates on it as the `Rule citations` stage. The verdicts below stay a manual read: the stage answers whether a citation resolves, and nothing answers whether a resolving citation points at the right file or restates what it points at.

At `2e912110` the corpus held 36 body citations across 77 rules. Twenty were `canon standards <name>`, fifteen were backticked paths, and one named a sibling rule by filename. All 36 resolved or were excused, and every internal glob matched, so the gate shipped as a floor rather than as a repair.

#### Bounds

The glob half reads one corpus. A rule under `governance/rules/` installs into a target and its globs name that project's shape, so many match nothing in this tree and every one is correct, `src/pages/**` in the Astro rule being indistinguishable by pattern from a path here. Gating them would ship an exemption list the length of the corpus. `internal/rules/` ships nowhere, so the tree it governs is the tree present.

What it reads is bounded four ways, each a shape the corpus already writes:

- A placeholder or glob segment is declined, since it describes a shape rather than naming a file. `standards/<name>.md` and `app/**/route.ts` are the two forms.
- A span carrying no file extension is declined as a folder or a module specifier. This costs one real path, `claude/standards`, which the stage cannot tell from `next/font` by looking at it.
- A path written without backticks is not read, since matching one would report every sentence that names a file.
- A glob that matches real files and still misses the work it was scoped at is not read. `lib/305-e2e-reliability.md` globs `**/e2e/**/*.ts` rather than `e2e/**/*.ts` so it reaches a suite kept under an app folder such as `web/e2e/`. Resolution is mechanical and reach is a judgment about where the work happens.

#### Excused classes

Two classes resolve to nothing and are correct to, and both are reported by name rather than dropped:

- **Governed.** A path the citing rule spells exactly in its own frontmatter `paths:` names an artifact a target holds rather than a file here. `claude/560-diagrams.md` declares `.claude/DIAGRAMS.md` and then tells its reader to convert one an older install left. Only an exact declaration excuses, never a glob match, so a typo under `.canon/diagrams/**` is still a finding.
- **Ignored.** A path git ignores is session scratch no clone holds. `claude/555-tasks.md` cites `.canon/tasks/index.md`, which is real at the main root and absent from a fresh clone and from every linked worktree. Without this the verdict would depend on which tree the stage ran in.

The ignored class makes the counts tree-dependent. From the main worktree that path resolves and the ignored count is zero, and from a linked worktree it is one. The verdict is the same either way, so a count quoted from one tree names which tree it came from.

A standard name resolves against `standards/` alone, matching `standardRoots` in `src/standards/read.ts`, which reads the working root and then the package corpus. `internal/standards/` is not a candidate, since `canon standards <name>` never reaches it and admitting it would pass a citation that refuses for the session opening it.

## Gotchas

- A "Does not govern:" line naming a skill or a sibling standard is a scope exclusion, not a citation. `standards/standard.md` requires that shape for every excluded concern, so the many `write-human` mentions across the standards corpus carry no verdict here.
- `canon gov restated` catches a rule restating a sibling rule or `CLAUDE.md`. It does not catch a rule restating the standard it cites, which is this entry's subject and stays a manual read.
- `canon gov citations` and `canon gov superseded` read one corpus and answer different questions. The first asks whether a cited path resolves, the second whether a citation still names a value a changed convention no longer produces. A citation can pass either and fail the other.
- The Consumed copies stage passes an authored rule and its copy that are wrong together, which is how `claude/561-teach.md` shipped a `references/glossary.md` that did not exist. Two files agreeing is not either one being right about the tree.
- A rule can carry both the restated and the moot verdict. Moot says the citation never fires for a target holding governance alone, and restated says the rule duplicated its standard regardless. Neither excuses the other.

## Verdicts

### Rules that point rather than restate

Each rule below cites its standard through `canon standards <name>` alone, keeping its `Authority` pointer plus any content the standard does not cover. `standards/rule.md` settles the shape: a rule points at the standard that owns a convention and never restates it.

- `governance/rules/claude/520-wireframes.md` → `canon standards wireframes`, without restating the ASCII-fence, region-label, copy-verbatim, interaction-intent, or same-PR-update rules.
- `governance/rules/claude/530-requirements.md` → `canon standards requirements`, without restating the goal-as-outcome, non-goal, MVP-lifecycle, later-scope, or `## Distribution` rules.
- `governance/rules/claude/540-architecture.md` → `canon standards architecture`, without restating the decision-H3 or verification-anchor rules.
- `governance/rules/claude/550-design.md` → `canon standards design`, without restating the token-as-intent, no-CSS, table-format, or omission rules.
- `governance/rules/claude/555-tasks.md` → `canon standards tasks`, without restating the origin-line, outcome-sizing, heading, no-implementation-detail, or archiving rules.
- `governance/rules/claude/559-memory.md` → `canon standards memory`, without restating the routing or pen rules.
- `governance/rules/claude/560-diagrams.md` → `canon standards diagrams`, without restating the refresh-only-changed-entries rule, and keeps the `DIAGRAMS.md` migration bullets the standard does not state. It routes at `502-mermaid` rather than citing `mermaid.md`, since that rule's own glob already reaches an entry under `.canon/diagrams/`.
- `governance/rules/claude/502-mermaid.md` → `canon standards mermaid`, opening on the condition its glob cannot express, since a path match cannot read whether the file holds a fence.
- `governance/rules/claude/562-session.md` → `canon standards session`, without restating the own-file, worktree-root, compaction-only, or citation rules, and keeps the routing bullet pointing at `555-tasks.md`.
- `governance/rules/claude/563-ready.md` → `canon standards ready`, without restating the folder-name, overview-frontmatter, mirrored-tree, or thin-plan rules. Not moot: no plugin skill creates the folder, so a governance-only target reaches it by hand-authoring against the standard.
- `governance/rules/claude/570-skill.md` → `canon standards skill` and `canon standards skill-requirement`, without restating the `REQUIREMENT.md` gap-line rule, and keeps the `create-skill` question bullet and the after-editing bullets.
- `governance/rules/claude/580-readme.md` → `canon standards readme`, without restating the audience-and-voice rules.
- `governance/rules/claude/590-rule-authoring.md` → `canon standards rule`, without restating the numbering or body rules.
- `governance/rules/claude/591-standard-authoring.md` → `canon standards standard`, without restating the scope-statement rules.
- `governance/rules/claude/510-context.md` → `canon standards context`, without restating the supersede-in-place rule. Also moot.
- `governance/rules/claude/556-groundwork.md` → `canon standards groundwork`, without restating the folder-name or measuring-and-closing rules. Also moot.
- `governance/rules/claude/557-intake.md` → `canon standards intake`, without restating the folder-name or answer-contract rules. Also moot.
- `governance/rules/claude/561-teach.md` → `canon standards teach`, without restating the workspace-conventions rules. Also moot.

### Skill citations carrying the prefix and fallback

Each rule and standard below cites its skill with the `canon:` prefix plus a report-if-missing line.

- `governance/rules/core/045-memory.md` cites `canon:memory-capture` and `canon:context-fold`, and leaves the pointer at its standard to `559-memory.md`.
- `governance/rules/lang/120-bash.md` cites `canon:bash-script` and `canon:bash-cli-script`.
- `governance/rules/claude/561-teach.md` and `standards/teach.md` both cite `canon:teach-workspace`, the standard's fallback reading "say so and stop".
- `governance/rules/claude/570-skill.md` cites `canon:create-skill` twice.
- `standards/markdown.md` cites `canon:write-human` in ordinary prose stating where a markdown edit routes, which reads as a directive rather than as a scope boundary.

### Moot: the target cannot reach the governed surface

A rule scoped to a folder only a plugin skill creates is inert rather than broken for a target holding governance alone. The folder never exists there, so the glob never matches and the citation never fires. No repair applies, and the row keeps a later pass from misreading inertness as a defect.

- `governance/rules/claude/510-context.md`, scoped to `canon/context/**`. Only `context-fold` and `memory-capture` write an entry there.
- `governance/rules/claude/556-groundwork.md`, scoped to `.canon/groundwork/**`. Only `plan-groundwork` creates a track folder.
- `governance/rules/claude/557-intake.md`, scoped to `.canon/intake/**`. Only `plan-intake` creates a dump folder.
- `governance/rules/claude/561-teach.md`, scoped to `.canon/teach/**`. Only `teach-workspace` creates a workspace.
- `governance/rules/core/025-indexes.md` names `canon/context/` and `canon/wireframes/`. Only the first is moot, since a governance-only target can hand-author a wireframe against `standards/wireframes.md`.
- `governance/rules/snippets/600-at-references.md` always loads and carries no citation, but nothing installs `.claude/snippets/` for a governance-only target, so the `@`-reference it governs never appears.

### Clean pointer, no other note

- `governance/rules/claude/500-prose.md` → the `write-human` skill, named with the fallback line.
- `governance/rules/claude/501-markdown.md` → `canon standards markdown`.
- `standards/skill.md` → several sibling standards by path, all within the flat `standards/` corpus every delivery route carries whole.
- `standards/tasks.md` → `standards/versioning.md` and `standards/plan.md`, for the same reason.

### Standards corpus, examined and excluded

Every other standard names `write-human` or `markdown.md` only inside a "Does not govern:" bullet and carries no citation this entry verdicts. `diagrams.md` and `wireframes.md` each carry one further mention, a sentence naming the voice yield a sibling standard grants the surface. That sentence describes a cross-standard relationship rather than instructing the reader to load anything, which is why it takes no verdict while `markdown.md`'s routing sentence does.
