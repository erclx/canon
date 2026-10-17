---
title: Skill diff baseline
description: The merge-base block three skills share, and the read against write asymmetry when it fails to resolve
---

# Skill diff baseline

The diff baseline is a block four skills share, `context-fold`, `task-complete`, and two ported copies. It resolves a merge base against `origin/main`, falls back to local `main`, and scopes what a skill reads to the change under review. Preferring the remote keeps a stale local `main` from pulling in other people's merged commits.

## Decisions

### An unresolvable baseline

A `git init` project on `main` with no remote resolves no usable baseline, which is the ordinary shape of a scaffolded target project. That costs only the committed half of the diff, since the working tree and untracked files still scope correctly.

- `task-complete`'s marking step recovers the committed half from `git log -p -1`, which supplies content where a bare file list would not
- `context-fold`'s refresh runs on the working tree and untracked files and skips only when that set is empty
- It never substitutes the whole tree for a missing baseline, since a set that wide rewrites every context entry

The asymmetry is deliberate. On a scaffolded project the last commit is the scaffold commit, so the `git log -p -1` recovery is the whole tree by another route, which a step that only reads can tolerate and a step that writes cannot. Widening what a step reads is safe, and widening what a step writes is not.

### The shared-resource rule

That baseline is the worked case behind a rule split across two skills. When one `context-fold` step resolved the baseline and several consumed it, a fallback written against the marking step, which only reads, would have let the step that writes rewrite every context entry.

The marking step now lives in `task-complete` with its own copy of the block, which keeps the two fallbacks apart by construction.

- `plan-feature` obliges a plan that establishes a resource with more than one consumer to list them and mark each read or write
- `review-pr` carries the matching lens beside Integration and Contract, and it catches the miss, since an author who never noticed the resource was shared will not notice the authoring clause
- Both ship to target projects, where a consumer is a call site, a module, or a component, so the clause names the unit generically

Root `CLAUDE.md` and the `CLAUDE.md` seed each own the policy statement, and the skill owns only the mechanism. The seed keeps its own copy because a scaffolded project cannot point at the toolkit's file.

### The baseline in the ported skills

`docs-sync` and `git-pr` each resolve a base against `<base>`, the same merge-base preference, rather than against bare local `main`. A bare local `main` drops every committed change on the branch it was cut from, so a skill reading it reports a clean result rather than admitting it cannot see the work.

- `git-pr` reads both its diff and its commit log against `<base>`, since a two-dot range such as `git diff main..HEAD` compares tips and reads wrong when local `main` trails `origin/main`
- A skill reading the committed half alone treats a baseline as unusable when it equals HEAD, whichever ref resolved it
- `context-fold` needs neither test, since it unions the committed, working, and untracked sets

The HEAD test is broader because the narrower one, local `main` only, misses a feature branch before its first commit. There `origin/main` resolves a merge base that also equals HEAD, so the skill would go blind on the sessions it runs in.

## Gotchas

### What no gate reads in a skill body

Internal duplication, authoring-standard conformance, and a body's agreement with its own later steps are all unenforced. The format check asserts syntax, and the skill-paths stage greps one banned path pattern, so none reads a body against `claude/skills/create-skill/references/skill.md` or against itself.

- Two sections repeating one summary verbatim, or a heading whose casing disagrees with the sentence-case rule, both pass `bun run check` unnoticed
- A rule added identically to several skills in one edit can produce that class more than once
- A step that scopes a set and a later step that maps over it can disagree about its contents, as when a cleanup step targets entries its own apply phase already deleted

The same test runs backwards on a guard, which executes before every step and can only read what is already on disk. A guard testing every standard the changed files map to depends on output a mapping step produces two steps later.
