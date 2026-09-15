---
name: memory-review
description: Reviews `.canon/memory/` and proposes per-entry actions (promote to an always-loaded rule, move into a skill body, route to a context entry, hand off to governance, or retire as stale). Also runs the discuss, challenge, apply, and cleanup phases on an existing review file. Use when asked to "review memory", "discuss memory questions", "challenge the promotes", "apply memory decisions", "cleanup memory review", "promote memory", or "consolidate memories". Do NOT auto-apply. Output a grouped proposal and wait for block-by-block approval.
---

# Memory review

This skill drives the full memory review lifecycle in five phases. Pick the phase from what the user said and whether a review receipt already exists at `<main-root>/.canon/memory/review/memory-review-*.md`.

What an entry looks like and why a retired one is moved rather than deleted are fixed by `${CLAUDE_SKILL_DIR}/../../standards/memory.md`. Read it before rewriting an entry, since a promotion rewrites the rule and a rewrite has to leave the entry conforming.

| User intent                                                            | Phase     | Mutates                      |
| ---------------------------------------------------------------------- | --------- | ---------------------------- |
| "review memory", "promote memory", "sweep stale memories" (no receipt) | Propose   | review file only             |
| "challenge the promotes" (receipt exists)                              | Challenge | review file only             |
| "discuss", "respond to questions"                                      | Discuss   | review file only             |
| "apply decisions", "commit", "ship the review"                         | Apply     | tracked files + memory files |
| "cleanup", "delete the receipt"                                        | Cleanup   | one receipt + its skips      |

If the user re-pings the skill with no new phrase and a receipt exists, default to Discuss when any `Decision:` contains `?`, otherwise Apply.

## Guards

