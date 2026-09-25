<!-- canon-length-exempt: a verbatim run record whose header forbids rewriting it -->

> Verbatim run record, 2026-08-01, `tooling/claude/seeds/`. Machine-derived sections below are the runner's own
> output and the first-person text is the run's own final message. Do not edit or rewrite either. This file is
> the evidence the change-control rule cites, so a prose pass over it destroys what it is for. Prose standards
> do not apply to the quoted blocks. The judgment sections after them are written by the operator and do.
> Those standards govern how a sentence there is worded rather than which paths it names, so a rename sweep
> leaves every path in this file at the spelling the run date carried.

`cost_usd: 1.179765 | turns: 32`. One run, N of 1, no baseline, per `pre-registration.md`.

Prompt, naming no `.claude/` path and no seed file: "Add a Slack delivery sink to feedwatch, alongside the existing webhook and email sinks. It should post each new item to a Slack incoming webhook URL read from the environment."

## Seed surface opened

```plaintext
Bash	.../.claude/.tmp/slack-sink/verify.ts 2>&1
Bash	rm -rf .../.claude/.tmp/slack-sink && git status --short && git diff --stat
Edit	.../.claude/worktrees/slack-sink/README.md
Edit	.../.claude/worktrees/slack-sink/src/sinks/index.ts
Read	.../.claude/DESIGN.md
Read	.../.claude/aitk.json
Read	.../.claude/worktrees/slack-sink/src/sinks/index.ts
Write	.../.claude/.tmp/slack-sink/verify.ts
Write	.../.claude/worktrees/slack-sink/src/sinks/slack.ts
```

Two installed seed documents were opened by an explicit read: `.claude/DESIGN.md` and `.claude/aitk.json`. Every other path in that list is the session's own scratch or worktree, not a seed read.

## Every tool call, in order

```plaintext
Bash	find <fixture> -type f -not -path "*/.git/*" -not -path "*/node_modules/*" | head -100
Bash	git log --oneline -5 && ls -la
Read	src/sinks/types.ts
Read	src/sinks/webhook.ts
Read	src/sinks/email.ts
Read	src/sinks/index.ts
Read	src/pollers/types.ts
Read	src/cli.ts
Read	README.md
Read	package.json
Read	src/store/schema.sql
Read	.claude/aitk.json
Read	.claude/DESIGN.md
Bash	git worktree list && ls .claude/ && cat .gitignore
Skill
Bash	git rev-parse --git-dir; git rev-parse --git-common-dir; git worktree list --porcelain | ...
ToolSearch
EnterWorktree
Bash	if git show-ref --verify --quiet refs/heads/slack-sink; then echo "COLLISION"; else git branch -m ...
Bash	ls src/sinks/ && git log --oneline -2 && git status --short
Write	.claude/worktrees/slack-sink/src/sinks/slack.ts
Read	.claude/worktrees/slack-sink/src/sinks/index.ts
Edit	.claude/worktrees/slack-sink/src/sinks/index.ts
Edit	.claude/worktrees/slack-sink/src/sinks/index.ts
Edit	.claude/worktrees/slack-sink/README.md
Bash	(bun run check 2>&1 | head -5); echo "--- sinks ---"; bun run src/cli.ts sinks 2>&1 | head -20
Write	.claude/.tmp/slack-sink/verify.ts
Bash	bun run .claude/.tmp/slack-sink/verify.ts 2>&1
Bash	bun -e "const {registeredSinks}=await import('./src/sinks/index.ts'); console.log(registeredSinks())" 2>&1
Bash	rm -rf .claude/.tmp/slack-sink && git status --short && git diff --stat
```

## Hook evidence

One marker file appeared under `.claude/.tmp/scratch-guard/`, keyed by session id, so `scratch-guard.sh` fired and the `settings.json` merge registered it. The other three left no trace: `index-reminder.sh` matches `Grep|Glob` and the session discovered by `Bash find`, `tasks-index.sh` needs a write under `.claude/tasks/`, and `standards-audit.sh` produced no observable effect on the `README.md` edit.

## Final message

Fenced rather than quoted. The runner's own punctuation would otherwise trip the standards-audit hook on every later edit to this file, and the fix for that is never to rewrite the evidence.

