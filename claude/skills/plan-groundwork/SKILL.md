---
name: plan-groundwork
description: Opens and runs a numbered groundwork folder under `.canon/groundwork/<nn>-<slug>/` for a topic that has to be measured before it can be planned. Detects open, resume, and close from the folder itself. Use when asked to "research X", "dig into X", "work out what we should do about X", "measure this before we commit", "open a groundwork folder", or "retell the groundwork". Do NOT use to write a feature plan or to implement. That is `plan-feature`.
metadata:
  family: decide
---

# Plan groundwork

Groundwork gathers and weighs. A plan commits. A groundwork folder costs nothing to throw away, which is what makes it the right container for a question nobody has answered yet.

Read `${CLAUDE_SKILL_DIR}/references/groundwork.md` before writing any file in the folder. It holds the reserved numbers, the frontmatter and dating rules, what each required file carries, the conventions, and the anti-patterns. Do not work them from memory.

## Guards

- If no topic is given, stop: `❌ No topic. Name what needs measuring.`
- Do not pause for approval between steps. The write scope below is what makes that safe.

### The qualifying test

Apply it in open mode alone, after Step 1 resolves the mode and before the folder is created. Two of three must hold, being an unknown current state, more than one live approach, and a wrong commitment costing more than a day of measuring.

- When one or fewer holds, stop: `❌ Already decided enough to plan. Run /plan-feature instead.`
- Resume and close are exempt, since a measured track fails the test by definition and applying it would refuse the folder it admitted
- A refused topic that is a broad dump rather than one question routes to `plan-intake`, which dispositions many findings in breadth, not to the planning skill the stop names

## Write scope

Write only inside `.canon/groundwork/<nn>-<slug>/`. A feature plan, source changes, a standard, a rule, and a reference doc all live outside it, so this one rule forbids every one of them.

- One exception, at close only, is one task file recording what the track concluded
- A second exception is a large fixture a spike reads as bulk input, under `.canon/tmp/runs/groundwork-fixtures/<slug>/` so mode detection never matches it as a track
- A fixture a headless run is pointed at goes outside the repository instead, per `## Running a spike`
- An arm script and a checkout a claim rests on are not fixtures, and go inside the track under `scripts/` and `clones/`, per the standard

### Evidence and drafts

What a spike produces stays inside the track, under `.canon/groundwork/<nn>-<slug>/evidence/`, which the first rule already permits. Mode detection matches only top-level entries, so a nested folder cannot be mistaken for a track, and scratch holds only what can be deleted without loss.

A `design-pick` run invoked from inside a live track follows its own branch for this. It writes its renders to `evidence/` here, and drafts its candidates as pages on the Frameboard board `design-pick` resolves, where its close removes the round. On a board `canon/config/design.toml` names, the close keeps the picked page.

### Reading and backing

Reading is not restricted, so read documentation, comparable projects, and papers whenever a live question needs them. Invoke `canon:search-craft` with the skill tool before an outside search, and report it rather than proceeding silently when the skill does not resolve.

- Every claim about a source outside the project carries a link to it. A source found and not read is listed as a lead and is never cited.
- Treat the folder as gitignored. `canon records push` and `canon records pull` back it up where a records remote is configured, and refuse with `no-remote` otherwise.
- Neither protects against a compaction dropping unpushed reasoning, so `07-next-session.md` repeats what it needs instead of pointing at its siblings

## Running a spike

A track may run an experiment to settle an open question without stopping to ask. What it takes depends on what the experiment does.

| Experiment                                | What it takes                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Reading or computing                      | Run it, since unrestricted reading covers it                           |
| Processing an input                       | Start on a sample and scale up after it works, per the sample rule     |
| Writing a fixture this session provisions | Run it under the fixtures path above, since provisioning costs nothing |
| Spawning a billed headless session        | Run up to three, then ask before spawning more                         |

The sample rule in `${CLAUDE_SKILL_DIR}/references/groundwork-spikes.md` bounds an input run on size, duration, and spend. The headless bound is a run count because a run reports its cost only after it finishes, so a count is checkable before spawning and a dollar ceiling is not.

### Headless fixtures

A fixture a headless run is pointed at goes under `mktemp -d`, never under `.canon/tmp/`. A session started beneath the project root loads its `CLAUDE.md` and `.claude/rules/` through the ancestor chain, so an in-repo fixture measures the repository instead of the arm.

Record a fixture found in-repo after the fact as contaminated and re-run it outside.

### Recording a spike

Record method, result, measured cost, and caveats in `08-spikes.md`. Put whatever the record cites in `evidence/` beside it, so a reader opens the artifact rather than taking the prose for it, and keep the arm scripts in `scripts/`.

Reach for a test harness the project already carries before building one, and copy how it isolates its fixture rather than only what it asserts.

## Step 1: detect the mode

