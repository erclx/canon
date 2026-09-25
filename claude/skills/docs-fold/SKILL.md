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

The baseline is unusable in two cases:

- No merge base resolves against either ref.
- The base came from local `main` and equals HEAD. Nothing is pushed to compare against, so a narrow read reports no changes rather than admitting it cannot see them.

An unusable baseline costs only the committed half. `git diff <base> HEAD` is empty by definition once the base equals HEAD, while `git diff HEAD` and `git ls-files --others --exclude-standard` still report uncommitted and untracked work at correct scope.

**Step 2 recovers the committed half.** Read `git log -p -1`, widening to `git log -p -<n>` when the session spans several commits, and read the candidate task files against the working tree. That yields names and content both, which is what lets Step 2 decide on behavior rather than on filenames. A fresh `git init` on `main` with no remote is the ordinary shape of a scaffolded project, so this path carries the evidence rather than covering an edge case.

**Steps 4, 5, and 7 keep the scoped set.** Run them on the working tree and untracked files alone, and skip only when that set comes out empty, each reporting the warning its own step names.

Never substitute the whole tree for a missing baseline, and do not reuse Step 2's commit read in these three for consistency. On a fresh `git init` project the last commit is the scaffold commit, so `git log -p -1` is the whole tree by another route. Step 2 tolerates that because it only reads, and it matches conservatively against outcomes already on the board. Steps 4 and 7 write, so the same set stubs a wireframe for every uncovered surface in the repository and rewrites every context entry that tree touches.

Step 5 only reports, and the whole tree costs it a different way. Every anchored decision cites a path the scaffold commit carries, so the sweep flags the entire record and the reader learns nothing about which number moved.

Widening what a step reads is safe. Widening what a step writes is not, and widening what a step flags spends the reader's attention on entries nothing put in doubt.

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

The steps that follow reach past the session, so each earns the reach separately:

- Step 4 stubs against the diff. That is why the skip is not a stop. A session that changed no docs is exactly when an uncovered surface goes unnoticed.
- Step 5 reads the architecture record against the diff. A run that amended no decision is the one where an anchored number moves under a reasoning nobody reread, which is the case the marker exists to surface.
- Step 7 rewrites context entries against the diff and against the facts `memory-capture` routed. The Diff baseline section above groups its diff half with Steps 4 and 5 as a scoped-set step, so a quiet session is no different from any other for it. The routed half reads a named file and runs whatever the diff shows.
- The scratch sweep reads the board rather than the session. Its board-wide scan exists to clear a plan an earlier run stranded, and a run that stops at Step 2 can never reach one.

This changes which steps the skill reaches. It does not widen what any of them reads. Steps 4, 5, and 7 still take the same scoped set the Diff baseline section defines, and that section's rule is about the input a step is handed rather than about which steps run.

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

Two sources feed this step, the same split Step 2 runs on. The diff carries what the repository changed. The routed facts carry what the session learned, which a diff cannot show.

