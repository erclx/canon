---
title: Memory review later phases
description: The Challenge, Discuss, Apply, and Cleanup phases of memory-review, each run on its own invocation against a receipt the Propose phase already wrote
---

# Memory review later phases

The phases of `memory-review` after Propose. The session reads this file when the phase table in the skill picks Challenge, Discuss, Apply, or Cleanup, and reads only the section for that phase. The skill's Guards still hold for every phase here.

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

Before applying a promote to an always-loaded rule in the toolkit repo, load `internal-governance`, which owns `internal/rules/` and `governance/rules/` and is the only route that may author into either. In a target project, hand off to `create-rule` with no load, since `internal-governance` is a toolkit-internal skill under `.claude/skills/` that a target project never has. An `Edit` appending to an existing file under `.claude/rules/project/` needs no load either.

Promotions are a separate concern from any feature in flight. Keep the promoted edits on their own commit. Do not fold an always-loaded-rule or skill-body change into a feature's commits, because a feature reviewer should not have to vet a change to how the agent operates.

For each item, parse the `Decision:` line:

- `apply` (or affirmative): run the proposed action, flip emoji to ✅.
- `skip`: leave the memory in place, stamp it reviewed as below, flip emoji to ⏭.
- `defer` or empty: leave 📝 pending, take no action.
- Contains `?` or unrecognized verb: leave 📝 pending, take no action. Do not respond. Discussion is the Discuss phase's job.

Free-form text after the verb is a reason. Capture it in the receipt but do not let it change the action. When committing an item, strip any empty `Take:` line so the receipt stays clean. `Take:` lines with content stay as discussion history.

Action by action type:

- **Promote**: use `Edit` to insert the rewritten rule into the target surface, then archive the memory file. A promote to an always-loaded rule in the toolkit repo never reaches this line: it stops as a handoff to `internal-governance`, the same as **Hand off** below, and archives only on the user's explicit confirmation.
- **Promote to a context entry**: append the fact to `.canon/tmp/handoff/memory-routing/<slug>.md` at the main worktree root, then archive the memory file. `context-fold` folds it in on its next run from a branch, which is what keeps one skill writing context entries.
- **Hand off**: do not edit governance. Archive the memory file only if the user confirmed the handoff explicitly. Otherwise leave it in place.
- **Retire**: archive the memory file.
- **Keep**: stamp the memory file reviewed as below, and flip the emoji to 📌.

Stamping means writing `reviewed: <today>` as a `YYYY-MM-DD` date into the entry's frontmatter, replacing any earlier value, and changing nothing else in the file. The entry is main-root scratch, so the stamp goes out as the same whole-file heredoc rewrite the Guards state. Stamp only an entry that stays in the pen, being a keep or a skip. A promote or a retire takes no stamp, since the entry leaves for the archive. The stamp is what takes a kept entry off the front of `canon records stale memory`'s queue, so an entry kept without one returns in the next batch.

Archiving means creating `.canon/memory/archive/` at the main worktree root and moving the file there under its original name, overwriting any file already at that name. Send the `mkdir -p` and a plain `mv`, routed the way `session-worktree` states for a main-root move. Never delete a memory entry. Nothing recovers one from a gitignored folder.

Do not hand-edit `.canon/memory/index.md`. Once every archive move and stamp is done, regenerate it instead:

```bash
canon indexes regen --no-stage --root <main-root> <main-root>/.canon/memory/index.md
```

An archive move is a shell `mv`, which skips the index hook the way `session-worktree` states. Without this call the index keeps a row per archived entry and drifts exactly the way the hand-appended one did. Run it once after the last move rather than per item.

Apply promotion edits one at a time via `Edit`. Claude Code's tool permission dialog is the confirmation gate per edit. Never rewrite a whole promotion target.

This governs the tracked surfaces a promote lands in, which sit at `pwd` and take `Edit` from anywhere. The receipt and the memory entries are main-root scratch and follow the skill's heredoc guard instead.

As each item resolves, update its status in the review file: flip the H2 emoji from 📝 to ✅ for applied, ⏭ for skipped, 📦 for retired, 📌 for kept, or 🤝 for handed off. Refresh the summary block counts at the top. Do not delete the file here. The sweep below decides whether it goes.

**Chat shortcut:** the user replies with `all`, `none`, a comma-separated list of numbers, or `skip <nums>`. Write the matching verb into the `Decision:` slot of every item the reply names, `apply` for `all` or a bare list and `skip` for a `skip` reply, then run the parse above against the file. A reply of `none` writes nothing. A slot the reply does not name keeps its own value, so the receipt stays the source of truth and an empty slot still means take no action.

### Sweep the receipt

Count the items still pending once the parse above has run. An item is pending when its H2 carries 📝, or when its H2 carries no status emoji and its `Decision:` slot holds nothing the parse above would act on or skip, since a receipt written by hand or by an older binary may lack the marker. Apply leaves one pending on `defer`, on empty, and on any unrecognized verb, so a receipt reaching this point may still be holding decisions.

Leave the receipt in place when any remain. When none do, collect it per the collection rule in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`, which owns what a fold writes and which entry types take one.

`context-fold` Step 9 sweeps the same folder on the same rule once per shipped branch, and either may reach a receipt first. Whichever does, the other finds no file and moves on.

End with: `✅ Applied: <nums> | ⏭ Skipped: <nums> | 📝 Pending: <nums>`. Omit empty buckets. If anything is pending, remind the user they can refine `Decision:` lines and re-ping, run "discuss" for question items, or commit a skip with `skip <nums>` in chat.

## Cleanup phase

Trigger: user says "cleanup" or "delete the receipt" after Apply has run.

Cleanup folds one receipt's skips and removes that receipt, and does nothing else. It is the fallback route now that Apply and `context-fold` Step 9 each collect a resolved receipt on their own, so it reaches a file those two left behind rather than being the only collector. Apply is still the only phase that moves a memory entry out of the pen, and it does so per approved item into `.canon/memory/archive/`. A user asking to sweep stale memories wants Propose, which classifies entries and writes a decision slot per entry.

If no `.canon/memory/review/memory-review-*.md` exists at the main root, stop: `✅ No review receipt to clean up.` Every other refusal in this skill carries a message, and the phase reads a receipt before it does anything else.

1. Read the latest `.canon/memory/review/memory-review-*.md` at the main root and confirm Apply has run against it. If any item is still pending, by the test the Apply sweep states, stop and name the pending numbers.
2. Collect it per the collection rule in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`, folding each ⏭ skipped item before the file goes. The fold happens wherever a receipt is collected, so this phase runs the same rule the Apply sweep does.
3. Delete that one file. Leave every other receipt beside it in place, because the pending test above covers the file it read and nothing has tested the rest.
4. Leave every memory entry in the pen. A skip records the decline on the entry and keeps the file, and applied promotions, governance handoffs, and user-type memories each stay as the review left them.

Do not promote or archive a memory entry. The skip fold is the one rewrite this phase makes, and it records a decline on an entry that stays in the pen.
