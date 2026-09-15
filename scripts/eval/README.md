# Authoring test

Regression test for an always-loaded authoring artifact. The standards arms answer whether a session that has never seen a standard can author a conforming artifact from that standard alone. The seed arm answers whether a session handed a project scaffolded from the Claude seed can work in it without asking for context the seed should have carried.

This is a spec-quality test, not an efficacy test. It says nothing about whether the resulting artifact is useful, which is the separate ablation designed in the `context-research` groundwork track. No baseline arm and N of 1 are correct here, because failure is self-evident: a session that reads the standard and still writes a per-file tree has proved the standard failed to communicate its own central rule.

The folder sat at `scripts/standards/authoring-test/` while standards were all it tested. The seed arm made that placement wrong, since the seed is a tooling artifact rather than a standard, so it moved here at three referencing files rather than after the next arm made the move expensive. It stays unreachable from `canon`: a run spends real money, and authorizing that spend is the operator's. Performing the run is not, so a session holding a shell drives `run.sh` itself once the spend is authorized.

## Running

```bash
scripts/eval/run.sh context      # standards/context.md
scripts/eval/run.sh wireframes   # standards/wireframes.md
scripts/eval/run.sh seed         # tooling/claude/seeds/
```

A second argument records why the run was started, either `findings` or `regression`, and defaults to `findings`. The harness cannot infer it, since guessing from whether the verdict changed would mislabel a regression run that happens to find something. Pass it on the runs that confirm nothing broke. An ablation half takes a third value the runner writes for itself, covered below.

```bash
scripts/eval/run.sh seed regression
```

A third argument runs one half of an ablation pair against the seed arm, as `<section>-kept` or `<section>-cut` over `memory`, `indexes`, `output`, and `tasks`. The `cut` half removes that section's candidate lines from the installed `CLAUDE.md` and the `kept` half leaves them in. Both halves carry the same section-specific prompt, so the pair differs in the seed and in nothing else.

```bash
scripts/eval/run.sh seed findings memory-kept
scripts/eval/run.sh seed findings memory-cut
```

Both halves are labeled rather than pairing a bare `seed` against a cut variant. The bare arm carries the ordinary feature request, which reaches none of these sections, so pairing against it would vary the prompt and the artifact at once. The label lands in the ledger's `Arm` column as `seed-memory-cut`, which sorts a pair together.

A variant records its `Kind` as `ablation` and ignores the second argument. The runner sets it because a variant carries its own reason for existing, unlike an ordinary run. It also keeps the two meanings of `Verdict` apart: under `findings` and `regression` the cell says whether the artifact conformed, and under `ablation` it says whether the pair discriminated. Counting those together answers neither question.

The strip anchors on each bullet's text and fails the run when an anchor stops matching exactly one line. A cut half that silently kept its section is indistinguishable from its partner in every artifact the run leaves behind, so it would read as a null result rather than as a broken run.

Each run spawns one headless `claude -p` session. Measured cost is $0.59 for the context arm and $0.74 for the wireframes arm, both around 15 to 20 turns. Budget roughly a dollar per arm. Judged output prints to stdout and the cost line to stderr, so redirecting stdout captures the result alone.

The runner passes `--dangerously-skip-permissions`. The flag grants tool use across the filesystem rather than within a directory, so the disposable fixture is not what makes it acceptable.

What makes it acceptable is the task: the cwd is the fixture, the prompt names one file to write, and no credential or repo path is in reach of the instruction. Copy the flag only where the same three hold. The reason it is needed rather than `acceptEdits` is in Known harness behavior below.

A permission classifier in the calling session can refuse to spawn that nested session. That is a reason a given run lands back with a person rather than a reason no session may start one, so drive the arm and hand the command back if the refusal fires, never route around it.

The runner copies the live `standards/<name>.md` in at run time rather than using a pinned copy, so the test always exercises the current standard.

## The seed arm

The standards arms copy one document into the fixture and judge one produced file. The seed arm differs on both counts.

It installs through the real CLI, `canon claude init` followed by `canon gov install base`, rather than copying `tooling/claude/seeds/` across. Copying would skip the executable bit on the four hooks and the `settings.json` merge that registers them, which is a third of the seed and a state no project is ever in. No standards call sits between them, since the corpus installs into no project and each rule the stack registers names `canon standards <name>`, which answers from the copy inside the package.