List `.canon/groundwork/` from the project root and match the topic against the slug half of each `<nn>-<slug>` folder before deriving anything. A resume pass rarely phrases the topic the way the folder was named, so a fresh slug would miss a live track and restart it.

Never match against `.claude/` itself. That directory holds every other workflow surface, so a topic matched there lands on a folder that was never a track.

### No match

Derive a kebab-case slug named for the subject rather than the activity, preferring `ts-migration` over `migration-research`. That is open mode outright, since no folder can carry a slug nothing matched. Open mode Step 1 claims `<nn>`, after the qualifying test runs.

### A matched folder

A matched folder routes on its own `<nn>-<slug>/`. Detect the mode from the folder rather than asking which one to run.

- Present without `06-decision.md`: resume
- Present and the user judges it ready: close
- Present and the user asks for a retell: read the track and end on the retell, measuring and writing nothing

## Step 2: orient

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules, conventions, commands
- `canon/REQUIREMENTS.md`: scope and non-goals
- `.canon/tasks/index.md`: what is already tracked, and what a prior track concluded. Open a task file only when its entry looks related.

Then read only what a live question needs, never whole directories speculatively. Where a folder carries an `index.md`, read it first and load only the files it points at. For each domain the topic touches, read its context entry ahead of measuring, through the lookup in `${CLAUDE_SKILL_DIR}/../plan-feature/references/onboarding.md`.

Do not dispatch subagents. A groundwork track is a conversation, and fanning out loses the reasoning that makes the folder worth keeping. A search too large to run inline is a finding that the question is too broad.

## Open questions in chat

The standard sets the open question format inside a topic file and in `00-scope.md`. Carry the same shape into the chat output, since a bare numbered list hands the reader a quiz and defers the judgment the track exists to inform.

## Open mode

1. Claim the ordinal and create the folder in one act with `canon records ordinal groundwork <slug> --claim`, per `${CLAUDE_SKILL_DIR}/references/groundwork.md`.
2. Where the binary carries no such subcommand, list `.canon/groundwork/` and `.canon/intake/` and take the highest ordinal across both, incremented.
3. Write `README.md` first. Writing it first forces the question of what the track is for.
4. Write `01-current-state.md` by measuring now, never carrying a figure from recall. Measure only what an open question needs, since a number with no question turns groundwork into the work.
5. Write `00-scope.md` when the track is large enough to run away. Skip it on a small track.
6. Add topic files at `02` through `05` as the subject demands. Close each one with its open questions in the standard's format.
7. Keep going. Revise, reframe, and take correction as the questions move. The folder is meant to be rewritten.

## Resume mode

1. Read `README.md` and its file map first, then the numbered files in order.
2. Do not re-measure what `01-current-state.md` holds unless the project moved under it. When it did move, re-measure and mark what changed.
3. Continue from the open questions carried at the end of each file. Add or rewrite files as those questions move.
4. Update the file map in `README.md` whenever a file is added or retired.

## Close mode

1. Write `06-decision.md`, stating the problem once, the goal, what to do, and what was dropped. Carry each adopted lean's "Overturned by" line into `## Revisit when`.
2. Write `07-next-session.md` self-contained, so it survives a compaction that loses the conversation.
3. Update the file map in `README.md`.
4. Write one task file in `.canon/tasks/` recording the conclusion, even when it is to do nothing, per `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`. Place its row through `task-board` Step 4.
5. When the task written in Step 4 does not cover every finding the track surfaced, route what it leaves out through `plan-intake`. Skip this step when it does.
6. Report each statement about an outside source carrying neither a link nor a lead entry. Report and do not block, because judging what counts as an external claim is the call a checker gets wrong.

Aside from an experiment fixture, Steps 4 and 5 are the only ways close mode reaches outside the folder. Do not close while an open question quietly fails an outcome. Resolve it, or record it in `06-decision.md` as knowingly accepted.

Name `proposal-critique` in the close report when the decision is a one-way change or a fix whose cause is unverified, and never invoke it from here.

## Check the folder

Run `canon records validate groundwork <nn>-<slug>` on the folder this run wrote, in every mode, before reporting. Fix each entry its `structure` array names, against `### Structure` in `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`.

- Pass the slug every time, since the bare kind reads every old track and buries this one under their entries
- Read the array rather than the exit, which a structure entry never sets
- Say the check did not run when the binary carries no `structure` key, rather than reporting the folder clean

## Output

Emit the full relative path from the project root for every file written or updated, since a bare filename names a file the reader cannot open. Read `${CLAUDE_SKILL_DIR}/references/output.md` on reaching this step for the open and resume template, the retell, and the close template. A run that stops on a guard skips it.

End on the retell in place of the open and resume template once every open question carries a lean. A question marked `none, needs measuring` keeps the open and resume template, unless the operator asks for a retell, which answers whatever the state. The retell lists written files under `**Written:**`, and close keeps its one-line report.