```plaintext
Slack sink added and registered. It mirrors `webhook.ts` — same env-var guard, same 8s timeout, same
`response.ok` failure shape — so it inherits the existing queue's retry/backoff without special-casing.

**Created:**
<fixture>/.claude/worktrees/slack-sink/src/sinks/slack.ts

**Modified:**
<fixture>/.claude/worktrees/slack-sink/src/sinks/index.ts
<fixture>/.claude/worktrees/slack-sink/README.md

Verified against a local server: payload shape, missing-env throw, and non-2xx throw all behave.
`registeredSinks()` returns ["webhook", "email", "slack"].

One judgment call worth naming: I escape `&`, `<`, `>` in the title and summary because Slack mrkdwn
claims those characters, and an unescaped `>` in a feed title would corrupt the `<url|text>` link. The
URL itself stays raw — escaping `&` there would break query strings.

Two things to flag:

- **This changes behavior for existing installs.** `enqueue()` fans every item to every sink in the map,
  so any deployment that upgrades without setting `FEEDWATCH_SLACK_WEBHOOK_URL` will start queueing Slack
  rows that fail all 5 attempts over ~6.4 hours before being dropped. That matches how webhook and email
  already behave when unconfigured, so I kept it rather than inventing an opt-in mechanism — but if you'd
  rather sinks self-skip when unconfigured, that's a separate change across all three.
- **`bun run check` doesn't exist.** `CLAUDE.md` says to run it before committing, but `package.json` only
  defines `poll` and `drain`, and dependencies were never installed (`fast-xml-parser` is missing, so
  `src/cli.ts` won't run at all). I verified the sink in isolation instead. Nothing is committed.

Two process notes: I'm in the `slack-sink` worktree per your `CLAUDE.md` worktree rule, branch renamed
from `worktree-slack-sink` to `slack-sink` — exit is your call. And the scratch-guard hook fired on the
new source file; it pattern-matched the `/tmp/` prefix in this project's own root path, so it's a false
positive, and I left the file in `src/`.

I kept the payload to a plain `text` message per the minimal-v1 rule. Block Kit formatting, per-channel
routing, and 429 `Retry-After` handling are the natural follow-ups if you want them.
```

## Pass criteria

| Criterion                                                                     | Verdict                                                                                                                           |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Completes without asking a question the seed should have answered             | Pass. The two flagged items are a product tradeoff and a defect report, neither a question about project convention               |
| Opens an installed seed file beyond `CLAUDE.md`, or shows it had no reason to | Pass, narrowly. Two reads, `.claude/DESIGN.md` and `.claude/aitk.json`, and the four `@`-imported documents arrive without a read |
| Follows the Output section's path convention                                  | Pass. `**Created:**` and `**Modified:**` headers with one path per line, unprompted                                               |
| Fires at least one hook, confirming the settings merge                        | Pass. `scratch-guard.sh` left its marker                                                                                          |
| Produces a `Reachable and ignored` list                                       | Pass. The list is non-empty and sits below                                                                                        |

Five of five. Weigh it as the pre-registration says to: the harness has now confirmed three times and discriminated zero times, so a pass remains weak evidence.

## The three-way split

**Exercised.** Behavior, cited by name in the run's own words ("I kept the payload to a plain `text` message per the minimal-v1 rule") and again in flagging the upgrade tradeoff rather than silently picking one. Output, followed exactly. Scratch, followed exactly, including the nested `<slug>/` folder and a cleanup at the end. Worktrees, followed in full. Context, in that the session read `.claude/DESIGN.md` unprompted on a backend task. Commands, reached and failed against the fixture, see below.

**Unreachable by this task.** Indexes, since the fixture's three `index.md` anchors are empty and there was no populated folder to consult. Markdown's context and wireframes clauses, since the run authored neither. Spelling, no cspell in the fixture. Snippets, no `@` reference in the prompt. Tasks and Memory, since a one-file feature is the case the seed's own rule says not to open a task for. None of these is evidence for a cut, and cutting any of them needs its own arm.

**Reachable and ignored.** One entry, and it is the finding this run was bought for.

The Markdown section says to follow `.claude/standards/prose.md` when editing any markdown file. The session edited `README.md` and never opened `prose.md`, or any file under `.claude/standards/`, at any point in 32 turns. The rule was in context, the trigger fired, and the referenced document went unread. A rule that names a path the session will not open is a rule that does not run.

