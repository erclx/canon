---
name: plan-intake
description: Files a raw brain dump into a numbered intake folder under `.canon/intake/<nn>-<slug>/`, one item per finding carrying a measured problem, a proposed fix, and a verdict. Use when asked to "file this dump", "triage my notes", "work through this list", "sort out this brain dump", or "run an intake pass". Do NOT use for one question that has to be measured before anyone can plan it. That is `plan-groundwork`.
metadata:
  family: decide
---

# Plan intake

Intake dispositions many findings in breadth. A dump goes in, an inventory comes out, and every item carries a problem measured against the tree, one proposed fix, and a verdict. An item found already settled is the highest-value output, and nothing else has a place for it.

Read `${CLAUDE_SKILL_DIR}/references/intake.md` before writing any file in the folder. It holds the numbering, the file map, the frontmatter and dating rules, the item format, and the answer contract. Do not work them from memory.

## Routing

The test is one question. Can the item be answered by reading the repository today?

- Yes: intake owns it, and the cost is a session of grepping
- No, because it needs an experiment or a source outside the project: route it to `plan-groundwork`, where the cost is measured in runs and days
- Already decided, with only the work left: route it to `plan-feature`

Apply the test per item rather than per dump. A dump of forty items typically yields one groundwork candidate, so routing the whole dump on its worst item buys a folder nobody can close.

The wrong surface fails either way. Intake on a question that needs measuring yields a confident verdict with nothing behind it, and groundwork refuses a brain dump through its own qualifying guard. Forced past that guard, it holds dozens of unrelated threads under a decision file that can close one.

## Guards

- If no dump is given, stop: `❌ No dump to file. Paste the notes or name what to triage.`
- If the dump is one question rather than a set of findings, stop: `❌ One question, not a dump. Run /plan-groundwork to measure it or /plan-feature to plan it.`
- Do not pause for approval between steps. The write scope below is what makes that safe.

## Write scope

- Write only inside `.canon/intake/<nn>-<slug>/`. Plans, tasks, source, standards, and rules all live outside it, so this one rule forbids every one of them.
- There is no exception. Promoting an item onto the board runs through `task-board` after the operator has answered, as a separate invocation.
- Reading is unrestricted inside the project. Measuring is the work.
- Treat the folder as gitignored. `canon records push` and `pull` back it up only where a records remote exists, and refuse with `no-remote` otherwise.
- A push protects against losing the machine, never against a compaction dropping reasoning before anyone pushed. No check reaches the folder, so these rules hold only while a session reads them.

Nothing outside this body carries the write-scope floor, and no path-scoped rule can, since a misrouted write lands on a path the folder's glob never matches. The rule shipping beside the intake standard carries the item format and answer contract instead.

## Step 1: detect open or resume

List `.canon/intake/` and match the topic against the slug half of each `<nn>-<slug>` folder before deriving a slug. A second pass rarely phrases the topic the way the folder was named, so a fresh slug opens a duplicate.

Never match against `.claude/` itself. It holds every other workflow surface, so a topic matched there lands on a folder that was never an intake.

### With no match

Derive a kebab-case slug named for the subject rather than the activity, preferring `toolkit-overview` over `august-triage`.

- Claim the ordinal and create the folder in one act with `canon records ordinal intake <slug> --claim`, per `${CLAUDE_SKILL_DIR}/references/intake.md`
- Where the installed binary carries no such subcommand, take the highest ordinal across `.canon/intake/` and `.canon/groundwork/`, incremented
- An absent folder opens. A present one resumes by appending items and revising verdicts the tree has moved under.

## Step 2: orient

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: behavior rules, conventions, commands
- `canon/REQUIREMENTS.md`: scope and non-goals
- `.canon/tasks/index.md`: what is already tracked. Open a task file whose entry looks related to an item.

Then read only what a live item needs, never whole directories speculatively. Where a folder carries an `index.md`, read it first and load only the files it points at.

## Step 3: measure against the tree

Grep for each construct an item names and count the sites. Every problem line carries a number or a file path taken during this pass.

- Never carry a figure from an earlier session, a summary, or another document. The tree states the size of a complaint, and that is what separates an inventory from opinions.
- Confirm any work an item sequences behind is still open, so no item leads with something already shipped
- Name the commit the pass measured against in the overview body, since that is the half a later reader can check

## Step 4: cluster

Split items by domain, one file per cluster, and let the file count follow the separable domains rather than the size of the dump. An item belongs to the domain its fix touches, not the one the complaint arrived from.

Two heading levels is the right depth. A third means the cluster should have been its own file.

## Step 5: disposition each item

Write every item in the standard's item format, in the cluster file its fix belongs to. Close each item with a verdict and an empty operator slot, and never fill that slot or read an empty one as agreement.

Where an item's call is the operator's, pair it with a suggestion rather than a bare question. The standard's item format is the whole spec.

## Step 6: write the index

Write `00-overview.md` last, once the clusters are filed and the counts are real. It carries the cluster table, the verdict counts, the ready list, and the open questions.

- Link each open question to its owning item's heading anchor, and put no answer slot in the index. Retrieval walks item headings, so an answer typed into the index is lost silently.
- Add `99-next-session.md` only where the pass ends holding context no cluster file carries, such as a dump half filed or a measurement to redo
- Write that file self-contained, since a compaction drops the conversation behind it whether or not the folder is backed

## Step 7: check the folder

Run `canon records validate intake <nn>-<slug>` on the folder this pass wrote, and fix each entry its `structure` array names before reporting. An `intake-spill` entry is content under a field that `canon intake list` never shows the operator, so move it onto the field's line or split the item.

- Pass the slug every time, since the bare kind reads every old dump and buries this one under their entries
- Read the array rather than the exit, which a structure entry never sets
- Say the check did not run when the binary carries no `structure` key, rather than reporting the folder clean

## Output

Emit the full relative path of every file written, with the heading and the act beside it. A bare path cannot tell three new items from one reworded sentence in a long-lived file, so the reader would diff against memory.

This overrides the paths-only reporting the project states generally, which stays right wherever the reader is about to see a diff. A file the pass only read gets no line.

```plaintext
📂 Opened .canon/intake/<nn>-<slug>/

**Filed:**

- `.canon/intake/<nn>-<slug>/05-coverage.md` gains items 6 to 8 under a new `## What the merge gate covers`
- `.canon/intake/<nn>-<slug>/00-overview.md` cluster rows and verdict counts updated

**Routing:** <N> ready to plan, <N> groundwork candidates, <N> already settled

**Open questions:** <N> awaiting your call

Next: /plan-intake-answer to answer the `You:` slots from here, or type them
into the files, then /task-board to promote what is ready
```

Use `📂 Resumed` in place of `📂 Opened` on a resume pass.

## Answering what this pass wrote

The operator answers the empty slots by editing each cluster file, or from chat through `plan-intake-answer`, which writes each selection back onto its item. Name that route in the closing line so the operator finds it.

Do not invoke it from here. It is operator-triggered, and a pass that files a dump and answers it in the same run decides items on silence.