- All `.canon/memory/` reads, edits, and archive moves resolve at the main worktree root, not the current worktree. Resolve that root the way `session-worktree` does.
- If no `.canon/memory/` directory exists at the main worktree root, stop: `❌ No .canon/memory/ directory found.`
- If `.canon/memory/` contains no top-level `*.md` entries other than `index.md`, stop: `✅ No memory entries to review.` The pen holds two subfolders now, `review/` and `archive/`, and neither is a memory entry, so this count and every entry read below stay at the top level and never recurse into either.
- Cleanup is exempt from the two stops above. It works on receipts in `.canon/review/`, and a drained pen is the normal state once Apply has run, so a pen-shaped stop would strand the receipt it exists to delete.
- Resolve the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd`. All review and memory reads anchor here.
- From a linked worktree the file-editing tools refuse every main-root path, so each write below goes out through `Bash` as a plain single command. The receipt and a memory entry are both short and this session has read them whole, so a rewrite replaces the file with a heredoc rather than editing a line inside it. Promotion targets are tracked files at `pwd` and keep taking `Edit`.

## Propose phase

Propose is the ship-time entry point. The ship skills run it right after capture, so the fix is written while session context is fresh.

### Scope

- **Ship-scoped:** when a ship caller (`git-ship`, `auto-ship`) names the entries captured this session, classify only those entries. Read the full pen for merge and absorbed comparison, but do not propose actions on carried entries the captures do not touch. Each carried entry was already proposed on in its own ship cycle.
- **Full sweep:** when invoked standalone with no named set, classify every entry in the pen, including entries carried from earlier sessions, so cross-session duplicates merge into one rule.

### Step 1: read the memory folder

Read in parallel from the project root:

- `.canon/memory/index.md`: the generated index
- every other top-level `*.md` file in `.canon/memory/`, never its `review/` or `archive/` subfolders: individual entries with frontmatter (`title`, `description`, `category`)

### Step 2: read promotion targets

Read in parallel from the project root. Skip any file or folder that does not exist.

- `CLAUDE.md`: project behavior rules and Content ownership section, still a read target for the absorbed-already check even though it takes no new promotion
- every `SKILL.md` under `.claude/skills/`: domain-scoped internal skill bodies
- every `SKILL.md` under `claude/skills/`: plugin skill bodies
- every `*.md` under `${CLAUDE_SKILL_DIR}/../../standards/`: authoring references
- every `*.md` under `governance/rules/` in the toolkit repo, or `.claude/rules/` in a target project: coding-standards rules
- every `*.md` under `internal/rules/` in the toolkit repo, or `.claude/rules/project/` in a target project: always-loaded rules a promote lands in

### Step 3: classify each entry

`.canon/memory/` is a holding pen. Default every entry to promote or retire on review. Skip is the rare exception, reserved for active task overlap or user-type memories with no in-repo target.

`memory-capture` routes a project fact naming a domain with a context entry to that entry, so a pen filled since routing shipped is mostly feedback: rules about how to work, which no context entry owns. Propose against what the pen holds rather than expecting the older mix. An entry carried from before routing may still name a domain that has a context entry, and that entry's action is **Promote to a context entry**, which hands it to `docs-fold` the same way capture does rather than editing the entry here.

For each in-scope entry (see Scope), pick one action:

- **Promote to an always-loaded rule**: the rule is cross-domain behavior or a design principle applied across the whole project, passing `592-claude-md.md`'s test (applies every session regardless of what is being edited). Do not author a toolkit rule file inline.
  - In the toolkit repo, hand off to `internal-governance` and `${CLAUDE_SKILL_DIR}/../../standards/rule.md`, which own `internal/rules/core/` (this repo only, never ships) and `governance/rules/core/` (ships to every target).
  - In a target project, append the rule to an existing file under `.claude/rules/project/` with `Edit`, since a project rule is project-owned and sync never overwrites it, or hand off to the `create-rule` skill when no existing file fits.
- **Promote to a skill body**: the rule fires only when editing a specific path-scoped domain. Name the target skill.
- **Promote to a standards file**: the rule is an authoring reference that belongs in the project's own standards folder as `<domain>.md`.
- **Promote to a context entry**: the entry states a fact about a domain carrying an entry in `canon/context/index.md`. Append it to `.canon/tmp/memory-routing/<slug>.md` at the main worktree root, in the format `memory-capture` writes, and tell the user to run `/docs-fold` from a branch. Do not edit the context entry here. A project-identity or command fact takes this action when a context entry owns the subject, such as a development entry for commands, and **Retire** otherwise, naming a hand edit to `CLAUDE.md` as the reason. Memory review does not write the root file itself.
- **Hand off to governance**: the rule is coding-standards class (typescript, testing, naming, error-handling, performance, logging, concurrency, planning), never a cross-domain behavior rule. Do not author the rule file inline. Never edit the synced `.claude/rules/` copies of toolkit rules, because `canon gov sync` overwrites them. Stop at handoff. This and **Promote to an always-loaded rule** never both claim one entry: class names the topic (coding-standards routes here), firing axis names the rest (applies-every-session routes to the rule promote).
  - In the toolkit repo, point the user at `internal-governance` and `${CLAUDE_SKILL_DIR}/../../standards/rule.md`, which own the source-of-truth rules under `governance/rules/`.
  - In a target project, point the user at the `create-rule` skill, which scaffolds a project-local rule under `.claude/rules/`.
- **Retire**: the rule is stale, already absorbed into a durable surface, too vague to phrase as a rule, or a one-time incident narrative. Apply moves the file to `.canon/memory/archive/` rather than deleting it.

Retire is an archive, not a deletion, which `${CLAUDE_SKILL_DIR}/../../standards/memory.md` states as the rule and this skill executes. The archive is worth less than a plan's, since a promoted entry survives in its destination and a stale one is discarded on purpose, which is why the move is cheap rather than free.

When two or more memories collapse into one rule on the same target, propose them as a single merged edit under the matching promote category. The consolidate case is a variant of promote, not a separate action.

#### Absorbed-already check

Before proposing promote, grep the target surface for the rule's keywords. If the rule is already stated there, the action is **Retire**, not promote. Do not rely on memory-file claims that a rule is documented elsewhere. Verify.

The check covers implication, not only keyword match. If an adjacent bullet in the target section already implies the rule, merge into that bullet rather than append a second.

#### Crispness check

Rules that resist crisp one-line phrasing default to **Retire** over promote. Never promote a memory unchanged. Rewrite to match the destination surface's tone. Use single-directive rule-bullet phrasing for an always-loaded rule and imperative phrasing for skill bodies.

### Step 4: write the proposal to the review file

Derive `<slug>` per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. Fall back to `latest` on an empty result.

Write the full proposal to `.canon/memory/review/memory-review-<slug>.md` at the main worktree root. Do not print it inline. Read `${CLAUDE_SKILL_DIR}/references/receipt-format.md` for the file structure, the item template, and how each action type varies the body. The four phases below rewrite items inside an existing receipt rather than authoring one, so none of them opens it.

A phase changing items reads the receipt, applies every change for that phase, and writes the whole file back in one command. Batching is what keeps a per-item rewrite from costing a full read each time, and it is the only route from a linked worktree, where the guard above rules out editing a line in place.

Tell the user `✅ Wrote proposal to .canon/memory/review/memory-review-<slug>.md`. Ask them to fill in `Decision:` per item, then re-ping with "discuss" for question rounds or "apply" to commit.

Rewrite the review file in place whenever the proposal changes mid-review. The file stays the source of truth for the current decisions.

## Challenge phase

Trigger: user says "challenge the promotes", "challenge before apply", or asks for a high-bar pass. Run before Apply. No mutations to memory files or promotion targets. Review file only.

1. Read the latest `.canon/memory/review/memory-review-*.md` at the main root.
2. For each promote item, apply three tests:
   - **Absorbed**: grep the target surface for the rule's keywords. If already stated or implied, flip to retire.
   - **Delta**: if the rule is a nice-to-have next to existing bullets, flip to retire.
   - **Generality**: if the rule fires only on one literal trigger phrase, rewrite broader or flip to retire.
3. Rewrite the review file in place with the updated actions and a one-line reason under each flip.

## Discuss phase

Trigger: user says "discuss", "respond to questions", or any `Decision:` value contains `?` or an unrecognized verb. No mutations to memory files or targets. Review file only. Multi-round.

1. Read the latest `.canon/memory/review/memory-review-*.md` at the main root.
2. For each item whose `Decision:` contains `?` or any unrecognized verb (anything other than `apply`, `skip`, `defer`):
   - Write a `Take:` line under `Decision:`, separated by exactly one blank line. If a `Take:` line already exists, overwrite it.
   - Format: pick + one-line reason. Max 2 sentences. Decision-help style. State the recommendation (`apply` / `skip` / `retire` / specific alternative) first, then the reason. Do not enumerate tradeoffs unless one changes the call.
   - Leave the H2 emoji as 📝 pending.
3. Skip items whose `Decision:` is `apply`, `skip`, `defer`, or empty.
4. End with: `💬 Discussed: <nums> | ⏩ Skipped (committed or empty): <nums>`. Remind the user to refine `Decision:` lines and re-ping with "discuss" for another round, or "apply" when ready to commit.

Do not act on any item. Do not archive memory files. Do not edit promotion targets. Discuss only.

## Apply phase

Trigger: user says "apply", "commit", "ship the review", or re-pings with no question items remaining. Mutates tracked promotion targets and moves memory files into the archive.

Before applying any item, check the worktree state:

```bash
[ "$(git rev-parse --git-dir 2>/dev/null)" = "$(git rev-parse --git-common-dir 2>/dev/null)" ] && echo "MAIN" || echo "LINKED"
```

If the result is `MAIN`, stop and tell the user: `❌ Apply phase mutates tracked files. Run /session-worktree first.` Discuss and Challenge phases only touch `.canon/review/` scratch and run from anywhere.

Before applying a promote to an always-loaded rule in the toolkit repo, load `internal-governance`, which owns `internal/rules/core/` and `governance/rules/core/` and is the only route that may author into either. In a target project, hand off to `create-rule` with no load, since `internal-governance` is a toolkit-internal skill under `.claude/skills/` that a target project never has. An `Edit` appending to an existing file under `.claude/rules/project/` needs no load either.

Promotions are a separate concern from any feature in flight. Keep the promoted edits on their own commit. Do not fold an always-loaded-rule or skill-body change into a feature's commits, because a feature reviewer should not have to vet a change to how the agent operates.

For each item, parse the `Decision:` line:

- `apply` (or affirmative): run the proposed action, flip emoji to ✅.
- `skip`: leave the memory in place, flip emoji to ⏭.
- `defer` or empty: leave 📝 pending, take no action.
- Contains `?` or unrecognized verb: leave 📝 pending, take no action. Do not respond. Discussion is the Discuss phase's job.

Free-form text after the verb is a reason. Capture it in the receipt but do not let it change the action. When committing an item, strip any empty `Take:` line so the receipt stays clean. `Take:` lines with content stay as discussion history.

Action by action type:

- **Promote**: use `Edit` to insert the rewritten rule into the target surface, then archive the memory file. A promote to an always-loaded rule in the toolkit repo never reaches this line: it stops as a handoff to `internal-governance`, the same as **Hand off** below, and archives only on the user's explicit confirmation.
- **Promote to a context entry**: append the fact to `.canon/tmp/memory-routing/<slug>.md` at the main worktree root, then archive the memory file. `docs-fold` folds it in on its next run from a branch, which is what keeps one skill writing context entries.
- **Hand off**: do not edit governance. Archive the memory file only if the user confirmed the handoff explicitly. Otherwise leave it in place.
- **Retire**: archive the memory file.

Archiving means creating `.canon/memory/archive/` at the main worktree root and moving the file there under its original name, overwriting any file already at that name. Send the `mkdir -p` and the `mv` as two plain commands rather than joining them with `&&`, which is refused as compound from a linked worktree. Never delete a memory entry. Nothing recovers one from a gitignored folder.

Do not hand-edit `.canon/memory/index.md`. Once every archive move is done, regenerate it instead:

```bash
canon indexes regen --no-stage --root <main-root> <main-root>/.canon/memory/index.md
```

The `PostToolUse` hook that keeps the index current matches `Write|Edit|MultiEdit`, and an archive move is a shell `mv`, so nothing fires on it. Without this call the index keeps a row per archived entry and drifts exactly the way the hand-appended one did. Run it once after the last move rather than per item.

Apply promotion edits one at a time via `Edit`. Claude Code's tool permission dialog is the confirmation gate per edit. Never rewrite a whole promotion target.

This governs the tracked surfaces a promote lands in, which sit at `pwd` and take `Edit` from anywhere. The receipt and the memory entries are main-root scratch and follow the guard instead.

As each item resolves, update its status in the review file: flip the H2 emoji from 📝 to ✅ for applied, ⏭ for skipped, 📦 for retired, or 🤝 for handed off. Refresh the summary block counts at the top. Do not delete the file here. The sweep below decides whether it goes.

**Chat shortcut:** the user replies with `all`, `none`, a comma-separated list of numbers, or `skip <nums>`. Write the matching verb into the `Decision:` slot of every item the reply names, `apply` for `all` or a bare list and `skip` for a `skip` reply, then run the parse above against the file. A reply of `none` writes nothing. A slot the reply does not name keeps its own value, so the receipt stays the source of truth and an empty slot still means take no action.

### Sweep the receipt

Count the items still 📝 pending once the parse above has run. Apply leaves one pending on `defer`, on empty, and on any unrecognized verb, so a receipt reaching this point may still be holding decisions.

Leave the receipt in place when any remain. When none do, collect it per the collection rule in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`, which owns what a fold writes and which entry types take one.