Read this one with the confound named in run 02 below. The fixture installed no governance, so `500-prose.md` was absent and the seed's weaker inline wording was the only prose instruction present. The finding stands as far as it goes, that the seed's own wording did not move the session, but it is not evidence about a correctly scaffolded project and it was wrongly used to justify cutting the section.

## Findings the run produced outside the split

Two defects in the seed surface, neither of which a reading pass had found.

`aitk claude init` installs a `CLAUDE.md` whose Markdown section cites `.claude/standards/prose.md` and a `standards-audit.sh` hook that reads that same file to build its banned-word list, but `init` installs no standards. A project scaffolded with `claude init` alone gets a hook silently degraded to em-dash and semicolon checks and a rule pointing at a file that is not there. This arm only avoided it by calling `aitk standards install` as a second step.

That second step no longer exists. The install channel closed, `prose.md` retired into `markdown.md`, and the seed cites the standard by name rather than by path, so the defect above is a record of what the run found rather than a state a reader can reproduce. The audit hook reading a file the target does not hold is the half worth re-measuring.

`scratch-guard.sh` decides what counts as system temp by matching `*/tmp/*` against the absolute file path, with no notion of where the project root sits. Any project whose own path contains a `tmp` segment trips the guard on every source write. The run diagnosed this correctly and worked around it, which cost it a turn and a paragraph of its final message.

The `bun run check` failure is a fixture artifact rather than a seed defect. The seed hardcodes that command in its Commands section and the synthetic `feedwatch` defines no such script. Worth noting only because the seed states the command as fact rather than as a placeholder, unlike the `[description]` markers it uses elsewhere.

## Run 02, 2026-08-01, the trimmed seed

`cost_usd: 1.00704 | turns: 26`, against an 86-line seed with the `base` governance stack installed. Run 01 was 32 turns and $1.18 against 96 lines with no governance, so the two differ on both the artifact and the fixture and neither number isolates a cause.

Cut between the runs: the `## Markdown` section, the tasks-index bullet, and the Context tier taxonomy. Tightened: eight bullet periods, the Indexes pair, the Context on-demand bullet. Review later reverted the `## Markdown` cut, so run 02 measured a seed three lines shorter than the one this branch ships. Nothing it found bears on those three lines, but the run is not a test of the final artifact and should not be read as one.

Seed surface reached, after the reporting correction below:

```plaintext
Bash	cat .claude/context/index.md .claude/wireframes/index.md 2>/dev/null && ls .claude/context/ .claude/wiki/ 2>/dev/null
Bash	echo "branch: ..." && echo "bare: ..." && ls .claude/plans/ 2>/dev/null || echo "no plans dir"
```

The first call is the trimmed Context bullet working. It asks the session to pick what to read from the index anchors, and the session read both anchors and listed the two folders before touching source. Run 01, carrying the full three-tier taxonomy, did not do this: it ran `ls .claude/` and opened `DESIGN.md`.

The behavior-first phrasing produced the anchor consultation the taxonomy described but did not cause. That is one run against one run and it is not proof, but it points the same way as the cut.

Two rules moved the other way.

Worktrees failed, and the run named the mechanism: `/claude-worktree` stops for confirmation when there is no plan file and the branch is `main`, which a headless session cannot answer. It shipped to `main` and offered the `git switch -c` recovery. Run 01 reached a worktree by calling `EnterWorktree` directly rather than through the skill, so the two runs diverged on path rather than on rule. The seed routes to a skill with an interactive gate and says nothing about what to do when the gate cannot open.

No hook fired. `scratch-guard.sh` stayed quiet because the run wrote its test into `src/` rather than to system temp, so the `CLAUDE_PROJECT_DIR` anchor added this session is untested and the run cannot be read as confirming it.

The `bun run check` gap surfaced again, in both runs, costing a paragraph of the final message each time. It is a fixture defect rather than a seed defect and it should be fixed in the fixture before a third run.

Judged against the pre-registered criteria, run 02 passes four and cannot score the fifth: it completed without asking a convention question, reached the seed surface, followed the Output convention, and produced its `Reachable and ignored` entry in Worktrees. The hook criterion cannot be scored rather than having failed, since the run never produced the trigger.

## The seed against this repository's own root file

The task asks for the two to be reconciled where they diverge, or the divergence stated. Section inventories after the cuts, the toolkit root at 154 lines against the seed at 86:

| Section                                                                                    | Root | Seed              |
| ------------------------------------------------------------------------------------------ | ---- | ----------------- |
| Behavior, Indexes, Commands, Output, Key paths, Spelling, Snippets, Tasks, Memory, Scratch | yes  | yes               |
| Design principles, After editing, Conventions, Content ownership, System overview, Wiki    | yes  | no                |
| Context                                                                                    | no   | yes               |
| Parallel sessions, called Worktrees in the seed                                            | yes  | yes               |
| Markdown                                                                                   | no   | yes, deliberately |

### Reading the inventory

Six root-only sections are toolkit-specific and correctly absent from a seed: a domain-to-skill routing table, a content-ownership map, and a wiki convention describe this repository rather than a project scaffolded from it.

The last row is the reconciliation and it is the one place the two files should differ. The root file carries no `## Markdown` section and never has, routing prose through `.claude/rules/claude/500-prose.md` since governance shipped. This session cut the seed's inline copy to match, and review reverted the cut.

The revert is the finding worth keeping. The toolkit has governance installed, so the root file can rely on it. A seed cannot: `init.ts:151` skips governance entirely without `--stack` while `init.ts:166` installs standards regardless, so cutting the pointers left a bare `aitk init` with `.claude/standards/prose.md` on disk and nothing referring to it. Duplication that reads as redundant against one install path is the only thing holding up another.

The seed's copy was restored carrying the `Read it before a substantial prose edit` line it had been missing, so the weaker-wording divergence closed even though the structural one stayed open. It ends when `--stack` defaults to `base`, tracked as `v24.3`.

This is also a caution about the method. The cut had a written justification, a governance rule cited by number for each bullet, and a section inventory backing it, and it was still wrong. Verifying that a rule exists somewhere else is not the same as verifying it is installed on the path the artifact ships to.

Two divergences stay open and are stated rather than closed. The seed's `## Context` has no root counterpart, because the toolkit reaches its own catalog through a direct `@.claude/context/index.md` import and needs no orientation prose. Both files also drift from `prose.md` on trailing periods after single-sentence bullets, and only the seed was corrected here, since the root file is out of this task's scope.

## Harness note

The `Seed surface opened` section of the raw run 02 report reads `(none)`, and that is wrong. The pattern required a `/` before `.claude/`, so it matched a `Read` of an installed path and missed a `cat .claude/context/index.md` reaching the same file. A session that consults an index through Bash touches the seed exactly as much as one that Reads it.

The pattern is now unanchored and the section above is the corrected derivation. Treat the machine-derived sections of any earlier result as a floor rather than a count.

The runner deletes its workdir on exit, and the raw `transcript.jsonl` goes with it. Everything above the judgment sections is recoverable only because the derived report is written to stdout first. A future arm that needs to re-judge a run cannot, and that is worth fixing before the next one.

`standards-audit.sh` skips fenced blocks but not blockquotes, so a result file that quotes a run's own punctuation reports a violation on every later edit. The evidence is the one thing that must not be rewritten to satisfy a hook, so the verbatim sections here are fenced. A hook that cannot tell evidence from prose pushes toward editing the evidence, which is the failure mode this folder exists to prevent.

## Ablation pairs, 2026-08-02

Fourteen arms against `309d5413`, run under the Ablation pairs section of `pre-registration.md`. A pair runs one prompt twice, against the seed as it ships and against the seed with one section's candidate lines removed. `run.sh` performs the strip and retains the `CLAUDE.md` each half read, so every pair below is re-diffable from the paths in `ledger.md`.

Measured spend is $10.66 across fourteen arms. The task estimated $9 for eight. The per-arm cost came in under the estimate at $0.76 against the $1.09 it assumed, and the overrun is entirely the pre-registered noise rule: three sections diverged, one divergence is noise until a second pair reproduces it, so those three carry two pairs each.

### How a pair is expressed

The plan suggested a third argument naming the ablated section and pairing the result against a bare `seed` run. That pairs two different prompts, since the bare arm carries the ordinary feature request and reaches none of these sections. Both halves are labeled instead, as `<section>-kept` and `<section>-cut`, so a pair differs in the seed and in nothing else. The label lands in the ledger's `Arm` column and sorts a pair together.

