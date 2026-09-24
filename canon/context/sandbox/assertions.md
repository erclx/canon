---
title: Assertions
description: The expect.toml declaration keys, the checker and its verdicts, and how to write an assertion a wrong run can fail
---

# Assertions

An arm declares what a correct run leaves behind in `expect.toml`, beside its numbered stage directories. `canon sandbox check <category>:<command> [arm]` reads it, asserts against the sandbox tree, and prints a verdict. Run it standalone against an already-provisioned sandbox to iterate without paying for another session.

## Decisions

### The checker and its verdicts

- A run reports pass, fail, or unchecked, and only a failure exits non-zero. A missing declaration is `unchecked` rather than a pass, since a scenario that asserts nothing cannot pass, and rather than a failure, since failing every undeclared arm would make the harness unusable while expectations roll out.
- An assertion kind whose input the caller did not supply reports as unchecked rather than dropping out of the count. Omitting `--writes` would otherwise let write scope vanish from the cheap standalone path, which is the path most likely to be trusted. A verdict never reports `pass` having asserted nothing, since the declaration counts globs while the verdict counts writes and the two diverge at zero.
- `unchecked` keeps its name rather than becoming `unproven`. A second word for one state costs more than the clearer label gains.
- `--strict` inverts the exit rule for a caller that has finished arming, and turns a single `unchecked` verdict into a non-zero exit. It stays opt-in so undeclared scenarios keep running.
- The checker is TypeScript while provisioning stays bash. Provisioning is `git` and `gh` orchestration plus copying trees, which bash suits. The checker parses a declaration, aggregates partial failures, and emits counts, and its failure mode is asserting nothing while reporting green, which is invisible at runtime, so it has to be the unit-testable part.
- `src/sandbox/expect.test.ts` builds a tree per assertion kind that violates it and requires a red verdict. A checker exercised only against a correct tree cannot tell asserting correctly from asserting nothing, so the negative trees are the point.

### What counts as an assertion

A declaration that exists and declares no mechanical assertion fails. That is the silent-truncation failure `scripts/core/install-check.sh` documents in its own comment, where a domain with no assertion stays green while its output shrinks to nothing. Prose in `manual` does not count toward the total, or an arm could carry five lines a checker cannot read and still report green.

An entry leaves `manual` only once it is verified against a real run's output rather than declared from the fixture.

### Bounding keys

- Widen a `write_scope` from a measured write list, never from what a skill body says it writes. A scope written from expectation misses what running the skill produces, such as a lockfile or a test-results folder, and reports violations against a correct run.
- A bounding key whose only passing value admits the whole tree asserts nothing. An arm running a real installer with `bun install` behind it needs `**` to admit a correct run, and then reports thousands of in-scope `node_modules` paths and 0 failures, a count no wrong run could move. Before declaring a bounding key, name the wrong run it would catch. Where none falls outside it, drop the key, state the reason, and keep the gap in the unchecked count with a `manual` entry.

### Negatives

- Never invert a demoted assertion into `absent`. Where a claim cannot be read, the filenames a wrong run would have chosen stay undeclared, because an `absent` entry passes for the file being elsewhere rather than for the run being correct. That is the vacuous pass `manual` is excluded from the count to prevent.
- An arm over a step that reports rather than writes needs `reply`, because every tree assertion it can make is a negative, and a declaration of only negatives passes hardest on the skip it exists to detect. `claude:docs-fold/anchor-sweep` pins a record that has to survive the run byte-identical, which a run where the step never fired satisfies, and two `reply` substrings separate the two.

## Gotchas

- A green gate says nothing about whether an arm parses. The Sandbox coverage stage counts scenarios declaring expectations without reading what they declare, so a malformed `expect.toml` passes `bun run check` and surfaces only under `canon sandbox check`. Parse a hand-edited arm directly before trusting a green gate over it.
- A bare key below a `[[content]]` header belongs to that table, not to the document. A `max_turns` or `manual` placed there never asserts and never reaches the unchecked count, while the arm still reads as armed. `contentArray` throws on any key beside `path` and `pattern`, so place every top-level key above the first `[[table]]` header.
- A `[[content]]` pattern compiles with the `m` flag and `.test()` runs once against the whole file, so a negative lookahead anchored `^(?!.*foo).*$` matches the first line lacking the substring and passes while another line carries it. The absence pattern anchored at the file start with `(?<![\s\S])`, used by `claude:test-craft`'s `pull` arm, holds over the whole file.
- A pending verdict pins the format its fixture asserts. Before changing a format, such as turning a task's `Plan:` line into a markdown link, grep the fixtures for assertions on it and check whether an owning task still carries an unchecked verification outcome. A failing run afterward otherwise reads as neither a skill defect nor a format change.
- A scenario's `log_info` line describing a chained skill is a claim to check against that skill's body, not a specification to transcribe. `memory-capture` stops with "Nothing worth capturing" on a headless single-pass run with no interaction, so a `paths` assertion on its receipt fails every correct run.
- An assertion over a fixed string the body mandates is deterministic, and one that depends on a pass electing to emit that string is not. The `claude:review-pr` `repeat-close-out` arm pins `^## Review closed`, and an independent pass that legitimately raises a finding on the seeded commit posts `## Review` instead. Read a red pin of that shape as the arm scoring a judgment, and re-run before editing either the pin or the skill.

