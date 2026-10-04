---
title: Key Changes bijection
description: Comparing the files a pull request body's Key Changes names against its own diff, the two directions and the split inside each that decides what is worth raising, the span rules the extractor was measured into, and the three refusals that separate a clean pass from a read that produced nothing
---

# Key Changes bijection

`canon pr key-changes` reads the `## Key Changes` section of a pull request body, lifts the paths its bullets claim, and compares that set against the files the pull request actually changed. This repository squash-merges, so the body becomes the commit message and the record on the trunk once the branch is gone.

```bash
canon pr key-changes
canon pr key-changes 1265 --json
canon pr key-changes --body .canon/tmp/pr/body.md --base origin/main
```

The positional is the pull request to read, defaulting to the one open on this branch.

| Option          | Behavior                                                           |
| --------------- | ------------------------------------------------------------------ |
| `--body <path>` | Read the body from a file, taking the changed set from git instead |
| `--base <ref>`  | Ref the range runs back to when `--body` supplies the body         |
| `--root <path>` | Repository to read, defaulting to the cwd                          |
| `--json`        | Add a machine-readable record on stdout, keeping the frame         |

`--body` decides where both halves come from, so a number passed beside it is never read. The body comes off disk and the changed set from the local range, which is the shape a fixture and a body still being drafted both need. A relative `--body` path resolves against the working directory the command runs from, never against `--root`. `--base` and the changed-file read still resolve against `--root`.

`--base` names the far side of that range and never the commit the comparison runs against directly. The reader resolves the merge base between `HEAD` and the ref, so `--base origin/main` measures what the branch wrote rather than what the trunk gained while the branch was open. Passing the trunk as it stands today is therefore safe on a branch of any age, and a ref sharing no history with `HEAD` refuses as `bad-base`.

Without `--body` the body and the head commit come off the REST pull read and the file list off the paginated files endpoint. Every read runs on REST, since a cloud session's GitHub proxy refuses the GraphQL that `gh pr view` runs on. A push landing between the two reads compares a body against the next head's files, a window the verb accepts for the cloud reach.

A failed page refuses as `gh-failed` rather than comparing against a set known to be short. A set silently one file short is the worst input this takes, since the missing file is exactly what a correct bullet would then be accused of inventing. With no number named, the verb reads the one pull request open on the checkout's branch, and refuses as `ambiguous-pull` when two are open against different bases.

## The two directions

They are reported apart because they want different tolerances.

- **`unmet`** is a whole path the body claims ahead of its bullet's first comma and the diff does not carry. This is the graded direction and it sets the exit code. A bullet naming an untouched file is wrong more often than not, and it corrupts the record that reaches the trunk.
- **`unnamed`** is a changed file no bullet reached that a reader might have wanted one for. Reported with no grade, since a change can be too small to describe and still be correctly absent. Grading it would fire on nearly every branch.
- **`incidental`** is a changed file no bullet reached that owes none: a test beside its subject, anything under a fixture or snapshot folder, and a lockfile a package manager writes. Held apart so the count above reads, and reported rather than dropped so a run still says what it set aside.
- **`unresolved`** is a path the reading could not judge either way. Three causes reach it. A path written partially, such as `role-worker/SKILL.md` for a file under `claude/skills/`. A path past its bullet's first comma. And, for a live pull request, a claim landing here rather than `unmet` because the rename or `.gitignore`-addition evidence that might have credited it could not be read, which `evidenceUnread` on the record names.

Each direction splits on one question, which is whether the evidence is strong enough to raise with a person. A partial path and a trailing path can each credit a changed file and can never accuse one, because nothing separates a path written short from a path written wrong, or a second claim from a file cited for context. Neither split drops anything: what comes out of `unmet` lands in `unresolved` and what comes out of `unnamed` lands in `incidental`, so a count a reader can act on never costs a file the run stayed silent about.

A generated asset and a regenerated index belong in the incidental class and are deliberately absent from it, because neither has a spelling that holds outside one project. Guessing at one would set aside a file that did owe a bullet, which hides a real omission, where leaving them out only leaves the count where it already was.

## What counts as a claim

Only `## Key Changes` is read. `## Technical Context` legitimately names files a branch never touched, such as an install stamp inside a target, so widening the read manufactures a finding out of every argument an author made for the change.

