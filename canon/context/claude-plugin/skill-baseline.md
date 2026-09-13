---
title: Skill diff baseline
description: The merge-base block six skills share, the read against write asymmetry when it fails to resolve, and the narrower test autoship carries
---

# Skill diff baseline

The diff baseline is a block that originated in `docs-fold` and now runs in five more skills. It resolves a merge base against `origin/main`, falls back to local `main`, and scopes what a skill reads to the change under review. Preferring the remote is what stops a local `main` trailing behind from pulling other people's merged commits into the set.

## An unresolvable baseline

A `git init` project on `main` with no remote resolves no usable baseline, which is the ordinary shape of a scaffolded target project rather than an edge case. That costs only the committed half of the diff, since the working tree and untracked files still scope correctly. The marking step recovers the committed half by reading `git log -p -1`, which supplies content where a bare file list would not.

The three sweeps and the context refresh run on the working tree and untracked files, and skip only when that set is empty. None substitutes the whole tree for a missing baseline. Three of them write, and a set that wide stubs a wireframe per uncovered surface, stubs a diagram per source signal, and rewrites every context entry.

The anchor sweep only reports, and the whole tree costs it a different way: every anchored decision cites a path the scaffold commit carries, so it flags the entire architecture record and names no number that moved. The asymmetry with the marking step is deliberate and worth keeping: on a scaffolded project the last commit is the scaffold commit, so the `git log -p -1` recovery is the whole tree by another route, which a step that only reads can tolerate and a step that writes cannot. Widening what a step reads is safe. Widening what a step writes is not, and widening what a step flags spends attention on entries nothing put in doubt.

## The shared-resource rule

That baseline is the worked case behind a rule split across two skills. One step in `docs-fold` resolved the diff baseline and three consumed it, and the fallback for an unresolvable baseline was written against the marking step, which only reads. Under that same fallback the two sweeps that write would have stubbed a wireframe for every uncovered surface and rewritten every context entry.

So `plan-feature` obliges a plan that establishes a resource with more than one consumer to list them and mark each read or write, and `review-pr` carries the matching lens beside Integration and Contract. Both skills ship to target projects, where a consumer is a call site, a module, or a component rather than a skill step, so the clause names the unit generically. The review half is what catches the miss, since an author who never noticed the resource was shared will not notice the authoring clause either. `review-branch` stays out of it, because an author reviewing their own change cannot catch a consumer they never enumerated.

Root `CLAUDE.md` and the `CLAUDE.md` seed each own the policy statement, and the skill owns only the mechanism, so the skill states what it does without re-deriving why. The seed keeps its own copy because a scaffolded project cannot point at the toolkit's file.

## The port to four more skills

That baseline then reached four more skills, which had never had it. `review-branch`, `docs-sync`, `standards-audit`, and `git-pr` each resolved a base against bare local `main`, so on `main` every committed change dropped out and the skill reported a clean result rather than admitting it could not see the work. `git-pr` spelled it `git diff main..HEAD`, a two-dot range that compares tips and resolves no merge base, so a grep for the bare form never matched it and an advanced local `main` showed up as reversed changes in the description.

Its `git log main..HEAD` carried the matching defect on the commit side, where a local `main` trailing `origin/main` leaves commits in the range that the diff already excludes, so the description lists work whose changes appear nowhere in it. Both halves read `<base>` now, which is what keeps the commits and the changes describing one branch.

Four of the eleven corrected sites were guards, which is the half that decides whether a fix lands at all: correcting the working read and leaving the guard ships a skill that still stops before it reaches the corrected code.

Porting the block also corrected the test for an unusable baseline. `docs-fold` calls the base unusable when it came from local `main` and equals HEAD, which keys on where the ref came from and misses the case where `origin/main` resolves a merge base that also equals HEAD. That is the ordinary shape of a feature branch before its first commit, so the narrow test would have gone blind on the sessions these skills run in.

`docs-fold` never pays for it, because it unions the committed, working, and untracked sets and the committed half going empty costs it nothing. Any skill reading the committed half alone needs the wider test, which is that the base equals HEAD whichever ref resolved it. Correcting the wording in `docs-fold` itself is a follow-up rather than part of the port, since nothing there reads it wrongly today.

## What the review selection reads past the baseline

`review-branch` Step 2 reads one range, `git diff <base>`, and unions its name-only list with `git ls-files --others --exclude-standard`. The range compares the base against the working tree, so the committed, staged, and unstaged halves arrive together, and the untracked listing covers the file git has never tracked and no diff can reach. Nothing selects between the halves, which is what the step used to do.

The pair it replaced took the staged set when that set was non-empty and `git diff <base> HEAD` otherwise. Neither arm reached the working tree, so a branch carrying at least one commit with nothing staged read as perfectly usable, skipped the substitution the unusable arm would have supplied, and was reviewed on its committed half alone. The ship chain produces that shape whenever a plan asks for the test committed ahead of the correction it covers, which the planning rules ask for generally and `canon gov test-order` measures. A test commit moves HEAD off the base while the implementation is still uncommitted at `auto-ship` Step 5, so the pass read the tests and never saw the code they cover.