## Declaration keys

- `paths`: files that must exist after the run, as an exact path or as a glob
- `absent`: files that must not exist, as an exact path or as a glob
- `content`: array of tables, each a `path` and a `pattern` it must match, the path taking either form
- `write_scope`: globs bounding where the session may write
- `escape_scope`: globs bounding what the escape watch may find, per `canon/context/sandbox/isolation.md`
- `reply`: substrings the run's reply text must carry
- `manual`: prose the checker cannot assert, reported as unchecked
- `max_turns`: turn ceiling, above which the run fails

The split between mechanical and human-judged is per expectation, not per skill. The `claude:docs-fold` `drift` arm produces both kinds in one run.

An `infra` arm invoking the CLI directly declares the same way, minus `max_turns`. No agent drives it, so no envelope is produced and a ceiling would sit permanently skipped. `infra/wiki` carries one declaration per arm and is the pattern to copy for a CLI scenario.

## Writing an assertion

### Patterns

- Patterns use TOML literal strings (`'^- \[x\] done'`) so a regex needs no backslash escaping. A literal string cannot carry an apostrophe, so a pin over prose spells that character `.`, costing one character of precision. A basic string would reintroduce the backslash doubling the literal form avoids, and shell-style `'"'"'` quoting produces a file that does not parse while reading as plausible.
- Every pattern compiles with `m` and nothing else. An inline `(?i)` fails to compile and the result names it invalid rather than unmatched. Spell case variants as an alternation such as `(?:loading|Loading)`.
- Prefer a case-stable substring where the fold is not load-bearing. A bracket class in the middle of a word reads as a fragment to cspell, which fails the spell stage of `bun run check` on the remainder, so the whole word in each branch is what passes both.
- `content` matches positively, so pinning a block from its first line to its last asserts that nothing inside it changed. Anchor the block below any frontmatter a run may append to, or the append pushes the closing line and fails a correct run.

### Globs

An entry carrying `*` is matched as a glob under `paths`, `absent`, and `content`, and the result names the file that matched. That lets an arm name a file whose name a run derives rather than fixes, where pinning one spelling passes vacuously against every other. It covers both directions: the per-session handoff `claude:role-orchestrator` must not write, and the numbered lesson `claude:teach-workspace` must.

A glob matching several files answers with one of them in no fixed order, so an arm asserting content through one seeds a folder holding a single match. A `content` path matching nothing falls back to itself, which keeps the miss reported against the entry as spelled.

### Reply pins

`reply` reads `result` off the envelope `max_turns` reads, so it costs nothing new to capture. Entries are plain substrings matched case-sensitively, because the token worth asserting is a path or a command, and a regex invites an anchored sentence that goes red on any rewording. An absent envelope skips the assertion, and an envelope carrying an empty reply fails it.

- Pin a token the fixture fixes, and send a token the run chooses to `manual`. A pin on a token the skill chooses, such as the skill named on a board report's `Next:` line, can flip between two runs against one unchanged fixture. Read a single failure of that shape against a second run before calling it a regression.
- A label the skill's own `## Output` template spells is fixed by the body, so a run rewording it has stopped following the template, and the pin catches that. `claude:restate-plainly` pins its `Cut:` line on that basis.
- A pin scores the whole reply rather than the slot it was written about. Where a token repeats across a reply, write the row into `manual`, since anchoring the pin costs the regex declined above.
- Declare only positives. An entry asserting what a run must not have said passes on every reply that phrases the thing differently. Negatives stay in `manual`.
- Repeated runs against one unchanged fixture returning the same count say the sample agrees, not that the arm is deterministic. Nothing counts what an arm gives up by moving a pin to `manual`, so a coverage number falling for a good reason looks identical to one falling for a bad one.

### Manual entries

Every `manual` entry states why it stays there, as a label on the claim. Without the label the bucket absorbs all three cases, and work with a mechanism waiting for it reads the same as work that will never have one.

- `Semantic:` marks a claim no string match can carry.
- `Unwired:` marks one needing an input the harness does not supply, such as stderr or the tool calls.
- `Judgment:` marks one a string match reaches against a token the run chooses rather than one the fixture fixes, so it passes or fails on a wording.

A step whose outcome reaches neither the tree nor the reply takes `Unwired:` rather than a pin over the artifact it feeds. `claude:session-map` opens by invoking capture, and a cold fixture gives capture nothing to persist, so a pin over the map fails a conforming run. Admit the folder in `write_scope` so a run that did capture stays in bounds.
