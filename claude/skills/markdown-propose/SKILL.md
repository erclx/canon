---
name: markdown-propose
description: Reviews a named markdown surface against a named concern, drafts a per-file proposal under `.canon/proposals/<nn>-<slug>/` carrying a diff and a reason for each change, and stops without editing a source file. Takes the concern and the surface as inputs, such as a claim stated stronger than the record, a fact gone stale, two files disagreeing, or a passage duplicated without derivation. A later invocation applies what the operator answered. Use when asked to "propose a change to CLAUDE.md", "draft a rewrite of this standard", "propose fixes to this doc", "draft alternatives for this passage", or "apply the answered proposals". Do NOT use to report without drafting a replacement (`standards-audit` or `canon markdown audit`), to review a diff already made (`review-branch`), or to file a raw brain dump as findings (`plan-intake`).
---

# Markdown propose

Reviews what a markdown surface says against a named concern and proposes what it should say instead. Writes proposals and stops. The operator answers per change, and a later invocation applies the answered set.

The value is the gate. A rewrite delivered in chat gets applied from memory across files nobody reopened, and nothing records what was approved.

## Guards

- No concern named and none derivable from the conversation. Stop: `❌ No concern to screen for. Name what looks wrong, or the surface to review.`
- No surface named and none derivable. Stop: `❌ No surface to review. Name the files, or the folder, to screen.`
- The concern resolves to one file only. Stop and say so: a single-file change needs no proposal folder.
- A named file cannot be read. Stop and name it. Do not screen what resolved and report a partial result.

## Phase detection

Two phases share this body, picked by whether a proposal folder already exists for the request's slug.

Derive `<slug>` from the concern and the surface, kebab-case, naming the subject rather than the activity. List `.canon/proposals/` at the main worktree root and match the topic against the slug half of each `<nn>-<slug>` folder already there before deriving a fresh one, the same way `plan-intake` matches its own folder. Never match against `.claude/` itself.

With no match, a fresh folder takes the next ordinal in `.canon/proposals/`'s own sequence: list the folders present, take the highest `<nn>`, and increment it, starting at `01` when none exist. That sequence is independent of the one `intake` and `groundwork` share, so a proposals folder never reads or claims from theirs.

- No matching folder, or the operator names a concern and a surface: **Propose**.
- A matching folder exists and the operator says apply, ship, or commit the answers: **Apply**.

All `.canon/proposals/` reads and writes resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.

## Write scope

Write only inside `.canon/proposals/<nn>-<slug>/`. A source file, a standard, a rule, and a plan all live outside that folder, so this one rule forbids every one of them during the Propose phase. The Apply phase is the one exception, and only for a change carrying a `You:` answer.

## Concerns

The concern is an input, not a flow toggle. The passes below are one procedure and the concern decides what pass 1 looks for.

| Concern       | What it looks like                                                   |
| ------------- | -------------------------------------------------------------------- |
| Inflation     | a claim stated stronger than the record supports                     |
| Staleness     | a fact correct when written and wrong now, usually a date or a count |
| Contradiction | two files, or two sections, asserting incompatible things            |
| Duplication   | one passage copied across files with no derivation, drifting apart   |

The operator may name a concern outside this table. Run the same procedure against it.

## Propose phase

Read `${CLAUDE_SKILL_DIR}/references/format.md` before writing anything. Do not work the proposal format from memory.

### 1. Find the sites

Grep the named surface for the concern and its near-variants. A defect rarely repeats verbatim, so search the habit rather than the string.

Count hits per file before reading them. A file with one hit and a file with eight are different problems.

### 2. Find what it should say

Read whatever the operator names as the authoritative source for the concern. Absent one, grep the rest of the tree for a passage already stating the corrected form, since a correct version often already exists somewhere the defect has not reached.

Report a file that contradicts itself. A file holding both the defect and its corrected form is the strongest finding available, because the replacement is already drafted somewhere in the tree and needs no invention.

### 3. Judge per line, not per match

A matched string means different things in different registers. A word describing a mechanism is a fact about how something works. The same word describing reach is a claim about who relies on it. Sweeping both because they share a string is what makes the next pass harder to trust.

### 4. Write the proposals

One file per source file under `.canon/proposals/<nn>-<slug>/`, per `${CLAUDE_SKILL_DIR}/references/format.md`.

Draft the replacement text. A proposal reporting a problem without a replacement hands the work back rather than doing it.

Carry an `Open:` on any change whose replacement was written rather than corrected, and give it three variants per the format reference. Correcting an overstatement to the recorded fact has one answer. Inventing a paragraph has no right answer, and one draft asks the operator to veto instead of to choose, which costs a round every time the intent lands wrong.

Separate the two kinds before drafting. A change that deletes a claim the record does not support is cheap and rarely argued. A change that writes new prose is where the effort belongs.

Close each file with what it leaves alone, and say why those lines survived.

### 5. Report

Name the count, the files, and the single highest-value change. Point at the folder and stop.

Do not edit a source file. Do not fill a `You:` slot.

Propose in dependency order and state it in `00-overview.md` when the surface spans more than two files. A file other files quote is settled first, otherwise the same wording gets decided twice.

## Apply phase

Read `${CLAUDE_SKILL_DIR}/references/format.md` before applying anything, if this session has not already read it this pass.

Follow the Applying section there: one file at a time in settle order, every answered change in that file and nothing unanswered, re-grepping each anchor before applying it, sweeping the other named surfaces for the same claim before committing, and moving an applied change into `applied.md`.

Report the counts once the pass stops: files committed, changes applied, changes still carrying an empty `You:`. Leave the folder in place. Neither phase deletes it.

## Output

Chat output is the report. This skill persists only the proposal folder itself.

```plaintext
📂 Opened .canon/proposals/<nn>-<slug>/

**Screened:** <N> files, <N> changes proposed, <N> carrying three variants

**Highest value:** <the single strongest change, one line>

Next: answer the `You:` slots in the files under .canon/proposals/<nn>-<slug>/,
then re-invoke this skill to apply what you answered.
```

Use `📂 Resumed` in place of `📂 Opened` on a resume pass. The Apply phase reports instead:

```plaintext
✅ Applied .canon/proposals/<nn>-<slug>/

**Committed:** <N> files, <N> changes

**Still open:** <N> changes with an empty `You:`
```
