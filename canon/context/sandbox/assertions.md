---
title: Assertions
description: The expect.toml declaration keys, the checker and its verdicts, and how to write an assertion a wrong run can fail
---

# Assertions

An arm declares what a correct run leaves behind in `expect.toml`, beside its numbered stage directories. `canon sandbox check <category>:<command> [arm]` reads it, asserts against the sandbox tree, and prints a verdict. Run it standalone against an already-provisioned sandbox to iterate without paying for another session.

## Layout

### Declaration keys

Eight keys make up a declaration.

| Key            | Holds                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `paths`        | files that must exist after the run, as an exact path or a glob                                               |
| `absent`       | files that must not exist, as an exact path or a glob                                                         |
| `content`      | an array of tables, each a `path` and a `pattern` it must match                                               |
| `write_scope`  | globs bounding where the session may write                                                                    |
| `escape_scope` | globs bounding what the escape watch may find, per `canon/context/sandbox/isolation.md`                       |
| `reply`        | literal substrings the reply must carry, never patterns, stopping before a part the run varies such as a port |
| `manual`       | prose the checker cannot assert, reported as unchecked                                                        |
| `max_turns`    | turn ceiling, above which the run fails                                                                       |

The split between mechanical and human-judged is per expectation, not per skill. The `claude:context-fold` `drift` arm produces both kinds in one run.

An `infra` arm invoking the CLI directly declares the same way, minus `max_turns`, since no agent drives it and a ceiling would sit permanently skipped. `infra/wiki` carries one declaration per arm and is the pattern to copy for a CLI scenario.

## Decisions

### The checker and its verdicts

A run reports pass, fail, or unchecked, and only a failure exits non-zero. A missing declaration is `unchecked` rather than a pass, since a scenario asserting nothing cannot pass, and rather than a failure, since failing every undeclared arm would make the harness unusable while expectations roll out.

- An assertion kind whose input the caller did not supply reports as unchecked rather than dropping out of the count, so omitting `--writes` cannot make write scope vanish from the standalone path
- A verdict never reports `pass` having asserted nothing, since the declaration counts globs while the verdict counts writes and the two diverge at zero
- `unchecked` keeps its name rather than becoming `unproven`, since a second word for one state costs more than the clearer label gains

### Strict mode and the checker module

`--strict` inverts the exit rule for a caller that has finished arming, turning a single `unchecked` verdict into a non-zero exit. It stays opt-in so undeclared scenarios keep running.

The checker is its own module apart from provisioning. Its failure mode is asserting nothing while reporting green, which is invisible at runtime, so it has to be the unit-testable part.

- `src/sandbox/expect.test.ts` builds a tree per assertion kind that violates it and requires a red verdict
- A checker exercised only against a correct tree cannot tell asserting correctly from asserting nothing

### What counts as an assertion

A declaration that exists and declares no mechanical assertion fails. That is the silent-truncation failure `scripts/core/install-check.sh` documents in its own comment, where a domain with no assertion stays green while its output shrinks to nothing.

Prose in `manual` does not count toward the total, or an arm could carry five lines a checker cannot read and still report green. An entry leaves `manual` only once it is verified against a real run's output rather than declared from the fixture.

### Bounding keys

Widen a `write_scope` from a measured write list, never from what a skill body says it writes. A scope written from expectation misses what running the skill produces, such as a lockfile or a test-results folder.

- A bounding key whose only passing value admits the whole tree asserts nothing
- An arm running a real installer needs `**` to admit a correct run, then reports thousands of in-scope `node_modules` paths and 0 failures, a count no wrong run could move
- Before declaring a bounding key, name the wrong run it would catch. Where none falls outside it, drop the key, state the reason, and keep the gap in the unchecked count with a `manual` entry.

### Negatives

Never invert a demoted assertion into `absent`. Where a claim cannot be read, the filenames a wrong run would have chosen stay undeclared, because an `absent` entry passes for the file being elsewhere rather than for the run being correct. That is the vacuous pass `manual` is excluded from the count to prevent.

An arm over a step that reports rather than writes needs `reply`, because every tree assertion it can make is a negative, and a declaration of only negatives passes hardest on the skip it exists to detect. A record pinned byte-identical is satisfied by a run where the step never fired, and `reply` substrings separate the two.

### Patterns

