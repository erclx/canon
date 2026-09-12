---
name: plan-groundwork
description: Opens and runs a numbered groundwork folder under `.canon/groundwork/<nn>-<slug>/` for a topic that has to be measured before it can be planned. Detects open, resume, and close from the folder itself. Use when asked to "research X", "dig into X", "work out what we should do about X", "measure this before we commit", or "open a groundwork folder". Do NOT use to write a feature plan or to implement. That is `plan-feature`.
---

# Plan groundwork

Groundwork gathers and weighs. A plan commits. A groundwork folder costs nothing to throw away, which is what makes it the right container for a question nobody has answered yet.

Read `${CLAUDE_SKILL_DIR}/../../standards/groundwork.md` before writing any file in the folder. It holds the reserved numbers, the frontmatter and dating rules, what each required file carries, the conventions, and the anti-patterns. Do not work them from memory.

## Guards

- If no topic is given, stop: `❌ No topic. Name what needs measuring.`
- Apply the qualifying test in open mode alone, after Step 1 resolves the mode and before the folder is created. Two of these three must hold: the current state is not known, more than one approach is live, and committing wrong costs more than a day of measuring. When one or fewer holds, stop: `❌ Already decided enough to plan. Run /plan-feature instead.`
- Resume and close are exempt from the test above. A track that has already been measured fails it by definition, since its current state is now known and its approaches have narrowed, so applying the test to either mode refuses the folder that same test admitted.
- A refused topic that is a broad dump rather than one question routes to `plan-intake`, not to the planning skill the stop names. Intake dispositions many findings in breadth from what the repository already holds, and one folder holding dozens of unrelated threads is what forcing them past this guard produces.
- Do not pause for approval between steps. The write scope below is what makes that safe.

## Write scope

- Write only inside `.canon/groundwork/<nn>-<slug>/`. A feature plan, source changes, a standard, a rule, and a reference doc all live outside that folder, so this one rule forbids every one of them.
- One exception, at close only: write one task file recording what the track concluded.
- A second exception, for what a spike reads: write an input under `.canon/tmp/groundwork-fixtures/<slug>/`. Keep it out of `.canon/groundwork/` so mode detection never matches a fixture as a track. A fixture a headless run is pointed at goes outside the repository instead, per the rule in `## Running a spike`.
- What a spike produces stays inside the track rather than joining the two exceptions above: write evidence a spike file cites under `.canon/groundwork/<nn>-<slug>/evidence/`, which the first rule already permits. Mode detection matches entries at the top level of the tracks directory, so the sibling the fixtures rule guards against cannot be a folder nested inside a track, and the scratch path holds only what can be deleted without loss, which a recording a finding rests on is not.
- A `draft-and-pick` run invoked from inside a live track follows its own branch for this, writing to `evidence/` here rather than `.canon/tmp/<slug>/`.
- Reading is not restricted. External research is in scope, so read documentation, comparable projects, and papers whenever a live question needs them.
- Every claim about a source outside the project carries a link to it. A source found and not read is listed as a lead and is never cited.
- Treat the folder as gitignored and backed by `canon records push` and `canon records pull`, which protects it against the machine being lost but not against a compaction dropping this session's own reasoning before anyone has pushed, so `07-next-session.md` repeats what it needs instead of pointing at its siblings.

## Running a spike

A track may run an experiment to settle an open question without stopping to ask. What it takes depends on what the experiment does.

- Reading or computing: run it. Unrestricted reading already covers this, and it is what most spikes turn out to be.
- Writing a fixture this session reads or provisions itself: run it, under the fixtures path above. Provisioning is the usual blocker rather than spend, and it costs nothing.
- Spawning a billed headless session: run up to three, then ask before spawning more. The bound is a run count rather than a budget, because a headless run reports its total cost only after it finishes, so a dollar ceiling is reportable and not enforceable while a run count is checkable before spawning.

A fixture a headless run is pointed at goes outside the repository, under `mktemp -d`, and never under `.canon/tmp/`. A session started anywhere beneath the project root loads that project's `CLAUDE.md` and `.claude/rules/` through the ancestor chain, so an in-repo fixture measures the repository instead of the arm. Record the fixture as contaminated and re-run it outside if this is discovered after the fact, because the result reads as evidence either way.

Record method, result, measured cost, and caveats in `08-spikes.md`. Put whatever the run produced that the record cites in `evidence/` beside it, so a reader checking a claim opens the artifact rather than taking the prose for it. Reach for a test harness the project already carries before building one, and copy how it isolates its fixture rather than only what it asserts.

## Step 1: detect the mode

List `.canon/groundwork/` from the project root and match the topic against the slug half of each `<nn>-<slug>` folder already there before deriving anything. A resume pass rarely phrases the topic the way the folder was named, so a fresh slug derived from the wording would miss a live track and restart it.

