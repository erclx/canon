---
name: docs-fold
description: Updates `.claude/` planning docs to reflect decisions made during the session, marks outcomes the diff shipped `[x]`, and archives the plans those tasks cite. Use when asked to "sync the .claude docs", when design or requirements changed mid-cycle, after discussing a pivot, or before shipping. Do NOT use to create a task file or move one out of the live folder. That is `task-board`.
---

# Docs fold

## Guards

- If no `.claude/` directory exists, stop: `❌ No .claude/ directory found. Run canon claude init to set up the workflow.`

The skip for a session that changed nothing lives at the end of Step 2, because it needs the diff to decide. It drops the doc rewrite alone. The diff-driven sweeps in Steps 4 and 5 still run.

## Diff baseline

Steps 2, 4, 5, and 7 share one diff on the usable path. An unusable baseline splits them, per the rule below. Resolve the base ref once and reuse it:

```bash
git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null
```

Take the union of `git diff --name-only <base> HEAD`, `git diff --name-only HEAD`, and `git ls-files --others --exclude-standard`. Read content with `git diff <base> HEAD` and `git diff HEAD`.

Prefer `origin/main` over local `main`. On `main` itself the local ref resolves to HEAD, so every committed change drops out of the set and the skill goes blind to the work it is meant to read.

The baseline is unusable when no merge base resolves against either ref, or when the base came from local `main` and equals HEAD. On an unusable baseline, read `${CLAUDE_SKILL_DIR}/references/unusable-baseline.md` before Step 2 for what each step reads instead.

## Step 1: read current docs

Read these in parallel from the current worktree root (`pwd`), not the main worktree root. These are tracked files and edits must commit with the branch. A project the surface move has not reached holds each of them under `.claude/` rather than `canon/`, so read and write each at whichever root already carries it. Skip any that exist at neither:

- `canon/REQUIREMENTS.md`
- `canon/ARCHITECTURE.md`
- `canon/DESIGN.md`
- `canon/wireframes/index.md` and every surface file it links to, following a grouped surface's own `index.md` and the siblings it lists rather than stopping at the top-level folder

Read the task board from the main worktree root instead, resolving that root the way `session-worktree` does. It is gitignored scratch and never commits with the branch:

- `.canon/tasks/index.md` first, then the task files this session touched. That narrow read serves the marking step, which is the only step here that opens a task file.

## Step 2: identify what changed

Two sources feed this step. The session carries judgments no diff can show. The diff carries facts about the repository the session may never have mentioned.

Review the session for decisions that diverged from the original plan:

- Requirements added, removed, or changed scope
- Architecture or technical decisions made or revised
- Design or UX decisions that differ from DESIGN.md or any wireframe surface file, flat or nested under its own subfolder
- Tasks blocked or newly identified

Then resolve the diff baseline and match it against the board. From `.canon/tasks/index.md` at the main worktree root, pick the task files whose title or description relates to the changed paths and read the ones Step 1 skipped.

Path matching only chooses which files to open. Behavior decides each outcome. For each unchecked outcome, decide whether the diff shipped the behavior that outcome names.

Completion is the one judgment here that is a fact about the repository rather than a fact about the conversation, so the diff decides it and the session does not. Requirements, architecture, and design stay session-sourced.

Keep the match conservative:

- Mark only outcomes already written on the board. Never infer a new task from the diff.
- Match on the behavior an outcome describes, not on filenames or commit subjects. The path match above only narrowed which task files to open.
- Leave an outcome `[ ]` when the diff is ambiguous. An unmarked shipped outcome costs one manual edit, while a wrongly marked one hides work that never happened.

Skip Step 3 when the session shows no divergence **and** the diff matches no queued outcome, reporting `✅ No doc updates needed. Session matched the original plan.` Both conditions have to hold. Shipping a queued task exactly as planned is the ordinary case and it reads as no divergence, so a session-only skip would drop the marking step with it.