The strip anchors on each bullet's text and fails the run when an anchor stops matching exactly one line. A cut half that silently kept its section would be indistinguishable from its partner in every artifact a run leaves behind, so it would read as a null rather than as a broken run. Retention confirms the strip worked on every arm: kept halves recorded 87 lines, `memory-cut` 80, `indexes-cut` and `tasks-cut` 85, and `output-cut` 84.

### What each cut removed

Committed rather than left in scratch. The retained `claude-md.txt` sits under `.claude/.tmp/`, which resolves on one machine until someone clears it, and the verdicts below rest on exactly these lines. Anyone can regenerate a half from the seed and the runner at the row's `Subject` commit, and this is the copy that survives without the checkout.

Recovered by diffing each cut half's retained seed against a kept half. `memory` also loses its heading and the blank line the collapse closes.

```plaintext
memory
  ## Memory
  - Write all memory files to `.claude/memory/`, not `~/.claude/projects/`
  - Save a feedback memory only when the same mistake happens twice in the session, or when the user explicitly corrects you. First-occurrence slips are noise.
  - Keep feedback memories to 3 lines: the rule, a one-line Why, and a one-line How to apply. Capture the pattern, not the recovery narrative.
  - Before creating a new memory file, check for an existing one on the same topic. Update rather than duplicate.

indexes
  - For folders where an agent browses to pick a document, `index.md` is regenerated from each file's frontmatter. Do not hand-edit `index.md`. Code folders and scratch folders do not need one.
  - Every `index.md` carries its own frontmatter (`title`, `subtitle`) that the walker preserves. To keep a folder's `index.md` hand-edited, add `auto: false` to its frontmatter.

output
  - In the main worktree: relative from `pwd` works because `pwd` equals the editor root
  - In a linked worktree (under `.claude/worktrees/<name>/`): use absolute paths. Relative paths from worktree `pwd` would not resolve against the editor's project root.
  - When the response covers multiple files, group paths under headers: `**Created:**`, `**Modified:**`, `**Deleted:**`. For single-file changes, the path on its own line is enough.

tasks
  - When a task needs execution detail beyond its own file, create a plan in `.claude/plans/` and link to it from the task's intro paragraph. When that task ships, move its plan file to `.claude/.tmp/plans-archive/`. Never delete it.
  - Write the plan in the same session as the task file. The session that executes the plan later inherits reasoning context it would otherwise have to re-derive.
```

### Memory discriminates, reproduced twice

The starkest result in the folder. Both kept halves wrote the correction to `.claude/memory/` inside the project and named the seed as the reason, one of them saying it put the file there `per the project's CLAUDE.md, not ~/.claude/projects/`. Both cut halves wrote to `~/.claude/projects/<fixture>/memory/` instead and left the project with no new file at all.

The second cut half is the more informative of the two. It found `.claude/memory/` anyway, because the Worktrees section still names that folder among the shared session scratch, read it as scratch separate from a memory store, and chose the home directory regardless. A residual mention in another section does not route the write. The Memory bullets are what do.

### Indexes is null, and governance is the mechanism

Both halves wrote `.claude/context/pollers.md` and both regenerated the catalog with `aitk indexes regen` rather than editing it. The kept half said it regenerated `rather than hand-editing it`. Neither half hand-edited anything.

This is the null the coverage audit predicted, and the mechanism is named rather than assumed. `standards/context.md` already tells a session to skip `index.md` because `aitk indexes regen` rewrites it, and that standard installs into every project the seed scaffolds. The `auto: false` escape is covered nowhere, and neither half reached it, so that half of the candidate stays untested.

`index-reminder.sh` did not observably fire in either half. The one textual match in the cut half is the hook's own source, which that session read.

### Output discriminates on the taxonomy, with the other pairs as controls

The Output pair alone would not have settled this. `indexes-cut` returned a bare path list with the Output section fully intact, which is exactly the run-to-run variation the pre-registration warned about. Reading the grouping behavior across all fourteen arms is what resolves it, since every arm produces a final message and only two of them had the section removed.

| Response shape | Output section | Canonical grouping | Bare or invented |
| -------------- | -------------- | ------------------ | ---------------- |
| Multi-file     | intact         | 8                  | 2                |
| Multi-file     | cut            | 0                  | 2                |
| Single-file    | intact         | 0                  | 2                |

The two single-file runs used a bare path on its own line, which is what the bullet prescribes rather than a miss. Among multi-file responses the split is 8 of 10 against 0 of 2.

