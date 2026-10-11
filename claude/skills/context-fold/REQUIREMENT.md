---
name: context-fold
description: What the context-entry fold is for, the gaps it closes, and why it audits its own writes before it reports
---

# Context fold requirement

## Gap

Without this skill, the context entries describe the repository the session opened with. A decision a plan settled mid-cycle lives only in the conversation and dies with it, and an entry naming a module the diff rewrote keeps stating what the module used to do.

The trigger side carries a gap of its own. "Sync the docs" names either corpus to the person saying it, so a description leaving its corpus to the opening clause alone competes with its public-facing sibling on nothing the routing field states, and the context folder the request was about goes untouched.

The opposite gap opened from the same write. A fold allowed to touch the requirements record on every ship rewrote it one reasonable edit at a time, and nothing read it for whether it still stated the project's identity. Each ship looked correct and the sum drifted.

A fold that did everything at ship time hid its own job. It marked board outcomes, swept receipts, wrote the design record, and landed promoted pages, so a session invoking it to refresh the context entries ran ten steps and could not tell which one it had asked for.

This skill writes canonical docs at the end of a long build. An appended figure, a branch-narrated re-measurement, or an entry pushed past its length lands unchecked the same way a session's own edits do, so what the fold produces carries the exact defect the standards it cites already ban.

## Must

- Name the context entries in a trigger phrase rather than in the opening clause alone, so a bare request to sync the docs separates this skill from `docs-sync` on something both descriptions state
- Take decisions from the session and the refresh scope from the diff
- Write tracked docs at the current worktree root, since only that copy commits with the branch
- Write a decision to the domain context entry it constrains, whatever other domains its reasoning touches, so a decision has one home that loads on demand
- Report a requirements or direction change in one line naming `document-health`, rather than writing it, so the identity record changes only when the operator reviews it
- Close on an audit of what the fold touched, running `canon context audit` and reporting the findings on files this run wrote or the diff carries
- Classify the fold's whole diff baseline through `canon context classify diff`, calling the verb rather than reimplementing its pattern or its prompt in the skill body, since an earlier commit on the branch carries a doc edit the fold is equally responsible for
- Apply a `REPLACE` or `HISTORY` finding against the quote it names, report a `MOVE` finding naming the surface it belongs on rather than cutting it, or keep a finding with a one-line reason, rather than leaving a finding unanswered
- Rewrite a restated or superseded statement in place rather than appending the replacement beside it
- Report a refusal or a missing `context audit` or `context classify` subcommand as one line and continue the fold either way, since a check that cannot run is not a reason to leave the fold's own output unshipped

## Must not

- Write the task board, the design record, `CLAUDE.md`, or a page from a promotion handoff. Each has its own owner, and a fold that writes them hides its job behind theirs.
- Widen what the refresh reads when the baseline is unusable. Widening a read is safe and widening a write stubs a surface for every file in the repository.
- Write the requirements record. It states identity, and a fold reads one session where a review reads the whole project.
- Create a context entry for a domain the catalog does not list
- Report an audit finding on an entry this run never touched, which belongs to whoever next edits it
- Add a path flag to the audit verb from this skill. It takes a project root, so the skill filters the record.
- Pick or configure a classifier backend. The project setting decides it, and this skill reports the resolved `modelLayer` as returned.
- Stop the fold on an audit or classify finding, a refusal, or a missing subcommand. All of them report and continue.
- Apply a finding against a quote found more than once or not found at all. Report that it could not be located instead of guessing.
- Re-run the classifier after applying a finding, which loops it over its own edit
- Cut a `MOVE` finding. The verdict means correct content sitting on the wrong surface rather than a deletion candidate, so cutting one can discard content that belongs elsewhere rather than removing detail that never belonged at all.
- Scope the classifier to the files Step 3 wrote this run. An earlier commit on the branch carries a doc edit the fold is equally responsible for, and the verb's own extraction already answers whether anything in range qualifies.

## Guards

- Neither a `canon/` nor a `.claude/` directory: stop and name the command that sets one up
- No session divergence and no diff a context entry could describe: stop with a pass, since both conditions have to hold

## Out of scope

- Marking a shipped task's outcomes, sweeping review receipts, and archiving a task, which `task-complete` owns
- Landing a page a teach promotion handoff carries, which `teach-workspace` owns in its fold mode
- Creating or declining a task file, which `task-board` owns
- Public-facing docs, which `docs-sync` owns. Both descriptions name their corpus in the trigger so a request saying only "sync the docs" lands on one of the pair rather than on either.
- Regenerating the context catalog, which a commit hook runs
