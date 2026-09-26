# Pre-registration

> Frozen record, written before either run. It quotes paths and rules as they stood on the run date, so a
> path inside it that no longer resolves is the record working rather than drift. Do not retarget it in a
> sweep and do not rewrite what it claims. A prose pass over this file destroys what it is for.

Written before either run. Fixes what counts as a hit so a miss cannot be reinterpreted afterward.

Held outside both fixture roots on purpose. Neither test session can read this file, since each runs with its cwd set to the `feedwatch/` directory inside its own arm.

## What is being tested

Whether a session that has never seen the standard can author a conforming entry from the standard alone. This is a spec-quality test on the standard, not an efficacy test on the context system. No baseline arm, N=1 per standard, per `05-experiment-design.md:29`.

## Fixture

A synthetic tool, `feedwatch`, that polls RSS and Atom feeds and fans items to delivery sinks. Synthetic rather than a real domain: all 17 domains in this repo carry entries as of 2026-07-31, so the plan's fallback in question 4 is the only honest option. A real domain with an existing entry would let the session pattern-match from prior exposure rather than from the standard.

Each arm holds the tool, a copy of the standard under test at `.claude/standards/`, a copy of `markdown.md`, and an empty destination folder. No `CLAUDE.md` at any level, verified: no user-level `~/.claude/CLAUDE.md` exists on this machine, and the fixture sits outside the toolkit repo so the repo's own `CLAUDE.md` cannot load through the ancestor chain.

## Planted decisions, context arm

Three non-obvious choices are recoverable from the source. Each carries its reasoning in a code comment rather than in a doc, so recording it requires reading code and deciding it matters.

1. **Dedupe keys on a content hash of title plus link, never the feed GUID.** `src/store/cursor.ts:10`. Two upstream aggregators republish the same article under a fresh GUID, so GUID-keyed dedupe re-emitted articles several times a day.
2. **Delivery is enqueue-then-drain, not inline.** `src/sinks/index.ts:16`. A hanging webhook would otherwise stall every later feed in the same cycle, and a long cycle gets killed by the supervisor before reaching the tail of the feed list.
3. **The seen-hash table is pruned to the last 500 per feed.** `src/store/cursor.ts:5` and the `prune` function. This is the gotcha rather than the decision: a feed that rewrites history beyond that window silently re-emits.

Recording any one of these with its reasoning satisfies the "at least one real decision" criterion. Recording none is a fail on that criterion.

## Planted intent, wireframes arm

1. **The add-feed form is inline at the top of the list, not a modal.** `src/ui/AddFeedForm.tsx:3`. The modal version cost two clicks before the visitor could type.
2. **Below 600px the status pill drops its text and renders as a colored dot.** `src/ui/FeedRow.tsx:18` and the media query in `feed-list.css`. This is a genuine layout change across a breakpoint, so it earns a second fence under the standard's variants rule.
3. **The empty state is its own layout with a sample-feed shortcut.** `src/ui/EmptyState.tsx`. A second named variant.

## Seed arm

Written before the seed run. The subject is `tooling/claude/seeds/`, twelve files rather than one document, and the question is the task's outcome text: can a session that has never seen the seed work in a project scaffolded from it without asking for context the seed should have carried.

The fixture is `feedwatch` again, stripped of `.claude/` and `CLAUDE.md`, with the seed installed through `canon claude init` and the standards through `canon standards install`, a verb since removed with the install channel. The CLI runs by path rather than as the linked binary, since `PROJECT_ROOT` resolves from the CLI's own source and a global binary would install the main checkout's seed instead of the one under test. Git is initialized after the install so the seed's `.gitignore` means something and the rules that shell out to git are reachable.

The prompt is an ordinary feature request naming no `.claude/` path and no seed file: add a Slack delivery sink alongside the existing webhook and email sinks. Naming a seed file would tell the session where to look and measure obedience rather than discoverability.

### The three-way split

Every seed section is sorted into exactly one bucket. Fixing the buckets here is what stops a trim from being rationalized after the fact, which is the failure this task exists to avoid.

- **Exercised**: the run produced the section's trigger and the session observably followed or violated the rule, or opened a path the section names. Keep, and the run says whether the wording works.
- **Unreachable by this task**: the run could not produce the section's trigger at all. A single feature request cannot reach the spelling rules without cspell, the snippet rule without an `@` reference, or the worktree rules without a multi-session feature flow. Not evidence for cutting. Cutting one of these needs its own arm.
- **Reachable and ignored**: the run produced the trigger and the session did not follow the rule. This is the only bucket that justifies an edit, and the edit can be a cut or a rewrite.

A section landing in the third bucket is a failure of the seed, not of the session. That is the finding the task is buying.

### Pass criteria, seed arm

- Completes the feature without asking a question the seed should have answered. A question about the product, such as which Slack field carries the item title, is not a seed failure. A question about the project's own conventions is.
- Opens at least one installed seed file beyond `CLAUDE.md`, or demonstrates it had no reason to. The transcript decides this from real `file_path` values in `tool_use` blocks, never from a grep for a filename, since the seed names its own paths and a grep hits the instruction rather than the read.
- Follows the Output section's path convention in its final message.
- Fires at least one of the four hooks on its writes, confirming the settings merge registered them.
- Produces a `Reachable and ignored` list, empty or not. An empty list is a real result and means the seed is right-sized for this task, not that the run failed.

### Standing rule, seed arm

N of 1, one arm, no baseline, matching the standards arms. The harness has confirmed twice and discriminated zero times, so a pass here is a third confirmation from a test that has never failed anything. Weigh it accordingly and say so in the result.

A cut removes a line from new projects and leaves it in every existing one. Any cut this run justifies names `seed-sync` as the path that carries it into projects already scaffolded, or states that it does not.