Never match against `.claude/` itself. That directory holds every other workflow surface, so a topic matched there lands on a folder that was never a track.

With no match, derive a kebab-case slug named for the subject rather than the activity. Prefer `ts-migration` over `migration-research`. Also list `.canon/intake/` and take `<nn>` as the highest ordinal present across both listings, incremented, per `${CLAUDE_SKILL_DIR}/../../standards/groundwork.md`. Then route on `.canon/groundwork/<nn>-<slug>/`:

- Folder absent: open
- Folder present without `06-decision.md`: resume
- Present folder the user judges ready: close

Detect the mode from the folder. Do not ask which one to run.

## Step 2: orient

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules, conventions, commands
- `.claude/REQUIREMENTS.md`: scope and non-goals
- `.claude/ARCHITECTURE.md`: decisions already made
- `.canon/tasks/index.md`: what is already tracked, and what a prior track concluded. Open a task file only when its entry looks related.

Then read only what a live question needs. Do not read entire directories speculatively. Where a folder carries an `index.md`, read it first and load only the files it points at.

Do not dispatch subagents. A groundwork track is a conversation, and fanning out loses the reasoning that makes the folder worth keeping. A search too large to run inline is a finding that the question is too broad.

## Open questions in chat

The standard sets the open question format and requires it inside a topic file and in `00-scope.md`. Carry the same shape into the chat output, which sits outside the folder the standard governs. A bare numbered list hands the reader a quiz and defers the judgment the track exists to inform.

## Open mode

1. Create `.canon/groundwork/<nn>-<slug>/`, with `<nn>` and `<slug>` as derived in Step 1.
2. Write `README.md` first. Writing it first forces the question of what the track is for.
3. Write `01-current-state.md` by measuring now. Never carry a figure from a previous session or from recall without re-measuring it. Measure only what an open question in the folder needs. A number with no question attached is how groundwork turns into the work.
4. Write `00-scope.md` when the track is large enough to run away. Skip it on a small track.
5. Add topic files at `02` through `05` as the subject demands. Close each one with its open questions in the standard's format.
6. Keep going. Revise, reframe, and take correction as the questions move. The folder is meant to be rewritten.

## Resume mode

1. Read `README.md` and its file map first, then the numbered files in order.
2. Do not re-measure what `01-current-state.md` holds unless the project moved under it. When it did move, re-measure and mark what changed.
3. Continue from the open questions carried at the end of each file. Add or rewrite files as those questions move.
4. Update the file map in `README.md` whenever a file is added or retired.

## Close mode

1. Write `06-decision.md`. It states the problem once, names the goal, lists what to do, and lists what was considered and dropped.
2. Write `07-next-session.md` self-contained, so it survives a compaction that loses the conversation.
3. Update the file map in `README.md`.
4. Write one task file in `.canon/tasks/` recording what the track concluded, even when the conclusion is to do nothing. Follow `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` for the filename and frontmatter. Place the row through `task-board` Step 4, which checks the roster for a live orchestrator before writing `priority.md` or `backlog.md` directly. Aside from an experiment fixture, this and the routing in Step 5 are the only ways close mode reaches outside the folder.
5. When the task written in Step 4 does not cover every finding the track surfaced, route what it leaves out through `plan-intake`. Skip this step when it does.
6. Report uncited external claims. Closing already reads every file in the folder, so list any statement about a source outside the project that carries neither a link nor a lead entry. Report and do not block, because judging whether a sentence makes an external claim is the call a checker gets wrong.

Do not close while an open question quietly fails an outcome. Resolve it, or record it in `06-decision.md` as knowingly accepted.

## Output

Emit the full relative path from the project root for every file written or updated. A bare filename names a file the reader cannot open.

Open and resume:

```plaintext
📂 Opened .canon/groundwork/<nn>-<slug>/

**Written:**

- `.canon/groundwork/<nn>-<slug>/README.md`
- `.canon/groundwork/<nn>-<slug>/01-current-state.md`

**Open questions:**

1. <question>
   - Leaning: <where the evidence currently points>
   - Overturned by: <the finding that would change it>
```

Use `📂 Resumed` in place of `📂 Opened` on a resume pass.

Close:

```plaintext
✅ Closed .canon/groundwork/<nn>-<slug>/

**Written:**

- `.canon/groundwork/<nn>-<slug>/06-decision.md`
- `.canon/groundwork/<nn>-<slug>/07-next-session.md`

**Uncited external claims:** <count, or none>

- `<file>`: <the claim>

<the decision in one line>

Next: /plan-feature
```

Omit the uncited-claims block when the count is zero.
