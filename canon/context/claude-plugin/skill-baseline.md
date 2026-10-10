---
title: Skill diff baseline
description: The merge-base block three skills share, and the read against write asymmetry when it fails to resolve
---

# Skill diff baseline

The diff baseline is a block three skills share, `context-fold` and two ported copies. It resolves a merge base against `origin/main`, falls back to local `main`, and scopes what a skill reads to the change under review. Preferring the remote is what stops a local `main` trailing behind from pulling other people's merged commits into the set.

## An unresolvable baseline

A `git init` project on `main` with no remote resolves no usable baseline, which is the ordinary shape of a scaffolded target project rather than an edge case. That costs only the committed half of the diff, since the working tree and untracked files still scope correctly. The marking step recovers the committed half by reading `git log -p -1`, which supplies content where a bare file list would not.

The anchor sweep and the context refresh run on the working tree and untracked files, and skip only when that set is empty. Neither substitutes the whole tree for a missing baseline. The context refresh writes, and a set that wide rewrites every context entry.

The anchor sweep only reports, and the whole tree costs it a different way: every anchored decision cites a path the scaffold commit carries, so it flags the entire architecture record and names no number that moved. The asymmetry with the marking step is deliberate and worth keeping: on a scaffolded project the last commit is the scaffold commit, so the `git log -p -1` recovery is the whole tree by another route, which a step that only reads can tolerate and a step that writes cannot. Widening what a step reads is safe. Widening what a step writes is not, and widening what a step flags spends attention on entries nothing put in doubt.

## The shared-resource rule

That baseline is the worked case behind a rule split across two skills. One step in `context-fold` resolves the diff baseline and several consume it, and a fallback written against the marking step, which only reads, would let the step that writes rewrite every context entry.

So `plan-feature` obliges a plan that establishes a resource with more than one consumer to list them and mark each read or write, and `review-pr` carries the matching lens beside Integration and Contract. Both skills ship to target projects, where a consumer is a call site, a module, or a component rather than a skill step, so the clause names the unit generically. The review half is what catches the miss, since an author who never noticed the resource was shared will not notice the authoring clause either.

Root `CLAUDE.md` and the `CLAUDE.md` seed each own the policy statement, and the skill owns only the mechanism, so the skill states what it does without re-deriving why. The seed keeps its own copy because a scaffolded project cannot point at the toolkit's file.

## The baseline in the ported skills

`docs-sync` and `git-pr` each resolve a base against `<base>`, the same merge-base preference stated above, rather than against bare local `main`. A bare local `main` drops every committed change on the branch it was cut from, so a skill reading it reports a clean result rather than admitting it cannot see the work.

`git-pr` reads both its diff and its commit log against `<base>`. A two-dot range such as `git diff main..HEAD` compares tips rather than resolving a merge base, so it reads reversed or incomplete whenever local `main` trails `origin/main`. Reading `<base>` on both sides is what keeps the commits and the changes describing one branch.

A skill reading the committed half alone treats a baseline as unusable when it equals HEAD, whichever ref resolved it, rather than only when the ref came from local `main`. The narrower test misses a feature branch before its first commit, where `origin/main` resolves a merge base that also equals HEAD, so it would go blind on the sessions these skills run in. `context-fold` needs neither test: it unions the committed, working, and untracked sets, so the committed half going empty costs it nothing.

## What no gate reads in a skill body

Internal duplication, authoring-standard conformance, and a body's agreement with its own later steps are all unenforced. The format stage normalizes syntax, cspell reads words, and the skill-paths stage greps one banned path pattern, so none reads a body against `standards/skill.md` or against itself. A skill body's own claims can drift from each other with nothing catching it: two sections repeating one summary verbatim, or a heading whose casing disagrees with the sentence-case rule, both pass `bun run check` unnoticed. A rule added identically to several skills in one edit can produce that class more than once.

A step that scopes a set and a later step that maps over it can disagree about what the set contains, and both pass every conformance check. A cleanup step can target entries its own apply phase already deleted. The same test runs backwards on a guard, which executes before every step and can only read what is already on disk: a guard testing every standard the changed files map to depends on output a mapping step produces two steps later.