Then run Steps 4 through 9. Step 3 is the only one this skips, because it is the only one driven by the session rather than by the diff or the board. A project with an empty task board making a mechanical change satisfies both conditions above, and stopping here would put an uncovered surface out of reach in every such project.

This changes which steps the skill reaches and never widens what any of them reads. Steps 4, 5, and 7 still take the same scoped set the Diff baseline section defines.

## Step 3: update

For each doc with relevant changes, apply updates following these rules. Read a standard this skill names, here or in a later step, from `${CLAUDE_SKILL_DIR}/../../standards/` when the project does not have it.

**`.canon/tasks/`**

- Mark completed outcomes `[x]` in the task's own file through `canon tasks outcome <stem> --close <n> --json`, repeating `--close` for each. Positions count every outcome checkbox in file order from 1, which the read above already gives. Do not move or archive the file.
- Write a newly identified task as its own file, following `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` for the filename and frontmatter.
- Do not touch task files this session did not change.
- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it.

The verb resolves the board at the main worktree root in-process, which is the route `session-worktree` states for an edit inside an existing main-root file.

Read `ok` and `reason` out of that record rather than the exit. An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command and takes the second status, which flattens every non-zero exit to zero. A refusal arriving as success leaves the outcome unmarked while the chain moves on, so the board reports shipped work as open and the next session re-plans it.

**REQUIREMENTS.md, ARCHITECTURE.md, DESIGN.md, a wireframe surface file (flat or nested)**

- Update only the sections affected by session decisions.
- Do not rewrite sections unrelated to what changed.
- Rewrite a restated or superseded statement in place rather than appending the replacement beside it. State the fact that stands and keep the earlier reasoning only where it is the alternative that lost, per `${CLAUDE_SKILL_DIR}/../../standards/context.md` and `${CLAUDE_SKILL_DIR}/../../standards/architecture.md`.
- Follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` and the `write-human` skill for all edits.
- Write a session decision into the `canon/context/` entry for the domain it constrains, under that entry's `## Decisions`, by default. Touch `canon/ARCHITECTURE.md` only for a decision that fills one of the slots `${CLAUDE_SKILL_DIR}/../../standards/architecture.md` names, however many domains its reasoning reaches.
- Read the entry cap the record states before adding a decision to it. At the cap, merge two decisions or retire one to the domain entry it constrains, and name which in the report. Never compress a decision's prose to fit, and never pack two decisions under one heading.
- Close a decision entry in `canon/ARCHITECTURE.md` with its verification anchor whenever this run writes that entry or amends its reasoning and that reasoning cites a measured number. Re-read the number against the tree first, since the marker records the read rather than the edit. `${CLAUDE_SKILL_DIR}/../../standards/architecture.md` fixes the sentence.
- Leave every decision entry this run did not write alone, anchored or not. The rule is scoped forward, so an entry written before it is dated by blame rather than by a read. Step 5 reports a stale anchor and no step writes one on an entry it did not amend.

Write each updated file immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

## Step 4: wireframe coverage sweep

Skip this step silently when `canon/wireframes/` does not exist or has no surface files. When the baseline is unusable, scope it to the working tree and untracked files, and skip it only when that set is empty, reporting `⚠ No diff to scope against. Skipped the wireframe sweep.`

Reuse the diff from the baseline above and filter for UI-affecting paths. UI-affecting paths are framework-dependent. Default heuristic: any file under a `components/`, `features/`, `pages/`, `app/`, `routes/`, or `screens/` folder, plus any `*.tsx`, `*.jsx`, `*.vue`, or `*.svelte` file anywhere in the diff.

Skip silently when the filter leaves nothing, which is every branch touching no UI. Otherwise read `${CLAUDE_SKILL_DIR}/references/wireframe-sweep.md` for the slug derivation, the two findings it reports, the stub it writes, and the output lines.

## Step 5: architecture anchor sweep

Skip this step silently when `canon/ARCHITECTURE.md` does not exist at `pwd` or carries no decision entry with a verification anchor. A record written before the rule holds none, and a project is not told on every ship that nothing has been checked when the standard calls that state correct. When the baseline is unusable, scope the sweep to the working tree and untracked files, and skip it only when that set is empty, reporting `⚠ No diff to scope against. Skipped the anchor sweep.`