`docs-fold` Step 10 sweeps the same folder on the same rule once per shipped branch, and either may reach a receipt first. Whichever does, the other finds no file and moves on.

End with: `✅ Applied: <nums> | ⏭ Skipped: <nums> | 📝 Pending: <nums>`. Omit empty buckets. If anything is pending, remind the user they can refine `Decision:` lines and re-ping, run "discuss" for question items, or commit a skip with `skip <nums>` in chat.

## Cleanup phase

Trigger: user says "cleanup" or "delete the receipt" after Apply has run.

Cleanup folds one receipt's skips and removes that receipt, and does nothing else. It is the fallback route now that Apply and `docs-fold` Step 10 each collect a resolved receipt on their own, so it reaches a file those two left behind rather than being the only collector. Apply is still the only phase that moves a memory entry out of the pen, and it does so per approved item into `.canon/memory/archive/`. A user asking to sweep stale memories wants Propose, which classifies entries and writes a decision slot per entry.

If no `.canon/memory/review/memory-review-*.md` exists at the main root, stop: `✅ No review receipt to clean up.` Every other refusal in this skill carries a message, and the phase reads a receipt before it does anything else.

1. Read the latest `.canon/memory/review/memory-review-*.md` at the main root and confirm Apply has run against it. If any item is still 📝 pending, stop and name the pending numbers.
2. Collect it per the collection rule in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`, folding each ⏭ skipped item before the file goes. The fold happens wherever a receipt is collected, so this phase runs the same rule the Apply sweep does.
3. Delete that one file. Leave every other receipt beside it in place, because the pending test above covers the file it read and nothing has tested the rest.
4. Leave every memory entry in the pen. A skip records the decline on the entry and keeps the file, and applied promotions, governance handoffs, and user-type memories each stay as the review left them.

Do not promote or archive a memory entry. The skip fold is the one rewrite this phase makes, and it records a decline on an entry that stays in the pen.

## After completion

Output one line per action taken in the most recent phase:

- `✅ Promoted: .canon/memory/<memory-file> → <target>`
- `✅ Handed off: .canon/memory/<memory-file> → governance`
- `📦 Retired: .canon/memory/<memory-file> → .canon/memory/archive/`
- `🗑  Swept: .canon/review/<review-file>, folded <n> skips`
- `⏭ Kept: .canon/review/<review-file>, <n> items pending`

If the user accepted nothing, output: `✅ No changes applied.`
