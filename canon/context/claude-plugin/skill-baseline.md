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

## The baseline in the ported skills

`review-branch`, `docs-sync`, `standards-audit`, and `git-pr` each resolve a base against `<base>`, the same merge-base preference stated above, rather than against bare local `main`. A bare local `main` drops every committed change on the branch it was cut from, so a skill reading it reports a clean result rather than admitting it cannot see the work.

`git-pr` reads both its diff and its commit log against `<base>`. A two-dot range such as `git diff main..HEAD` compares tips rather than resolving a merge base, so it reads reversed or incomplete whenever local `main` trails `origin/main`. Reading `<base>` on both sides is what keeps the commits and the changes describing one branch.

A skill reading the committed half alone treats a baseline as unusable when it equals HEAD, whichever ref resolved it, rather than only when the ref came from local `main`. The narrower test misses a feature branch before its first commit, where `origin/main` resolves a merge base that also equals HEAD, so it would go blind on the sessions these skills run in. `docs-fold` needs neither test: it unions the committed, working, and untracked sets, so the committed half going empty costs it nothing.

## What the review selection reads past the baseline

`review-branch` Step 2 reads one range, `git diff <base>`, and unions its name-only list with `git ls-files --others --exclude-standard`. The range compares the base against the working tree, so the committed, staged, and unstaged halves arrive together, and the untracked listing covers the file git has never tracked and no diff can reach. Nothing selects between the halves.

A narrower read, taking the staged set when it is non-empty and the committed diff otherwise, would still miss the working tree either way: a branch carrying one commit with nothing staged would read as usable and be reviewed on its committed half alone. That shape is what `auto-ship` Step 5 produces whenever a plan's test lands in a commit ahead of the implementation it covers, per the ordering `canon gov test-order` measures. A test commit moves HEAD off the base while the implementation is still uncommitted, so a committed-only read would see the tests and never the code they cover.

The classifier one step earlier already diffs the base against the working tree, so reading `review-branch` the same way keeps both steps in one chain agreeing about what the branch is. The base equaling HEAD is not an unusable case here, since `git diff <base>` then degenerates to `git diff HEAD` and reads the branch whole rather than half of it.

The correction is prose in a skill body rather than a verb, so nothing stops a later editor reintroducing a staged-first read. Moving it behind a `canon` verb was the alternative and it loses on the two-speeds lag `canon/ARCHITECTURE.md` records, since the skill ships with the plugin and a verb reaches a target only once a release publishes it. The sandbox arm carries the cost instead: `claude:review-branch` stages a bug in each of the four halves and asserts one content entry per half, so a report naming the committed file alone goes red.

## The narrower test autoship carries

`auto-ship`'s classifier decides whether a review runs at all, so widening what it sees would turn a branch that reads as prose-only into a mixed one and change behavior rather than only correctness.

Its unusable test is narrower than three of the four ported skills', which is the wider rule applied rather than an exception to it. A skill reading the committed half alone needs the base-equals-HEAD arm. The classifier diffs the base against the working tree instead, so uncommitted work stays in the set without it. `review-branch` also drops the arm, on the same reasoning, since its Step 2 already reads one range, leaving `docs-sync`, `standards-audit`, and `git-pr` as the three still carrying it.

`auto-ship` reaches Step 5 before `git-stage` has committed anything, so the base equals HEAD on every ordinary run, and the arm ported verbatim would stop the chain every time. The skill body states the omission at that point, because the next reader porting the block would otherwise add it back.

An empty changed-file list stops the chain instead of routing into review. Routing it into review would re-create a silent skip by a longer path, since a review of no files produces no findings and the findings step reads that as a clean pass.

### What the classifier admits

The skip test reads the file extension and the path together: a changed set skips only when every file matches `*.md` or `*.txt` and none sits under a behavior path.

Removing the skip entirely was considered and declined on cost, since a documentation branch reaching review burns tokens for no signal, which is the case the skip exists to catch.

Every entry carries both spellings, because the split this repository runs on gives one surface two paths. Standards, snippets, and rules author at a project root and install under `.claude/`, and a list naming only the authoring half matches nothing in a target, where the installed half is the only one present. `claude/skills/` is absent from a target as well, since skills load from the plugin root rather than being copied in, so an authoring-only list would leave `.claude/skills/` as the single entry that ever fires and the fix close to a no-op wherever the skill ships.

Two entries are neither a skill nor a consumed copy. `tooling/` holds the stack references and the seed documents handed to every target, so its markdown is a target's own instruction file rather than a description of one. Root `CLAUDE.md` is named as a file because a path prefix reaches nothing sitting in no folder, and a branch changing it alone is how a cross-cutting rule lands here.

A plan whose output is entirely gitignored still reaches the stop rather than a fix, which is a separate defect that surfaces six steps later at `git-stage`. The stop names that case apart from a plan yet to produce output, since the two want opposite responses and a single message covering both sends the operator to the wrong check. Advising a re-run once the output is tracked is the wrong fix for scratch that is gitignored by design, and followed literally it commits scratch to close a stopped run.

## What no gate reads in a skill body

Internal duplication, authoring-standard conformance, and a body's agreement with its own later steps are all unenforced. The format stage normalizes syntax, cspell reads words, and the skill-paths stage greps one banned path pattern, so none reads a body against `standards/skill.md` or against itself. A skill body's own claims can drift from each other with nothing catching it: two sections repeating one summary verbatim, or a heading whose casing disagrees with the sentence-case rule, both pass `bun run check` unnoticed. A rule added identically to several skills in one edit can produce that class more than once.

A step that scopes a set and a later step that maps over it can disagree about what the set contains, and both pass every conformance check. `standards-audit` scopes to changed markdown files and then maps branch names and pull request bodies, which are not files in that set, and `memory-review` cleanup targets entries its own apply phase already deleted. The same test runs backwards on a guard, which executes before every step and can only read what is already on disk: a guard testing every standard the changed files map to depends on output a mapping step produces two steps later.
