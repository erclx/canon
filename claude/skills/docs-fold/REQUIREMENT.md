---
name: docs-fold
description: What the planning-doc reconcile is for, the gaps it closes, and why the diff decides completion alone
---

# Docs fold requirement

## Gap

Without this skill, the planning docs describe the scope the session opened with. An outcome the diff shipped stays unchecked, so the board reports finished work as open and the next session re-plans it. A requirement or architecture decision that changed mid-cycle lives only in the conversation and dies with it. Plans for closed tasks accumulate in the live folder, so the folder stops indicating what is in flight.

A decision's verification anchor has the same shape of gap in the other direction. The reasoning keeps reading as current while the number it cites moves underneath, and an amendment written without an anchor leaves nothing recording which numbers were checked and which nobody has read since.

A handoff file has the same shape of gap as an unmarked outcome. A page a learning workspace produced and an operator already picked a destination for sits in gitignored scratch until something lands it, and the session that produced it is gone by the time a branch exists to carry the write. Left unfolded it reads as promoted while the destination holds nothing.

The receipt half of that sweep was missing entirely. A review receipt was deleted per shipped branch and a memory-review receipt was skipped, because the exclusion protecting the checklist and audit prefixes caught a third by accident. Nothing but an operator asking collected it, and a collection that waits on someone remembering to ask is one a folder outgrows, so the skipped population grew per shipped branch and never shrank until it was most of the folder.

The trigger side carries a gap of its own. "Sync the docs" names either corpus to the person saying it, so a description leaving its corpus to the opening clause alone competes with its public-facing sibling on nothing the routing field states, and the planning surface the request was about goes untouched.

This skill writes canonical docs at the end of a long build and never reviews what it wrote. An appended figure or a branch-narrated re-measurement lands unchecked the same way a session's own edits do, so what the fold produces carries the exact defect the standards it cites already ban.

## Must

- Name the `.claude/` corpus in a trigger phrase rather than in the opening clause alone, so a bare request to sync the docs separates this skill from `docs-sync` on something both descriptions state
- Take completion from the diff and everything else from the session, since completion is a fact about the repository rather than about the conversation
- Match an outcome on the behavior it names, never on a filename or a commit subject
- Leave an outcome unchecked when the diff is ambiguous. An unmarked shipped outcome costs one manual edit and a wrongly marked one hides work that never happened.
- Write tracked docs at the current worktree root and the task board at the main root, since only the first commits with the branch
- Count every other citation before archiving a plan, comparing resolved targets rather than raw strings or bare filenames
- Retarget a closed task at the archived plan, so the reasoning behind finished work stays reachable
- Anchor a decision entry this run writes or amends whose reasoning cites a measured number, re-reading the number against the tree before writing the marker
- Report an anchored decision whose cited path the diff touched, since the number was read before the branch moved what it counted
- Scan every memory-review receipt rather than the one matching this slug, since the skill that writes them runs after this one in the ship chain and a slug is unique per feature
- Collect a memory-review receipt whose items are all decided, folding each skip into its memory entry first, since a declined item is recorded nowhere else and a promoted one is already in git
- Leave a memory-review receipt holding a pending item, and report the count. A branch shipping is not an operator deciding what the receipt proposed.
- Leave the current branch's review receipt alone, since the chain that wrote it cites it in its own closing line and this skill cannot read whether that citation is still live
- Land each block of a promotion handoff at the destination its heading names, then delete the file so a later run does not fold it twice
- Take a promotion destination as already decided, since the operator confirmed it where the page was produced
- Classify the fold's whole diff baseline through `canon context classify diff`, calling the verb rather than reimplementing its pattern or its prompt in the skill body, since an earlier commit on the branch carries a doc edit the fold is equally responsible for
- Apply a `REPLACE` or `HISTORY` finding, and a regex-decided `MOVE` finding, against the quote it names, report a model-decided `MOVE` finding naming the surface it belongs on rather than cutting it, or keep a finding with a one-line reason, rather than leaving a finding unanswered
- Rewrite a restated or superseded statement in place rather than appending the replacement beside it, on every canonical doc type this skill writes
- Report a refusal or a missing `context classify` subcommand as one line and continue the fold either way, since a check that cannot run is not a reason to leave the fold's own output unshipped

## Must not

- Infer a new task from the diff. Only outcomes already on the board get marked.
- Touch task files the session did not change
- Widen what a writing step reads when the baseline is unusable. Widening a read is safe and widening a write stubs a surface for every file in the repository.
- Edit `CLAUDE.md` inline. Every change there goes through a diff-and-approve gate, so this skill only flags.
- Create a context entry, or move or delete a plan. A plan is settled by the merge, and `canon tasks archive` carries it.
- Overwrite a file a promotion block routes to. A destination that already holds a page is a merge for a person, and folding over it discards work this skill never read.
- Write an anchor onto a decision the run did not amend, or refresh one without re-reading the number. A date from a pass that measured nothing is the false confidence the marker exists to prevent.
- Anchor an entry written before the rule, which dates it by blame rather than by a read
- Pick or configure a classifier backend. The project setting decides it, and this skill reports the resolved `modelLayer` as returned.
- Stop the fold on a classify finding, a refusal, or a missing subcommand. All three report and continue.
- Apply a finding against a quote found more than once or not found at all. Report that it could not be located instead of guessing.
- Re-run the classifier after applying a finding, which loops it over its own edit
- Cut a model-decided `MOVE` finding. The model's own prompt defines `MOVE` more broadly than the regex layer does, for correct content sitting on the wrong surface rather than a deletion candidate, so cutting one can discard content that belongs elsewhere rather than removing detail that never belonged at all.
- Scope Step 10 to the files Steps 3 and 7 wrote this run. An earlier commit on the branch carries a doc edit the fold is equally responsible for, and the verb's own extraction already answers whether anything in range qualifies.

## Guards

- No `.claude/` directory: stop and name the command that sets one up
- No session divergence and no queued outcome the diff shipped: stop with a pass, since both conditions have to hold

## Out of scope

- Creating a task file or moving one off the board, which `task-board` owns
- Public-facing docs, which `docs-sync` owns, apart from landing a page a promotion handoff already carries a confirmed destination for. This skill reconciles the `.claude/` planning surface, and both descriptions name their corpus in the trigger so a request saying only "sync the docs" lands on one of the pair rather than on either.
- Deciding where a promoted page belongs, which is settled with the operator by the surface that produced the page
- Regenerating the task index, owned by a hook
- Re-measuring an architecture claim to decide whether its number moved. The sweep keys on a cited path entering the diff, so a claim whose number moved with no cited path in the diff goes unflagged.