## Ablation pairs

Written before any pair ran. The seed arm above asked whether the seed carries a session through a task and got a pass. Whether a given line does work is a different measurement, and it needs a comparison group no arm above has.

A pair runs the same prompt twice against the same fixture. The `kept` half reads the seed as it ships. The `cut` half reads it with one section's candidate lines removed and nothing else changed. `run.sh` strips the installed `CLAUDE.md` after every installer has run, then retains both halves' copies beside their transcripts, so a pair stays re-diffable when a later question needs it.

Each pair carries its own prompt. One feature request reaches none of these sections, which is what turns four cuts into eight arms and also means the four results are not comparable to each other.

### Candidates

Eleven bullets across four sections, addressed by their text rather than by their ordinal. The task that ordered this work names "Indexes bullets 3 and 4" against a section that now holds three, so an ordinal is not a stable address. `run.sh` fails the run when an anchor stops matching exactly one line.

| Section | Bullets | What the candidate carries                                                                                                     |
| ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Memory  | 4       | Where memory files go, when a feedback memory is worth saving, the 3-line shape, and the check for an existing file            |
| Indexes | 2       | `index.md` is regenerated from sibling frontmatter and is not hand-edited, and `auto: false` opts a folder out                 |
| Output  | 3       | Relative paths in the main worktree, absolute paths in a linked one, and the `**Created:**` grouping for a multi-file response |
| Tasks   | 2       | A plan lives in `.canon/plans/` and is linked from the task intro, and it is written in the same session as the task           |

### Governance coverage, audited before the runs

A candidate the `base` stack already delivers path-scoped cannot show a difference, because the cut half still carries the rule through another file. Auditing this first is what separates a null meaning the section is dead from a null meaning governance carried it. Both are nulls and only one is evidence about the seed.

- **Memory**: no rule and no installed standard mentions `.canon/memory/`. The cut half loses the rule outright.
- **Indexes**: `standards/context.md` tells a session to skip `index.md` because `canon indexes regen` rewrites it, and `655-tasks.md` forbids hand-editing the task index. Neither covers the `auto: false` escape. Coverage is partial and lands on the first candidate bullet.
- **Output**: no rule and no installed standard mentions the `**Created:**` grouping. The cut half loses the rule outright.
- **Tasks**: `standards/tasks.md` covers the `Plan:` link, the `../plans/` path, and the `../.tmp/plans-archive/` destination in full, and `655-tasks.md` names that file the single source. Coverage is complete.

One hook bears on the Indexes pair. `index-reminder.sh` fires on `Grep` and `Glob` and tells the session an `index.md` exists and should be read. That reinforces the Indexes bullet this pair keeps rather than either bullet it cuts, so it is a confound on attention rather than on the rule under test. Record whether it fired.

### Predictions

Fixed here so a miss cannot be reinterpreted afterward.

1. **Memory discriminates.** The kept half writes to `.canon/memory/` in the 3-line shape. The cut half writes the correction somewhere else or not at all. This is the cleanest candidate and the cheapest place to learn the method does not work.
2. **Indexes discriminates weakly.** Both halves should leave `canon/context/index.md` alone, since `standards/context.md` carries that much. A difference should appear on the `auto: false` escape alone, which nothing else covers, and the prompt may not reach it.
3. **Output discriminates on one bullet of three.** The grouping bullet is reachable through a prompt that creates, modifies, and deletes at once. The two worktree bullets are not reachable by a headless run in a single worktree, so a null on those two is evidence about the prompt.
4. **Tasks does not discriminate.** Governance covers both candidate bullets in full. A null here means the seed is duplicating an installed standard, which is the `v24.0` cut criterion rather than this task's.

### What counts as a difference

An observable change in what the session did, read from the transcript and the file diff rather than from the tone of the final message. A different file written, a rule followed in one half and not the other, or a question asked in one half alone. Turn count and cost are recorded and are not themselves differences, since both vary run to run at a fixed seed.

A single paired divergence is noise until a second pair reproduces it. Runs 01 and 02 reached the worktree rule by different routes with no seed change explaining it, so one difference is inside the run-to-run variation this harness has already shown.

### What a null licenses

Nothing on its own. `v24.0` files these sections as unreachable by an ordinary feature request and forbids cutting on that basis, and a null against a prompt that never reached the section is evidence about the prompt. A section earns a verdict only where the pair reached its trigger.

A null with a named mechanism is different from a bare null. Where governance covers a candidate in full and the pair confirms no behavioral difference, the cut rests on the redundancy rather than on the ablation, and the result document says which of the two carries it.

## Pass criteria

Verbatim from `05-experiment-design.md:21`. Applied to the context arm as written, and read across to the wireframes arm by its own standard's section names.

- Produces every required section, with no padded empty headings
- Puts irreducible content above recoverable content, per the ordering rule
- Does not hand-maintain a per-file tree or restate command help
- Records at least one real decision with its reasoning
- Needs no follow-up question to get there

## Reading the fifth criterion against a blocked write

"Needs no follow-up question to get there" is ambiguous when the harness blocks the write, and every run hits the same ambiguity. The judgment, fixed here so it does not get re-decided per run.

A run that ends by asking the operator to approve the path or re-run interactively passes this criterion. That is a request for operator action on a harness constraint, not a question about the authoring task, and the artifact is already complete in the same message. Score the artifact, not the delivery.

A run fails this criterion when it asks something it needed answered to write the entry, such as which domain the entry covers or which sections apply. That is the standard failing to be self-sufficient, which is what the criterion measures.

## Standing rule for this run

The outcome text accepts failure as a result. Do not iterate either standard against these results inside this task. A fix ships as its own change with the failure cited, per the change-control rule this task adopts.