This step reports and never writes. The record carries no frontmatter, so an anchor is a sentence sharing a paragraph with the claim it marks, and a pass editing prose to mark prose has no structural guard against editing the claim beside it. A surface whose marker sits in YAML gets that separation for free and this one cannot.

Step 3 holds the writer, and the two never meet. Anchoring fires when this run amends a decision, and this sweep fires when the diff moves a path under one, so a single step covering both would gate the anchor obligation on a signal that has nothing to do with it.

Follow `${CLAUDE_SKILL_DIR}/../../standards/architecture.md` for the anchor sentence this step matches on.

Past the skip above, read `${CLAUDE_SKILL_DIR}/references/anchor-sweep.md` for how an entry's cited paths are collected, the finding the diff fires, and the report line.

## Step 6: flag CLAUDE.md drift

If this session established or changed a cross-cutting behavior rule that belongs in root `CLAUDE.md` (a new always-on convention, a revised workflow rule), surface a one-line warning:

`⚠ CLAUDE.md may need a rule from this session. Review and edit by hand.`

Do not edit `CLAUDE.md` inline. Every `CLAUDE.md` change goes through the show-diff-and-approve gate, so this step only flags. Skip silently when the session made no cross-cutting behavior decision.

## Step 7: refresh context entries

Read `canon/context/index.md` at `pwd` to see which domain entries exist. Skip this step silently if the directory does not exist or has no entries.

Otherwise read `${CLAUDE_SKILL_DIR}/references/context-refresh.md` for its two sources, the routed facts and the diff, the widening a removed capability takes, when a new entry is created, and the output lines.

## Step 8: fold promoted pages

Skip this step silently when no teach promotion handoff exists at `.canon/tmp/handoff/teach-promotion/<slug>.md` at the main worktree root, deriving `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md` with the `latest` fallback. Otherwise read `${CLAUDE_SKILL_DIR}/references/promoted-pages.md` for how each block lands, the handoff delete, and the output lines.

## Step 9: sweep consumed receipts

Read `${CLAUDE_SKILL_DIR}/references/receipt-sweep.md` for which review and memory receipts this session sweeps, which it keeps, and the output lines. Skip this step silently when nothing qualifies.

## Step 10: classify the fold's diff baseline

Skip this step silently only when the Diff baseline section could not resolve a base ref at all, reporting `⚠ No diff to scope against. Skipped the classify check.` The verb needs a resolvable ref to run against, which is the one condition it cannot answer for itself.

Otherwise read `${CLAUDE_SKILL_DIR}/references/classify.md` for the invocation, its scope, the record fields, applying a finding, the one-line keep reason, the unreachable and missing-subcommand lines, and the report shape. `${CLAUDE_SKILL_DIR}` names this skill's own directory, resolved once when the skill loaded, several steps before this one. Read the reference by that resolved path rather than guessing a `.claude/skills/docs-fold/references/classify.md` path from the toolkit's install-time layout, which is a different root than the one this skill's own files live under. The invocation is `canon context classify diff --base <base> --json`, and it runs whether or not that reference resolves. Findings never stop the fold.

## After completion

Output one line per file updated:

`✅ Updated: .claude/<filename>`

When Step 3 met the architecture record's cap, add one line naming what it did there:

`↪ Architecture at cap: merged <heading> into <heading>` or `↪ Architecture at cap: retired <heading> to <context entry>`

Step 10 adds its own lines when it applied or reported a finding, in the exact shape `${CLAUDE_SKILL_DIR}/references/classify.md` gives them under its own Report section. Do not shorten or paraphrase those lines here or in the reply, since the quote and the reason are what a reader checks the finding against.

If no files were updated and nothing was swept, output:

`✅ No changes needed.`

Suppress that line when Step 2 already reported no doc updates. It closes the run on its own, and emitting both leaves a quiet session reporting success twice for one outcome.