The CLI runs by path, never as the globally linked `canon`. `PROJECT_ROOT` resolves from the CLI's own source directory, so a global binary installs the main checkout's seed and silently ignores the edits under test.

Git is initialized after the install, so the seed's `.gitignore` means something and the rules that shell out to git are reachable. A section the fixture puts out of reach cannot be judged unused.

The arm judges the transcript rather than an artifact, because the finding is which questions the session asked and which seed files it opened. That needs `--output-format stream-json`, since only the per-turn `tool_use` blocks carry real `file_path` values. Never grep a transcript for a filename: the seed names its own paths, so a grep hits the instruction text rather than a read of the file.

## Why the fixture is a tarball

The fixture has to be extracted outside this repository before it runs. A fixture sitting under the repo would load the toolkit's own `CLAUDE.md` through the ancestor chain, and the session under test would arrive already knowing the conventions the test is trying to measure. The runner extracts to `mktemp -d` and cleans up on exit.

`fixture.tar.gz` holds a synthetic tool called `feedwatch` in three arms: `ctx-arm` for the context standard, `wf-arm` for the wireframes standard, and `seed-arm` for the Claude seed. Synthetic rather than a real domain, because every domain in this repo already carries an entry, and a real domain would let the session pattern-match from prior exposure instead of from the standard. The seed arm ships with no `.claude/` and no `CLAUDE.md`, since the installer puts both there.

## Reading a result

`pre-registration.md` fixes what counts as a hit before any run. It names the decisions planted in the fixture source and the pass criteria per arm. Read it before judging output, so a miss cannot be reinterpreted after the fact.

Three decisions are planted in the context arm and three layout intents in the wireframes arm. Each carries its reasoning in a code comment rather than in a doc, so recording it requires reading code and judging that it matters.

The seed arm sorts every seed section into exactly one of three buckets: exercised, unreachable by this task, or reachable and ignored. Only the third justifies an edit. Fixing the buckets before the run is what stops a trim from being rationalized afterward, which is the failure the seed audit exists to avoid.

## Known harness behavior

`--permission-mode acceptEdits` is not enough. It treats paths under `.claude/` as sensitive and a non-interactive session cannot get approval, so the run either returns the artifact in its final message, routes around the block and writes somewhere unexpected, or gives up and writes nothing. All three happened across three runs before this was diagnosed.

Fixture-local settings do not fix it. An untrusted workspace makes Claude Code ignore `permissions.allow` outright, and a `mktemp` path is never trusted. Skipping permissions is what remains.

The runner also snapshots the fixture before the run and recovers any markdown created during it, so an artifact written to an unexpected path still survives. Recovered artifacts print first, followed by an HTML comment marking where the run's own commentary begins.

A missing file at the requested path is a harness result, never a standard failure. Judge the artifact.

## What a run leaves behind

Every run appends a row to `ledger.md` and copies its raw output to `.canon/tmp/runs/eval/<arm>-<timestamp>/`. The row is committed and the output is gitignored, which splits the durable record from the bulky one: a transcript carries the full text of every file the session read, so a hundred retained runs is a repository hundreds of megabytes larger for every clone.

Both writes are additive. A failure to record warns on stderr and the judged result still prints, since stdout is the data contract.

The ledger row lands with its verdict set to `pending`. Whoever reads the report edits that cell. Nothing prunes the retained output, and clearing it by hand loses the paths the ledger points at.

Promote a transcript into the arm's result document by hand on the day it becomes evidence for a specific claim. That keeps the default cheap and the exception deliberate.

## Results on file

`result-context.md` is the 2026-07-31 run against `standards/context.md`, the run that first exercised the success criterion. Passed all five criteria and recovered all three planted decisions unprompted.

`result-wireframes.md` is the 2026-07-31 run against `standards/wireframes.md`. Passed all five criteria. It correctly withheld the rejected-modal rationale that the standard routes to `.claude/context/`, which is the rule most likely to be ignored, and named what it was withholding. Its Harness history section records the two inconclusive attempts that preceded it and the fixes each one forced.

The two results are not parity, and the record says so. The context arm ran with its criterion already present, so it measures the standard as it ships. The wireframes arm ran before its criterion existed, so it measures the shape rules alone and the criterion written from it has never been exercised.

Both standards passed, which is a finding about the harness rather than about either standard. A test that has confirmed twice and discriminated zero times has not yet shown it can fail anything. Treat a pass as weak evidence until one arm fails.