Inside the section, every backticked span in a bullet is read, and the bullet's first comma outside a span divides the ones that can accuse from the ones that can only credit. That one lever was chosen by measurement. Over the 23 merged pull requests in this repository carrying the section, reading whole bullets reported 16 paths as claimed-but-untouched and every one was a file the body named for context. Cutting at the comma left 110 claims of the original 149 and took the false reports to 2. A list of sixteen clause-opening words tried beside it removed nothing the comma had not already removed, because this corpus punctuates every one of them.

The cut used to decide whether a span was read at all, and the paths past the comma fell out of the claim set into `unnamed`. That was accepted on the ground that the ungraded direction does no damage, and it did: `review-pr` read `unnamed` as a question to put to the branch author, so on 2026-09-01 the question went to three pull requests over bullets that had named the files all along. Reading the whole bullet as claims outright is the obvious repair and the corpus refuses it, taking `unmet` from 10 to 19 over the 40 most recent merged pull requests carrying the section, with all nine additions in the context class the cut exists to exclude. Reading the whole bullet and gating the accusation on the cut gives claims 243 to 314 and unnamed 1124 to 1058 with `unmet` identical entry for entry.

A span anywhere in the bullet has to survive all of these:

| Rule                                                                                   | What it keeps out                                                                      |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| No whitespace, `<`, `>`, `$`, `*`, `\|`, `?`, `^`                                      | A backticked command, a placeholder, a glob, a pattern                                 |
| No `://` and no leading `/`, `~`, `@`, `#`, `!`                                        | A URL, an absolute path, a module alias                                                |
| Contains `/`                                                                           | A bare filename with no folder around it                                               |
| Not a dotted-decimal segment, or ends with `/`                                         | A dotted number such as an address                                                     |
| Not a single top-level folder                                                          | `src/`, which nobody claims to have rewritten whole                                    |
| A `file:line` span leads its bullet, or the bullet carries no bare line-only companion | A citation into a file the bullet already named, such as `verify.sh:634` beside `:642` |
| The region carries no no-change marker                                                 | A bullet recording a file it deliberately left alone                                   |

The last three rows earn their place from the corpus rather than from a rule. Every body that spelled a lone top-level folder was naming where something lives, and a line citation that follows another claim in the same bullet points into the file being described only when a bare line-only span sits beside it, such as `:642` following `verify.sh:634`. With no such companion the citation names a second, genuinely distinct file and stays a claim. A line citation leading its bullet stays a claim either way, which is how a body names the exact line it rewrote.

The no-change marker is the one rule the region cut cannot substitute for. A body writes "Leave `x` untouched, since the decision keeps it" to record a change it declined, and the path sits ahead of the first comma, so a stricter cut would not reach it and a looser one would find more. Since `keep` and `leave` each open a real claim often enough, the marker decides it rather than the leading verb. Three words carry the set: `untouched`, `unchanged`, and `as written`. `in place` was measured and dropped, because rewriting a file in place is an ordinary claim, and `no other line` was dropped because a correct bullet writes "as one insertion that touches no other line" about a change it did make. `alone` shipped in the set too, until review found every corpus occurrence sitting past the first comma, where the cut already excludes it, so the word voided no true claim there. Restrictive use is the more common one in this repository's own prose, and a comma-free bullet exposed it: "Move the threshold read into `src/gate/stages.ts` alone" asserts an edit, and the marker voided it while the word was still in the set. Over the 40-pull-request corpus the rule still voids no true claim.

A folder claim covers every changed file beneath it. A bare filename drops outright: resolved as a sibling of a path earlier in its bullet it produced seven wrong paths across this corpus against two right ones, because a compound bullet names a sibling folder as often as a sibling file.

## Anchoring

A claim is anchored when its first segment names a folder the tree holds. The roots come from the tracked file list joined with the first segment of every changed path, and the second half is what admits a folder the branch created. Reading the tree alone would mark every claim under a new top-level directory unanchored, and an unanchored claim never accuses, so the first branch to open one would lose the graded direction with nothing reporting it.

## Exit codes and refusals

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| `0`  | every claimed path is in the diff                 |
| `1`  | refused, with `reason` naming the cause           |
| `2`  | at least one claimed path is absent from the diff |