Three rules keep a pattern honest.

- Patterns use TOML literal strings (`'^- \[x\] done'`) so a regex needs no backslash escaping. A literal string cannot carry an apostrophe, so a pin over prose spells that character `.`.
- A basic string would reintroduce the backslash doubling, and shell-style `'"'"'` quoting produces a file that does not parse while reading as plausible
- Every pattern compiles with `m` and nothing else. An inline `(?i)` fails to compile and reads as invalid, so spell case variants as an alternation such as `(?:loading|Loading)`.
- `content` matches positively, so pinning a block from its first line to its last asserts that nothing inside it changed. Anchor the block below any frontmatter a run may append to.

### Globs

An entry carrying `*` is matched as a glob under `paths`, `absent`, and `content`, and the result names the file that matched. That lets an arm name a file whose name a run derives rather than fixes, where pinning one spelling passes vacuously against every other.

It covers both directions, being the per-session handoff `claude:role-orchestrator` must not write, and the numbered lesson `claude:teach-workspace` must.

- A glob matching several files answers with one of them in no fixed order, so an arm asserting content through one seeds a folder holding a single match
- A `content` path matching nothing falls back to itself, which keeps the miss reported against the entry as spelled

### Reply pins

`reply` reads `result` off the envelope `max_turns` reads. Entries are plain substrings matched case-sensitively, because the token worth asserting is a path or a command, and a regex invites an anchored sentence that goes red on any rewording. An absent envelope skips the assertion, and an empty reply fails it.

- Pin a token the fixture fixes, and send a token the run chooses to `manual`, since one such as a board report's `Next:` skill can flip between runs
- A pin scores the whole reply rather than the slot it was written about, so where a token repeats across a reply, write the row into `manual`
- Declare only positives, since an entry asserting what a run must not have said passes on every reply that phrases it differently
- Repeated runs against one unchanged fixture returning the same count say the sample agrees, not that the arm is deterministic

### Manual entries

Every `manual` entry states why it stays there, as a label on the claim. Without the label the bucket absorbs three cases, and work with a mechanism waiting for it reads the same as work that will never have one.

- `Semantic:` marks a claim no string match can carry
- `Unwired:` marks one needing an input the harness does not supply, such as stderr or the tool calls
- `Judgment:` marks one a string match reaches against a token the run chooses rather than the fixture, so it passes or fails on a wording

A step whose outcome reaches neither the tree nor the reply takes `Unwired:` rather than a pin over the artifact it feeds. `claude:session-map` opens by invoking capture, and a cold fixture gives capture nothing to persist, so a pin over the map fails a conforming run. Admit the folder in `write_scope` so a run that did capture stays in bounds.

## Gotchas

### Parsing and table placement

A green gate says nothing about whether an arm parses. The Sandbox coverage stage counts scenarios declaring expectations without reading what they declare, so a malformed `expect.toml` passes `bun run check` and surfaces only under `canon sandbox check`. Parse a hand-edited arm directly before trusting a green gate over it.

A bare key below a `[[content]]` header belongs to that table, not to the document. A `max_turns` or `manual` placed there never asserts and never reaches the unchecked count, while the arm still reads as armed. `contentArray` throws on any key beside `path` and `pattern`, so place every top-level key above the first `[[table]]` header.

### Negative lookaheads

A `[[content]]` pattern compiles with the `m` flag and `.test()` runs once against the whole file. A negative lookahead anchored `^(?!.*foo).*$` matches the first line lacking the substring and passes while another line carries it.

Anchor the absence pattern at the file start with `(?<![\s\S])`, as `claude:test-craft`'s `pull` arm does, to hold over the whole file.

### Pending verdicts and claims

Three habits keep a verdict readable.

- A pending verdict pins the format its fixture asserts, so before changing a format such as a task's `Plan:` line, grep the fixtures for assertions on it
- A scenario's `log_info` line describing a chained skill is a claim to check against that skill's body, not a specification to transcribe
- A step that may legitimately write nothing on a headless single-pass run takes no `paths` assertion on its receipt
- An assertion over a string the body mandates is deterministic, and one depending on a pass electing to emit it is not
- The `claude:review-pr` `repeat-close-out` arm pins `^## Review closed`, but a pass raising a finding posts `## Review`, so re-run before editing the pin or the skill