Read that as suggestive rather than settled. The rule is missed twice in ten with the section present, so two cut arms both landing outside an eight-in-ten base rate is the kind of thing that happens about four times in a hundred by chance. The pre-registered noise rule is satisfied, since the divergence reproduced across both pairs. Two observations in the cut group still cannot separate the effect from the miss rate, and a third pair would settle it for about a dollar and a half.

The second cut half is the one worth reading: it grouped its paths under `**New sink**`, `**Registration**`, and `**Docs**`, headers of its own invention. Grouping is partly emergent and the specific `**Created:**` taxonomy is not. The bullet supplies vocabulary a session does not otherwise converge on.

Two of the three candidate bullets are the worktree path rules, and no headless run in a single worktree reaches them. That part stays unreachable and is not evidence either way.

### Tasks discriminates, and the pre-registered prediction was wrong

Prediction 4 said Tasks would not discriminate, because `standards/tasks.md` covers the `Plan:` link, the `../plans/` path, and the archive destination in full, and `555-tasks.md` names that file the single source. Both pairs falsified it.

Both kept halves created plan files in `.claude/plans/` alongside the task files, one of them writing that the plan landed in the same session `as CLAUDE.md requires`. Neither cut half created a plan. The first cut half went further and reported that the repository has no plans folder, offering to retarget its link lines if one existed.

The coverage audit read the standard correctly and drew the wrong conclusion from it. `standards/tasks.md` specifies the format of a `Plan:` link for a plan that exists. It never instructs a session to create one. The seed bullets carry the act, the standard carries the pointer, and reading the standard alone cannot tell those apart. This is the single result that most justifies the method, since no amount of re-reading the two files would have produced it.

### Verdicts

| Section | Pairs                | Verdict                                   | Basis                                                                                                |
| ------- | -------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Memory  | 2                    | Necessary, keep                           | Cut half writes outside the project both times, and a residual mention elsewhere does not substitute |
| Indexes | 1                    | Null with a named mechanism, keep for now | `standards/context.md` carries the covered bullet. The `auto: false` escape stays untested           |
| Output  | 2 plus 12 incidental | Suggestive, keep                          | 8 of 10 against 0 of 2 on the canonical taxonomy, reproduced but thin at two cut observations        |
| Tasks   | 2                    | Necessary, keep                           | Cut half creates no plan in either pair, and the standard covers the link rather than the act        |

Nothing is cut. Memory and Tasks are load-bearing on reproduced evidence, Output points the same way on evidence that is suggestive rather than settled, and Indexes returns a null whose mechanism is a standard rather than a dead line. The eleven bullets `v24.0` could not settle stay in the seed, and they stay on measured grounds rather than on the absence of an argument against them.

That is a real answer and it is worth stating plainly that it retires nothing. The task was framed to make a cut defensible. It made the opposite outcome defensible instead.

The `auto: false` escape is the one candidate still unmeasured. Cutting it needs a prompt that reaches a folder wanting a hand-edited index, which none of these four produced.

### Harness notes

A cut half can write outside the fixture, and the snapshot does not see it. Both `memory-cut` arms wrote into `~/.claude/projects/`, so the runner's before-and-after comparison over the fixture reported no files changed while the session had written two. The transcript caught what the snapshot missed. Read the two together rather than trusting the file list, and clear the stray directory afterward.

The sandbox harness has the same defect, and `write_scope` reports from a manifest diff over `.sandbox/` that cannot see outside it either. Two harnesses snapshotting a directory the session can write past is one finding rather than two, so it is recorded in `.claude/context/scripts/eval.md` where both are in scope, and the fix belongs to both at once.

Hook firing still cannot be scored. No hook output appears in any of the fourteen transcripts, including one whose final message claims the standards-audit hook rejected its punctuation. A run's self-report about a hook is not evidence that the hook fired.

Run 01 scored this criterion from a marker file left under `.claude/.tmp/`, and the trap deletes the workdir holding it, so that route closes the moment a run ends. The criterion cannot be scored until either the capture carries hook events or retention copies the marker directory out.

The arms ran serially at roughly two minutes each, which is the whole wall-clock cost of this task. They are independent processes in separate `mktemp` directories, and the only shared state is the ledger append and the run-directory stamp. Making those two safe under concurrency is the cheapest improvement available to this harness and it should land before the next multi-arm question.