Branch on the record rather than on the exit code. A shell function wrapping `canon` takes its status from whatever it runs last, so every non-zero exit can reach a caller as zero.

Three refusals separate a clean pass from a read that produced nothing:

- `no-section`. The body carries no such heading, so it claims nothing.
- `no-claims`. The heading is there and no span resolved, which is the extractor failing over prose rather than the body being wrong. Nothing is raised.
- `no-changes`. The pull request changed no files, so no claim has anything to answer.

An empty extraction read as a clean pass is the failure shape this repository has recorded twice, which is why the middle one is its own reason rather than a zero count.

`gh-missing`, `gh-failed`, `ambiguous-pull`, `unreadable-body`, `unreadable-tree`, `no-base`, `bad-base`, and `unreadable-changes` cover the reads that never reached a comparison.

## What it was measured against

Driven over the 40 most recent merged pull requests in this repository at the time, 23 of which carry the section, the shipped verb reported zero unmet paths and one `no-claims` refusal. The naive extractor it replaced reported 16.

The re-measurement behind the trailing-path split is a wider corpus and its numbers do not compare to those. It takes the 40 most recent merged pull requests that carry the section, which reaches back through 90 merges rather than 40, and the reader reports 10 unmet over it. Those 10 predate the split and survive it entry for entry, which is the check that the widening moved nothing into the graded direction. Three name a gitignored path a diff can never carry and one is the definition-site class named below. The remaining six were not run down, so the residual over that corpus is 10 rather than zero and how much of it is the reader rather than the bodies is unmeasured.

The first body written after that corpus closed produced two, which is what the no-change marker and the open class above come from. One was the disclaiming bullet and the rule now covers it at no cost to the corpus. The other is the definition-site class, left open with the report naming it.

The bound is that the corpus is one repository writing to one house style. A project that punctuates differently loses claims to the comma cut rather than gaining false ones, since every rule above drops rather than invents, so the check degrades toward silence rather than toward noise.

What it cannot see is a bullet claiming a change to a file the branch did touch for another reason, and a path written without backticks. A claim in a second coordinated clause after the comma is read and credited, and it stays out of the graded direction, since nothing here separates it from a file the same clause cites for context.

Two shapes credit against evidence the changed-file list itself never carries. A bullet naming the path a git rename moved away from, such as "Move `claude/skills/identity/` to `claude/skills/draft-identity/`", is credited against a local rename read (`git diff --name-status -M`) or, for a live pull request, `gh api repos/{owner}/{repo}/pulls/{number}/files`, keyed on the old path git's own detection reports. A bullet naming a pattern newly added to `.gitignore`, such as "Ignore `web/screenshots/` and `web/evidence/`", is credited against the added, non-comment lines of that file's own diff, with the trailing slash a directory claim carries normalized against the raw pattern. Both credits reach past the anchored-and-leading split that decides `unmet`, and the ignore-addition credit marks `.gitignore` itself as named, so the file also stops reading as `unnamed`.

Neither credit can tell a claim that is genuinely stale from one the evidence would have credited had the read gone through, since a failed fetch and a confirmed absence both produce the same empty result. `evidenceUnread` on the record separates the two: when the read that could have credited a claim fails, that claim lands in `unresolved` instead of `unmet`, rather than risk the exact false accusation this section exists to remove.

One class stays open and is named rather than closed. A bullet can cite where something is defined while claiming an edit somewhere else, as `erclx/canon#1274` does with "Name the slug transform in `standards/slug.md` inline in the same step". The path is a definition site, the edit target is the step, and separating the two needs the sentence parsed rather than cut. A finding on such a bullet is this class rather than a stale claim, and a reader weighing an `unmet` path checks whether the bullet's real target is a locative the path does not name. <!-- canon-allow-reference: illustrates the input shape the rule reads -->

## Where it runs

`review-pr` Step 3 calls it through its `references/key-changes.md` and files an `unmet` path as a `should-fix` finding under the `**PR body**` block the stale ticked box already takes, since what both corrupt is the merge record rather than a file in the diff. A body is edited between pushes, so a finding names the head the comparison ran at. `unnamed` is read there and raised off no count, since the step's own history is a question sent over bullets that already answered it. `unresolved` and `incidental` are reported nowhere.
