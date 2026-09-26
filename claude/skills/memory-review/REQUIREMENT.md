---
name: memory-review
description: What memory review is for, the gaps it closes, and why every action waits on approval
---

# Memory review requirement

## Gap

Without this skill, the memory folder grows and never drains. Entries pile up restating rules a durable surface already carries, nothing decides which memory has earned a place in one, and a rule that does get promoted arrives verbatim in a file whose voice it does not match. The folder then reads as a second source of truth that no surface points at.

A pen too large to review whole is the same gap wearing a different shape. Routing at capture takes the domain facts and whatever the ownership test leaves stays, in whatever mix of types that is, so the folder reaches a size no single pass can read: every entry plus every promotion target runs to hundreds of thousands of tokens before one entry is classified. A review that cannot run drains nothing however often someone asks for it, so the pass takes a bounded batch in the order the stale verb reports and reads targets per entry. An entry leaving the pen is archived rather than deleted, because a folder git does not hold gives a wrong bulk call no undo.

## Must

- Treat the folder as a holding pen, so every entry in scope leaves it as a promotion, a handoff, or an archive, or stays only as a kept entry stamped with the date it was reviewed
- Take one bounded batch per pass in the order `canon records stale memory` reports, and stop rather than falling back to a full sweep when that verb is absent
- Stamp `reviewed` on every entry a pass keeps or skips, so the next batch moves on to entries nobody has read
- Archive an entry out of the pen rather than deleting it, since nothing recovers a file from a gitignored folder
- Hand a fact a context entry owns to `context-fold` through the routing file, rather than editing the entry here
- Verify the rule is not already stated or implied in the target before proposing a promotion, by reading the target rather than trusting the memory's claim about it
- Rewrite a rule into the destination's voice instead of moving it unchanged
- Write the proposal to a receipt on disk and take no action until the user decides per item
- Route every decision channel through the receipt, writing a decision given in chat into its item's slot before the parse reads the file, so a channel the skill advertises drains the pen rather than passing over it
- Keep a promotion on its own commit, since a change to how the agent operates should not ride inside a feature a reviewer is vetting for something else
- Collect a receipt as soon as its last item resolves, rather than waiting for an operator to ask, since a collection nobody triggers is a folder that only grows
- Fold each declined item into its memory entry before the receipt goes, because a promoted item survives in its target and in git while a decline is recorded nowhere else
- Record that decline by rewriting the entry rather than appending to it, so the file states one current claim
- Confine the pass that runs after application to the one receipt it tested, so tidying up removes a file whose decisions are known to be resolved and leaves every untested receipt alone

## Must not

- Apply anything the user has not approved by item
- Author a toolkit rule inline. A toolkit rule under `internal/rules/` or `governance/rules/` has an owner and a scaffolding path, `internal-governance`, and a rule written here bypasses it. A project rule under `.claude/rules/project/` is project-owned and takes an `Edit` appending to an existing file, or a handoff to `create-rule` when none fits.
- Mutate tracked files from the main worktree
- Answer a question raised in a decision slot while applying. Discussion and application are separate passes so an approval is never inferred from a reply.
- Delete a memory entry at all. Every exit from the pen is a move into the archive.
- Move an entry out of the pen outside the approved-per-item pass. The folder is gitignored with no history behind it, so a removal any other phase makes leaves no record of what it took.
- Edit a context entry, or hand-edit the generated memory index

## Guards

- No memory folder at the main root: stop
- The folder holds only its index: stop with a pass, not an error
- Apply invoked from the main worktree: stop and name the worktree command
- Cleanup invoked with no receipt on disk: stop with a pass, not an error

## Out of scope

- Writing memories, which `memory-capture` owns
- Judging whether an entry should have been captured. That is a gate at capture time, and re-deciding it here would delete evidence the capture rule is wrong.
- Editing the governance rules a handoff points at
