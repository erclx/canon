---
title: Roots and foreign trees
description: Reading and writing a tree another tool owns, which root a catalog command reads, and where the checkout-mismatch warning sits
---

# Roots and foreign trees

## Gotchas

### Reading a tree someone else owns

- `src/sessions/` is the first command whose correctness depends on a file nothing in this repository writes. The client records one JSON file per session under its configuration directory, resolved from `CLAUDE_CONFIG_DIR` before `~/.claude` through `claudeConfigDir()`, and each record carries that session's working directory beside the name a session listing renders. Reading it is what lets a name join to a branch by an exact match rather than by ordering the roster on start time. The same directory's `projects/` folder holds the transcripts `canon sessions export` and `import` move, resolved through the same function.
- The location, the filenames, and the fields carry no published contract, so an absent registry reports as a refusal rather than as a machine running no sessions. A client that moves the folder then surfaces as a failure instead of an empty roster, which is the same absent-key rule the audits already apply. The transcript format and the projects folder encoding carry no contract either, so the transfer verbs treat a transcript as opaque bytes, read a line only to fill the manifest, and never rewrite one.
- A branch name identifies a branch inside one repository and nothing across a machine, so `--branch` scopes to the shared git directory the command's own working directory resolves to, and refuses outside one. The registry is machine-wide, which is what makes the unscoped match reach a session working in another project, and `main` is the name that collides wherever two are open. The match still returns a count rather than a row, since two sessions can hold one branch and a caller reading the first one picks among candidates without knowing it.
- The liveness check matches a record against the start time it stamped by reading the process filesystem, and falls back to a signal probe where that does not exist. The fallback marks the whole roster unverified rather than dropping rows, since the folder is never pruned and a reused pid would otherwise read as a live session. A record carrying a non-positive pid is dropped at the registry, because signal zero addresses the caller's own process group and would answer for it.

### Writing into a tree someone else owns

- `src/wiki/` scaffolds `.claude/wiki/` in a target and reports a root `wiki/` left by an older scaffold rather than migrating it. A move is a decision the operator owns, since the two roots can both hold pages.
- Porting a guard means porting its side effects. The bash `guard_root` ran `cd "$target"`, which validated the target existed as a by-product of resolving it. A port that reproduces only the stated purpose drops that check, and `mkdir -p` downstream then scaffolds a typo'd path into a new tree.
- Preserving a destination's mode and indent width lives in `internal/rules/core/operator-files.md`, which globs `src/**/*.ts`. `writeSettings` is the live implementation of the mode half, and `detectIndent` plus `serializeSettings` are the indent half.

### A catalog command reads the installation, not the branch

Every `canon` command taking `PROJECT_ROOT` reads the installation the CLI was linked from rather than `pwd`, because `src/roots/project.ts` derives it from `import.meta.url` and `src/cli/exec.ts` hands it to the script. A catalog run inside a linked worktree therefore reports that installation's tree rather than the branch's: during a requirement-coverage batch `canon claude skills list --json` reported 30 skills lacking a file while the branch already held 16. A registry-installed binary is staler again, answering 56 skills with published descriptions while the checkout held 59, dropping the three most recently merged. Verify a branch's own tree by walking the filesystem, and treat any task or plan whose test strategy names a catalog command as untestable from a worktree.

### The checkout-mismatch warning sits at the chokepoints

`checkoutMismatchWarning` in `src/roots/project.ts` formats the line naming both roots and logs nothing itself, which keeps that module free of `@/cli/ui` and the wording under a unit test. Four chokepoint functions carry the call, `resolveTarget`, `runDomainSync`, `execScript`, and tooling's own `prepare()`, and the rest of the covered surface takes one explicit call each, rather than wiring every command action by hand: `resolveTarget` alone stands under six verbs and `execScript` under every bash pass-through verb. `src/commands/checkout-mismatch.test.ts` spawns a real process per verb against a decoy fixture, since a mistake in one chokepoint is wrong for every caller of that function. The message names no subcommand, since threading a per-verb hint through shared functions costs a parameter at every call site.

`canon tooling reference` is exempt because it already resolves the caller's own root ahead of the package corpus, leaving the narrower gap of a cwd one level short of the folder falling through undetected. A verb that never compares `PROJECT_ROOT` to the caller's cwd, such as one spawning this package's own CLI against itself or reading its own version, needs no warning. Measured at `ef62c654` on 2026-09-07: four chokepoints standing under 17 verbs, 13 verbs wired by a call of their own, and 3 recorded exempt.