**Routed facts.** Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`, falling back to `latest` on an empty result, and read `.canon/tmp/handoff/memory-routing/<slug>.md` at the main worktree root. `memory-capture` writes it, one H2 per target entry naming the path, with the fact underneath. Fold each fact into the entry its heading names, which for a nested `canon/context/<domain>/index.md` heading is the sibling file the fact belongs under rather than the generated index itself. Then delete the handoff file so a later run does not fold it twice.

This half is not diff-scoped and must not be. A gotcha a session hit while working is exactly the fact the diff never shows, and scoping it to changed files would drop the entries worth keeping. The handoff is a named input rather than a scan, so the reach stays bounded to what capture decided.

Skip this half silently when the file is absent, which is every run where nothing routed.

**The diff.** When the baseline is unusable, scope this half to the working tree and untracked files, and skip it only when that set is empty, reporting `⚠ No diff to scope against. Skipped the context refresh.` The routed half still runs, since it reads a file rather than a diff.

Reuse the diff from the baseline above, names and content both. For each domain listed in `canon/context/index.md`, read its own entry: a flat `canon/context/<domain>.md`, or, for a domain split into a folder, its `canon/context/<domain>/index.md` and every sibling file that index links. Follow the index rather than globbing the folder, since a folder can hold a file the index does not list yet.

- Map the entry's section headings, whether they sit in one flat file or spread across a nested domain's sibling files, to the changed files. An entry is relevant when its prose references files, modules, or decisions touched by the diff.
- For each relevant entry, rewrite only the sections affected by the diff. Same pattern as `docs-sync`. Do not touch unrelated sections. Never rewrite a split domain's own `index.md` directly, since a regen overwrites it the same way it overwrites the top-level catalog. Rewrite the sibling file the affected section actually lives in instead.
- Rewrite a restated or superseded statement in place rather than appending beside it, the same rule Step 3 applies to the other four canonical doc types.
- Write a reference to another entry as the path that entry sits at, rather than as its bare filename. `${CLAUDE_SKILL_DIR}/../../standards/context.md` states the form, and a bare name strands the reference once a domain splits into subfolders.

### When the diff removes a capability

The mapping above is scoped by file, and a removal invalidates claims that mapping cannot reach. Run this only when the diff deletes a command, a flag, a constant, or a folder. Ordinary feature work takes the narrow rule alone, since widening it on every ship churns prose nothing put in doubt.

Grep the tree for the name that went, rather than for the paths the diff carries. A capability removed by name is cited by that name, which reaches a file the diff never touched.

- An entry this run already rewrote is read whole before it is left. A refresh that updates the top and leaves a contradicting claim below reads worse than an untouched entry, because the current opening lends authority to the stale remainder. This is the one case that overrides "do not touch unrelated sections", and it overrides it only inside an entry the run edited anyway.
- A claim comparing two surfaces is checked even where its file is outside the diff. Such a claim holds only while both surfaces do, so moving one inverts it with nobody editing the file it sits in.

Report each hit as an ordinary rewrite.

Create a new entry only for a domain `canon/context/index.md` already lists but carries no file for, following `${CLAUDE_SKILL_DIR}/../../standards/context.md` for its shape. Before treating a domain as carrying no file, confirm it holds no entry under either spelling, `canon/context/<domain>.md` or `canon/context/<domain>/index.md`, since a domain already split into a folder still passes a check that only looked for the flat file. A row in the catalog is the deliberate decision, taken by whoever added it. This step only fills in what that decision left open, and only until the next `canon indexes regen` pass, which rebuilds the catalog from each entry's own frontmatter plus every sibling's and drops a row whose file still does not exist. Create the file before that regen runs, or the row this bar exists to fill in is gone. A domain the catalog does not list at all is a different case: report it and stop, rather than creating an entry or a catalog row for it.

Write each updated entry immediately. Output one line per file, naming the path this run actually wrote rather than always the flat template:

`✅ Context: canon/context/<domain>.md` for a flat entry, or `✅ Context: canon/context/<domain>/<sub-area>.md` for the sibling file a nested edit landed in

Add a line naming the handoff when one was consumed:

`🧹 Folded: .canon/tmp/handoff/memory-routing/<slug>.md`

The base lint-staged config runs `canon indexes regen` on every committed `*.md`, so `canon/context/index.md` refreshes automatically on commit. No manual step needed.

## Step 8: fold promoted pages

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`, falling back to `latest` on an empty result, and read `.canon/tmp/handoff/teach-promotion/<slug>.md` at the main worktree root. `teach-workspace` writes it, one H2 per destination naming the path, with a source line under the heading and the page body in a fenced block below that. Read the body out of the fence rather than off the heading level, since a reference page carries headings of its own and only the fence separates them from the next destination. Skip this step silently when the file is absent, which is every run where nothing was promoted.

Each block is a page an operator already confirmed a destination for, so this step lands it rather than judging it again. Write to the destination the heading names, at `pwd` rather than at the main root, since every destination here is a tracked file that commits with the branch:

- A wiki page and a public doc arrive as a whole file. Write it as the block gives it, and stop with the block unfolded when the destination path already holds a file, since overwriting a page someone else wrote is not a fold.
- A context entry is merged into rather than created. Fold the body into the sections it belongs under, the same way the routed facts above are folded, and never add an entry the catalog does not already carry.

Then delete the handoff file so a later run does not fold it twice, and regenerate the index of any folder that carries one.

Output one line per page landed:

`✅ Promoted: <destination path>`

Add a line naming the handoff when one was consumed:

`🧹 Folded: .canon/tmp/handoff/teach-promotion/<slug>.md`

Report a block left unfolded rather than dropping it:

`⚠ Skipped: <destination path> already exists. Merge by hand.`

## Step 9: sweep consumed receipts

Sweep the review and memory receipts this session consumed. Resolve all paths at the main worktree root, not the current worktree, the way `session-worktree` does.

Every delete below is a plain `rm`, one per call, routed the way `session-worktree` states.

Plans are not swept here. A plan is settled by the merge rather than by an outcome this run marked, and `canon tasks archive` moves it with the task the `post-merge` hook archives. Sweeping it from this step read a closure Step 3 had written moments earlier and moved a plan the branch was still building from.

### Reviews

Leave the current branch's review receipt where it is. `auto-ship` Step 6 keeps minor findings in `.canon/review/branch-<slug>.md` and its closing block hands the reader that path, so deleting it here removes the file the chain that invoked this skill is still citing. Seven runs recorded that collision across two days before a sandbox fixture asserted the receipt and could pass only on a run the chain stopped early.

The body that writes a receipt owns its lifetime. This skill sweeps on behalf of whatever called it and has no way to read whether a file is still in use, where the chain that wrote this one cites it in its own output and knows. What reaps it is the branch sweep below, one branch later, once the branch it names is gone.