The classifier one step earlier already diffed the base against the working tree, which is the disagreement that decided the shape of the fix: two steps in one chain answered differently about what the branch was, and one range is what makes them agree. The base equalling HEAD stopped being an unusable case in the same change, since `git diff <base>` degenerates there to `git diff HEAD` and reads the branch whole rather than half of it.

The correction is prose in a skill body rather than a verb, so nothing stops a later editor reintroducing the staged-first arm. Moving it behind a `canon` verb was the alternative and it loses on the two-speeds lag `canon/ARCHITECTURE.md` records, since the skill ships with the plugin and a verb reaches a target only once a release publishes it. The sandbox arm is what carries the cost instead: `claude:review-branch` now stages a bug in each of the four halves and asserts one content entry per half, so a report naming the committed file alone goes red.

## The narrower test autoship carries

`auto-ship` was held back from that port on purpose and became the fifth skill to take the baseline. Its classifier decides whether a review runs at all, so widening what it sees turns a branch that looked prose-only into a mixed one and changes behavior rather than only correctness. It shipped with the bug filed against that classifier instead of inside a five-file diff, since a stale baseline is one of the ways the file list comes back empty and the vacuous test is what then waves it through.

Its unusable test is narrower than three of the four siblings', which is the wider rule applied rather than an exception to it. A skill reading the committed half alone needs the base-equals-HEAD arm, and the classifier diffs the base against the working tree, so the uncommitted work stays in the set when that arm would fire. `review-branch` is the fourth and dropped the arm on that same reasoning once its Step 2 moved to one range, which leaves `docs-sync`, `standards-audit`, and `git-pr` as the three still carrying it. Autoship reaches Step 5 before `git-stage` has committed anything, so the base equals HEAD on every ordinary run and porting the arm verbatim would stop the chain every time. The skill body says so at the point of the omission, because the next reader porting the block will otherwise correct it back.

The empty list is what stops the chain instead. Routing it into review rather than stopping would re-create the silent skip by a longer path, since a review of no files produces no findings and the findings step reads that as a clean pass. That fix left the skip itself alone, because the defect it closed was a broken read making every branch look prose-only rather than the test the skip applied.

### What the classifier admits

The test the skip applied was the file extension alone, and it read a skill body as documentation because both end in `.md`. Three branches of executable prose took the skip on record before that changed. A path test now runs beside the extension one, and it fails the skip when any changed file sits under a behavior path.

Removing the skip was the alternative and it loses on cost, since a documentation branch reaching review burns tokens for no signal and that case is what the rule was written for. Measured over the twenty merges before the change, six newly reach review and three still skip, so the skip keeps the case it names rather than being widened into nothing.

Every entry carries both spellings, because the split this repository runs on gives one surface two paths. Standards, snippets, and rules author at a project root and install under `.claude/`, and a list naming only the authoring half matches nothing in a target, where the installed half is the only one present. `claude/skills/` is absent from a target as well, since skills load from the plugin root rather than being copied in, so an authoring-only list would leave `.claude/skills/` as the single entry that ever fires and the fix close to a no-op wherever the skill ships.

Two entries are neither a skill nor a consumed copy. `tooling/` holds the stack references and the seed documents handed to every target, so its markdown is a target's own instruction file rather than a description of one. Root `CLAUDE.md` is named as a file because a path prefix reaches nothing sitting in no folder, and a branch changing it alone is how a cross-cutting rule lands here.

A plan whose output is entirely gitignored still reaches the stop rather than a fix, which is a separate defect that surfaces six steps later at `git-stage`. The stop names that case apart from a plan yet to produce output, since the two want opposite responses and a single message covering both sends the operator to the wrong check. Advising a re-run once the output is tracked is the wrong fix for scratch that is gitignored by design, and followed literally it commits scratch to close a stopped run.

## What no gate reads in a skill body

Internal duplication, authoring-standard conformance, and a body's agreement with its own later steps are all unenforced. The format stage normalizes syntax, cspell reads words, and the skill-paths stage greps one banned path pattern, so none reads a body against `standards/skill.md` or against itself. `memory-review` shipped its bucket-summary line verbatim in two sections and `git-commit` shipped a title-case H1 against the sentence-case rule, both passing `bun run check`. A later pass adding one rule to three review skills produced the self-contradiction class three times in a single edit.

A step that scopes a set and a later step that maps over it can disagree about what the set contains, and both pass every conformance check. `standards-audit` scopes to changed markdown files and then maps branch names and pull request bodies, which are not files in that set, and `memory-review` cleanup targets entries its own apply phase already deleted. The same test runs backwards on a guard, which executes before every step and can only read what is already on disk: one guard was rewritten to test every standard the changed files map to, which is output the mapping step produces two steps later.
