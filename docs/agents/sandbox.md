---
title: Sandbox
description: Scenario routing, the expectation scoring surface, and the coverage census over scenarios and skills
---

# Sandbox

`canon sandbox` provisions isolated project states, scores a provisioned one against a declared expectation, and reports which scenarios declare an expectation at all.

## Scenarios

Scenarios live under `scripts/sandbox/`, one folder per category. `scripts/sandbox/fixtures/` is the exception, holding file content that scenarios stage rather than scenarios of its own, so both pickers filter it out. `files` in `package.json` excludes that tree, so an installed `canon` carries the command, reports it as toolkit-only on one line, and exits 1 rather than failing on the missing directory. Route non-interactively with `SANDBOX_SCENARIO`:

```bash
SANDBOX_SCENARIO=sync canon sandbox infra:tooling
```

Scenario categories: `infra:*` (domain flows), `git:*`, `scaffold:*`. `create` scenarios require interactive input and loop on empty input, so skip them in automated runs.

## Scenario expectations

`canon sandbox check <category>:<command> [arm]` scores a provisioned sandbox against the arm's `expect.toml`, printing a verdict on stderr and, with `--json`, the same verdict as a record on stdout.

```bash
canon sandbox check claude:docs-fold drift --json
```

| Flag                           | Effect                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `--envelope <file>`            | Read `is_error`, `num_turns`, denials, and the reply text                                                         |
| `--writes <file>`              | Newline-delimited paths the session wrote, for write scope                                                        |
| `--escapes <file>`             | Newline-delimited paths written to a watched toolkit root, for escape scope                                       |
| `--escapes-watched`            | At least one watched root held a target this run                                                                  |
| `--concurrent-sessions <file>` | Newline-delimited sessions live in the registry both before and after this run, a witness for an unbounded escape |
| `--json`                       | Emit the verdict record on stdout                                                                                 |
| `--strict`                     | Exit 1 on `unchecked` instead of 0                                                                                |

The verdict `state` is `pass`, `fail`, or `unchecked`. An arm with no `expect.toml` is `unchecked` and exits 0, so the harness stays usable while expectations roll out. A declaration that exists but asserts nothing is a failure, since an expectation file that asserts nothing passes every run.

Omitting `--writes`, `--escapes`, or `--envelope` does not silently drop the assertion kinds that need them. Write scope, escape scope, the turn ceiling, and the reply assertion report as unchecked and appear in the count, so the standalone command cannot claim more coverage than it had. Supplying `--escapes` without `--escapes-watched` reports the same way: a zero-escape result with no root confirmed watched is unmeasured rather than a pass. A verdict never reports `pass` with zero assertions.

An arm declaring `escape_scope` asserts a bound on `run.sh`'s own escape watch rather than on the sandbox tree. `write_scope` skips when the run wrote nothing, since a required output missing is itself a finding, but `escape_scope` passes on zero escapes outright, since a clean run producing none is the expected outcome for a destination nothing requires a skill to touch, provided `--escapes-watched` confirms a root held something to watch. Declaring `escape_scope = []` asserts that a correct run reaches none of the watched destinations at all. `canon/context/sandbox/overview.md` names what the watch reaches and what it cannot.

An envelope that parses but carries no `result` field skips the reply assertion the same way an absent file does. An envelope carrying an empty `result` fails it, since a run that returned no text is a finding rather than a gap in the input.

Exit 0 means `pass` or `unchecked`. Exit 1 means `fail`, or a caller error: a malformed target, or a sandbox that was never provisioned. A missing sandbox reports as an error rather than a failed verdict, because failing every path assertion would read as a skill that did nothing. `--strict` moves `unchecked` to exit 1 for a caller that has finished arming its scenarios.

## Scenario coverage

`canon sandbox coverage` reports which scenarios declare expectations and which only provision a state. It reads the fixture tree, so it needs no provisioned sandbox and runs nothing. Where that tree does not ship it exits 1 and prints no percentage, since a denominator nobody looked at is not a coverage result. A tree that is present and holds no scenarios is a real zero and still reports one.

```bash
canon sandbox coverage --json
```

| Flag       | Effect                                                      |
| ---------- | ----------------------------------------------------------- |
| `--json`   | Emit the coverage record on stdout                          |
| `--strict` | Exit 1 while any scenario declares no expectation           |
| `--skills` | Add a per-skill asserted, should-be-asserted, exempt census |

The record carries every scenario with the arms that declare, plus `totalScenarios`, `armedScenarios`, and `armedArms`. Scenarios and arms count separately, since several arms can share one scenario and dividing one by the other overstates the rollout.

### The skills census

`--skills` answers what the scenario count cannot, which is whether anything can fail a given skill. It adds `skills`, `totalSkills`, `asserted`, `shouldBeAsserted`, `exempt`, `staleExemptions`, and `supersededExemptions` to the record, and keeps the scenario view rather than replacing it. The two denominators disagree on purpose: an armed scenario under `infra/` or `tooling/` exercises a CLI domain and pairs with no skill at all.

A skill pairs to a scenario by filename, `<category>-<command>` first and bare `<command>` second, so `claude/setup-init.sh` reaches the `setup-init` skill. `should-be-asserted` is the default rather than a queue to drain, and which of those skills earns an arm is a project decision the census does not make.

`exempt` means no arm should be written and holds only with a reason, declared in `scripts/sandbox/exempt.toml` and limited to a harness limit the checker cannot reach past or a skill that writes no artifact. An armed arm outranks an exemption. An exemption naming no shipped skill, or naming one an arm now asserts, exits 1 without `--strict`. Each armed arm reports as `<category>:<command>/<arm>`, so two same-named arms under different scenarios stay distinct.

`scripts/sandbox/run.sh` calls this after a headless run and merges the verdict into the envelope it prints. It also writes that merged record to `.canon/tmp/sandbox-runs/<target>-<arm>-<timestamp>.json` with a `writes` array appended, and logs the path on stderr. Both fields are what a later re-score needs, since `--envelope` and `--writes` read files the run deletes on exit.

Two more fields ride alongside the verdict rather than inside it. `escapes` lists what the run wrote under a watched toolkit root, which the verdict cannot assert over because those files sit outside the sandbox tree. `sessions` reports the nested-dispatch bound, carrying `watched` for whether the client's session registry was there to read, `new` for the records that appeared while the run was in flight, `concurrent` for the records present both before and after, and `reap` for what the run found in the session's process group afterwards. Neither field fails a run on its own.

`run.sh` passes `concurrent` through `--concurrent-sessions` to `sandbox check`, and `checkEscapeScope` appends a witness count to an `unbounded escape:` message rather than lets it soften the verdict.