Sweep the branch reports this session never opened. List `.canon/review/branch-*.md`, run the slug transform in `${CLAUDE_SKILL_DIR}/../../standards/slug.md` over every name `git branch --format='%(refname:short)'` prints, and delete a report whose slug matches none of them. Take the names from that format rather than from `git branch --list`, which marks the current branch with `* ` and a branch checked out in another worktree with `+ `, so a transform reading the marked lines as written turns a live branch into a slug nothing matches and sweeps a report a sibling worktree is still working from. A branch report is read once, by the session addressing it, and the durable record of what a review found is the comment `review-pr` posts on the pull request, so a report outliving its branch is holding nothing. Skipping this leaves them accumulating for the life of the checkout, since a slug is unique per feature and no later branch ever looks for one.

What that removes is a local-only review on a branch deleted before it opened a pull request. `review-branch` says so where a reader meets the report, and the sweep runs anyway rather than keeping every report against the one case, since nothing else ever clears them.

Memory receipts sweep board-wide rather than by slug. Scan every `.canon/memory/review/memory-review-*.md`, not only the one matching this slug. `memory-review` writes its receipt after this skill has run in every ship chain, so a sweep keyed on the current slug looks for a file that does not exist yet, and no later branch looks for it either because a slug is unique per feature. Scanning the folder is what makes the sweep fire at all.

For each receipt, count the H2 items still pending. An item is pending when its H2 carries 📝, or when its H2 carries no status emoji and its `Decision:` slot holds nothing `memory-review` Apply would act on or skip, since a receipt written by hand or by an older binary may lack the marker, and Apply's parse leaves every other slot value undecided:

- No pending item: fold it per the collection rule in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`, then delete the receipt.
- Any pending item: leave it and report the count. Pending items are decision state, and a branch shipping is not an operator deciding them.

That standard owns what a fold writes and which entry types take one. `memory-review` collects a receipt on the same rule, so neither body restates it.

Do not sweep `ux-audit-*.md` or `ux-measure-*.md` (standalone deliverables). Those sit at `.canon/review/` itself rather than under a producer folder, so the two globs above never reach them.

Output one line per file swept:

- `🧹 Deleted: <path>, branch gone` for a branch report whose branch no longer exists
- `🧹 Deleted: <path>, folded <n> skips` for a swept memory receipt
- `⏭ Kept: <path>, <n> items pending` for a memory receipt still holding decisions

If nothing qualifies, skip this step silently.

## Step 10: classify the fold's diff baseline

Skip this step silently only when the Diff baseline section could not resolve a base ref at all, reporting `⚠ No diff to scope against. Skipped the classify check.` The verb needs a resolvable ref to run against, which is the one condition it cannot answer for itself.

Otherwise resolve `<base>` the way the Diff baseline section already does for Steps 2, 4, 5, and 7, and reuse it rather than resolving a second time. Run the check over the fold's whole baseline rather than scoping it to what Steps 3 and 7 wrote this run: earlier commits on the branch carry doc edits the fold is equally responsible for, and the verb's own extraction already scopes to canonical doc types and reports nothing when the range carries none.

The invocation is:

```bash
canon context classify diff --base <base> --json
```

Never substitute a different verb for it, such as `canon autoship classify` (a different check, over a different scope) or `canon docs <name>` (a documentation lookup, not a classification). Read `${CLAUDE_SKILL_DIR}/references/classify.md` for the record fields, applying a finding, the one-line keep reason, the unreachable and missing-subcommand lines, and the report shape. `${CLAUDE_SKILL_DIR}` names this skill's own directory, resolved once when the skill loaded, several steps before this one. If Step 10's memory of that path is uncertain, read the reference by that resolved path rather than guessing a `.claude/skills/docs-fold/references/classify.md` path from the toolkit's install-time layout, which is a different root than the one this skill's own files live under. The invocation above runs either way, whether or not that reference resolves.

Findings never stop the fold. A refusal or a missing subcommand on an older installed binary reports one line, per that reference, and the fold continues either way.

## After completion

Output one line per file updated:

`✅ Updated: .claude/<filename>`

When Step 3 met the architecture record's cap, add one line naming what it did there:

`↪ Architecture at cap: merged <heading> into <heading>` or `↪ Architecture at cap: retired <heading> to <context entry>`

Step 10 adds its own lines when it applied or reported a finding, in the exact shape `${CLAUDE_SKILL_DIR}/references/classify.md` gives them under its own Report section. Do not shorten or paraphrase those lines here or in the reply, since the quote and the reason are what a reader checks the finding against.

If no files were updated and nothing was swept, output:

`✅ No changes needed.`

Suppress that line when Step 2 already reported no doc updates. It closes the run on its own, and emitting both leaves a quiet session reporting success twice for one outcome.
