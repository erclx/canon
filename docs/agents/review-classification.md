---
title: Review classification
description: Deciding whether a changed set needs the review pass, the two tests it runs, why an empty set refuses rather than skipping, and the written fallback a target on an older binary falls back to
---

# Review classification

`canon autoship classify` answers the one decision the ship chain used to make by reading a bulleted list out of a skill body. It takes the names a branch changed and returns whether the review pass can be skipped, which file decided it, and which of the two tests that file failed.

```bash
canon autoship classify docs/index.md README.md
canon autoship classify --json .claude/skills/deploy-check/SKILL.md
```

| Option   | Behavior                                                   |
| -------- | ---------------------------------------------------------- |
| `--json` | Add a machine-readable record on stdout, keeping the frame |

Positional paths are the whole input. The verb never touches git, so it reads no baseline of its own and the caller hands over the set it already computed. A second read here could resolve a different range than the one the chain measured, which is the stale-baseline failure a prior row closed.

Under `--json` the record holds stdout alone and the frame still renders on stderr, refusals included, which is the split `output-shape.md` fixes for every mode.

## The two tests

A branch skips review only when both hold across every changed name:

- **Every path reads as prose.** The extension is `.md` or `.txt`, compared lowercased. Anything else is code, a config, or an asset.
- **No path sits under a behavior path.** Markdown under one of those surfaces states what an agent does, so a change there is a behavior change wearing a prose extension.

One failing file sends the whole branch to review. Documentation shipped beside a behavior change does not cancel it.

The record names the first file to fail, tested in the caller's own order, and each file is read for its extension before its path. A set failing both tests reports one file and one test, which is all a caller needs to route.

## The behavior paths

Most carry two spellings, the one a surface authors at and the one it reaches a session at, so the rule reads the same in this toolkit and in a project that consumed one.

| Surface           | Spellings                             |
| ----------------- | ------------------------------------- |
| Plugin skills     | `claude/skills/`, `.claude/skills/`   |
| Governance rules  | `governance/rules/`, `.claude/rules/` |
| Standards         | `standards/`                          |
| Internal and seed | `internal/`, `tooling/`               |
| Root instructions | `CLAUDE.md`                           |

`standards/` carries one spelling. It never installs into a project, reaching a reader by resolution, so there is no consumed copy to name.

`CLAUDE.md` is matched as a whole path rather than as a prefix, because a prefix reaches nothing that sits in no folder. A nested `docs/CLAUDE.md` stays informational.

The set is data at `src/autoship/paths.ts`. That makes it permanently exempt from any later design that folds a machine-parsed list back into the surface citing it, per the toolkit's machine-parsed clause: a rule restating the list a parser reads is two sources for one list.

## Exit codes and refusals

| Code | Meaning                                                      |
| ---- | ------------------------------------------------------------ |
| `0`  | prose-only, so the review pass can be skipped                |
| `1`  | refused, with `reason` naming the cause                      |
| `2`  | review is needed, with `file` and `test` naming what decided |

Branch on the record's `decision` rather than on the exit code. A shell function wrapping `canon` takes its status from whatever it runs last, so every non-zero exit can reach a caller as zero.

An empty set refuses with `no-changes` rather than skipping. Both tests are universally quantified, so an empty set satisfies them vacuously, and reading that as prose-only would route a branch past review for having produced no output at all.

## Why it is a verb

The decision was three sentences in `auto-ship`'s review step, applied by a session reading a bulleted list of paths. It failed three times. A driven arm on 2026-08-30 staged `.claude/skills/deploy-check/SKILL.md`, which that list names, and the chain skipped review and opened a draft pull request anyway. The rule was correct and the session did not apply it, and the two fixes before that one were each a rewrite of the same prose.

A rule a session can talk itself out of moves into a verb. That is the same argument the quiz-order draw in `canon teach lesson` was decided on: an instruction is a hope where a verb is a check.

## The written fallback

The verb ships with the CLI and Step 6 ships with the plugin, so a target holding an older binary meets a missing subcommand. The skill body keeps the written list and applies it by hand there, naming which of the two decided the run.

The fallback is never a skip. Failing open is the exact defect the verb closes, so a body that skips on anything other than a `skip` record would ship every branch unreviewed the moment the subcommand went absent.

Two copies of the path set is what the fallback costs, and it stands until a release retires the written half.
