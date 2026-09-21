---
title: Running
description: Prerequisites, the command surface, headless skill testing, and the expectation declaration
---

# Running a scenario

## Prerequisites

Nine scenarios push to a real GitHub remote. They need an authenticated `gh` and membership in the org that owns `aitk-sandbox`, which is private. Everything else runs offline against an empty sandbox.

```bash
gh auth login   # required for any scenario declaring use_anchor
```

Provisioning itself is offline now that the starting tree comes from a fixture, so the first network call is the probe `configure_sandbox_anchor_remote` runs before it adds the remote. That probe turns a missing credential or an unreachable host into a named error at the top of the run rather than a raw push failure partway through it. `GIT_TERMINAL_PROMPT=0` keeps a credential failure immediate instead of a blocked prompt.

An absent repository reports separately and refuses, naming both repairs, and `SANDBOX_ANCHOR_CREATE=true` opts into creation instead. `canon/context/sandbox/authoring.md` covers why the default refuses and how the two sibling verbs differ. Org membership is a real requirement and not an accident of the setup, since HTTPS fixes transport rather than authorization and a contributor outside the org still cannot run the anchor scenarios.

## Running

```bash
canon sandbox                        # interactive category + command picker
canon sandbox infra:gov install      # run a specific scenario non-interactively
canon sandbox reset                  # restore sandbox to baseline
canon sandbox clean                  # wipe sandbox entirely
```

When a scenario argument is passed, `manage-sandbox.sh` sets `SANDBOX_SCENARIO` and `CANON_NON_INTERACTIVE=1` automatically. Multi-scenario scripts call `select_or_route_scenario` from `lib/ui.sh`, which reads `SANDBOX_SCENARIO` and skips the picker when set.

Every verb above is toolkit-only and refuses under an installed `canon`, reporting `sandbox is toolkit-only and is absent from an installed canon`. Run this checkout's own entry point instead, as `bun src/cli.ts sandbox <verb>`. The refusal names its cause, so it does not read as a broken tree, but a session that takes it at face value concludes the verb no longer exists rather than reaching for the local CLI. A linked worktree meets this on every sandbox read, since the `canon` on the path resolves to the published binary rather than to the branch under it.

The `internal-sandbox-check` skill maps changed plugin skills and changed `scripts/` files on a feature branch to their matching scenarios, so an e2e gap on a script edit surfaces the same way it does on a skill edit.

## Headless skill testing

`scripts/sandbox/run.sh` drives a skill through `claude -p` non-interactively, so a session can test a skill without a human opening an interactive sandbox. It provisions a scenario, invokes the skill from the sandbox tree, and prints the run envelope as JSON on stdout with a framed summary on stderr.

```bash
scripts/sandbox/run.sh <cat:cmd> "<prompt>" [scenario]
scripts/sandbox/run.sh git:commit "/canon:git-commit"
scripts/sandbox/run.sh claude:plan-feature "/canon:plan-feature add a widget" small
```

The prompt is the explicit skill invocation. Use the `/canon:<skill>` form so `--plugin-dir` resolves the skill whether or not the branch changed it. A bare `/<skill>` only resolves for skills the sandbox injects, which is the subset changed on the current branch.

An injected skill is a copy of its `SKILL.md` alone, made by `inject_changed_skills` in `scripts/manage-sandbox.sh`, with none of its `references/` beside it. A project skill outranks a plugin skill of the same name, so a run that reaches the skill by its bare name or by a description match loads that copy, and every `${CLAUDE_SKILL_DIR}/references/` path in it resolves to nothing. Remove the injected folder before driving an arm for a skill that carries references, so `--plugin-dir` supplies the whole skill.

Carry the arguments the arm needs. A skill guarding on a missing argument answers the bare form with its own refusal and never reaches the behavior under test, so every assertion fails against a skill that is working correctly. `claude:plan-intake/file` states its invocation on the scenario's own `Action:` line, and a bare prompt returns the no-dump refusal instead. Read the `Action:` line before composing the prompt, since it is where an arm records what it expects to be handed. `internal-sandbox-check` fixes the prompt at `/canon:<skill-name>` with no arguments, so a caller following it hits this on any such arm and should report the mismatch rather than reading it as a defect in the skill.

A multi-arm scenario puts the headless run out of reach of an unattended ship. `internal-sandbox-check` bans guessing the arm and sends that question to a person, so a dispatched worker with nobody watching takes the `no-mechanism` gate on every multi-arm pairing and the branch ships with its scenario provisioned and unverified. The gate is the honest report rather than a defect to route around, since `CANON_NON_INTERACTIVE=1` would hand the picker the first arm and return a verdict against an arm nobody chose.

A sandbox session resolves `canon` off the machine's PATH, and the harness manages neither the binary nor the variable. An arm exercising a verb the branch adds therefore runs against whatever is installed globally, and a released binary predating the verb produces a session that refuses and writes nothing, failing every assertion for a reason the arm is not about. Put the branch's own CLI ahead on PATH for that run rather than reading the failure as a defect in the skill, and never repair it by installing over the operator's global.

The JSON envelope carries `is_error`, `result`, `num_turns`, and `total_cost_usd`, plus a `verdict` object holding `state`, `asserted`, `failed`, and `unchecked`. Override the model, allowed tools, turn cap, or permission mode with `CANON_SKILL_TEST_MODEL`, `CANON_SKILL_TEST_TOOLS`, `CANON_SKILL_TEST_MAX_TURNS`, and `CANON_SKILL_TEST_PERMISSION_MODE`.

The envelope alone decides nothing. An arm can return `error=false` having written nothing and meeting none of its scenario's stated expectations, so a suite scoring on the envelope would count it as a pass. `run.sh` snapshots the tree before the session, diffs it after, and hands the result to `canon sandbox check`, whose exit code becomes the run's outcome.

### A tree of its own, minted per run

The sandbox tree resolves from `$XDG_STATE_HOME/canon/sandbox-<run-id>`, defaulting to `~/.local/state/canon/sandbox-<run-id>`, with `CANON_SANDBOX_DIR` overriding the whole path and a path back inside the repository refused.

Never point `CANON_SANDBOX_DIR` under `~/.claude/`, such as a background job's own scratch folder. Provisioning succeeds there, and the driven session then has every `Write` refused as a sensitive path, so it plans its files in the reply and writes none. Two headless runs measured it on 2026-09-19, and nothing in the provisioning guard refuses the path.

`<run-id>` is a short random suffix `resolve_sandbox_dir` and `sandboxTree` mint the first time a process asks for the default, so two sessions provisioning at once land on two different trees rather than one and cannot provision over each other. `canon/context/sandbox/overview.md` carries how the id is minted and held.

A caller resolving the tree standalone, apart from the provisioning that populated it, does not find it this way. `canon sandbox check <target>` run as its own command after a separate `canon sandbox <target>`, and `canon sandbox reset` or `canon sandbox clean` run alone, each mint a fresh id and miss the tree the earlier command minted. Pin one with `CANON_SANDBOX_DIR` across the whole sequence to keep iterating against a single tree, the same override a session already sets to run arms of its own while another session has the sandbox open.

An escape list covering the whole tree, or a failure count far past what the arm declares, reads as a collision rather than a finding: two commands sharing one hand-set `CANON_SANDBOX_DIR` by mistake puts two sessions back on a tree neither has a reason to be told about. The `escapes` array reports the sibling case: it names any file that changed under the toolkit roots during the run, so a concurrent session writing shared session scratch at the main root appears there as an escape the sandbox session never made. `run.sh` names that sibling where the client's own session registry caught it: a session present in the registry both before and after the run appears beside the escape warning and, when the arm declares `escape_scope`, inside the `unbounded escape:` message itself.

### The run record

Every run also lands at `.canon/tmp/runs/sandbox/<target>-<arm>-<timestamp>.json`, and `run.sh` logs the path on stderr. The file holds what stdout emitted plus a `writes` array. Both are needed to score a run again later: `canon sandbox check` recovers the tree-based assertions from surviving sandbox state, but `max_turns` reads the envelope and `write_scope` reads the writes list, and the temp files carrying those are deleted at the end of the run.

The record is gitignored scratch with no rotation, one file per run. Writing it is additive and stdout stays the data contract, so a failure to record warns and prints the verdict anyway. What that costs is the turn count, which is recoverable from nowhere else once the run's temp files are deleted, so an arm whose record failed to write cannot have its ceiling calibrated without paying for the run twice. `claude:canon-operator/fresh` is declared at the cap for that reason rather than from an observation.

The warning sits on stderr among the framing, where a caller reading the tail of a passing run does not see it. Nothing prunes the folder, which makes it a scratch-lifecycle question rather than an oversight.

When the skill session itself exits non-zero, `record_dead_run` stamps `{is_error, exit_code, raw_output}` to `.canon/tmp/runs/sandbox/<target>-<scenario>-<stamp>.json` ahead of that exit, mirroring the record `record_run` writes on the success path, and `run.sh` logs the path the same way, so the run that most needs a record still gets one.

An earlier silent failure carries its own message rather than the session-exit one. A non-zero exit from `manage-sandbox.sh` during provisioning logs `Provisioning exited <n> before the session could start.`, distinguishing that failure from the session-exit case above, since both otherwise leave the same absent verdict and no run record.

### Turn budget

The default turn cap is 30. A clean `claude/docs` `drift` run takes 29 turns, and a truncated run fails the same assertions as a reasoning miss with nothing to tell them apart, so the global default sits above observed cost.

Declare an arm's ceiling at the default and correct it from an observation. A ceiling under the cap catches truncation the same way an equal one does, since a truncated run reports one turn past the cap and any declaration at or under the cap sits below that number. What a corrected ceiling buys over the default is that it asserts something the runner does not already enforce, which is what `anchor-sweep` carries at 26 against three runs of 16, 17, and 18.

Correct from a cost that holds rather than from one sample of a variable one. A cost holds when the arm's work has a fixed extent, which one observation bounds: a route-only arm that resolves off one read with nothing to execute behind it can take its ceiling from a single run. A cost varies when the work follows whatever the run finds, so that arm needs several runs and a ceiling above the widest, which is what `anchor-sweep` carries.

A retired superseded-proposal arm stayed at the default on a single 17-turn pass for that reason, since a proposal-only arm resolves several files against several standards and its count moves with how a run orders those reads. Sample count is the consequence rather than the test, and reading it as the test puts a ceiling on any arm that has been run twice. A ceiling derived from one path through a variable cost trades a ceiling that never fires for one that fires on a correct run.

Never declare a ceiling above the cap. A truncated run reports one turn past the cap, a declaration above the cap is at least that number, and the checker fails an arm only on a count strictly over its ceiling. The turn assertion goes green, only the assertions that were going to fail anyway go red, and the ceiling masks the one failure it exists to catch.

Estimate an arm's cost from what it reads rather than from what it writes. `board-sweep` was projected to need a raised cap because it marks one more outcome and moves one more plan than `drift`, and it came in at 28 against `drift`'s 29. The extra mutations are a few edits, while the turns go to reading the board and reasoning about it, which both arms do once. A projected budget is worth nothing next to one real run.

`CANON_SKILL_TEST_MAX_TURNS` is the only budget. An arm's `max_turns` is a ceiling the checker asserts after the run, and `run.sh` never reads `expect.toml`, so a declaration cannot raise the cap it runs under. An arm needing more than the default truncates.

Raise the default or set the variable per run. A per-arm budget would need `run.sh` to parse the declaration, which nothing has yet asked for.

Dollar cost spreads wider than the turn count, and the range `internal-sandbox-check` documents covers the cheap half alone. Its gate table rules out `cost` for a single arm on a stated 0.10 to 0.25 dollars, which a proposal-only arm meets and a provisioning one does not: `claude:plan-groundwork` `open` comes in at 1.05 dollars, roughly five times the top of that range, because the skill session stages a three-package workspace and writes a three-file track rather than resolving a route off a few reads. Read the documented range as a floor when the arm's skill does the domain work, and keep the gate ruled out either way, since one arm at a dollar is still affordable against the branch it verifies.

## Expectations

An arm declares what a correct run leaves behind in `expect.toml`, beside its numbered stage directories. `canon sandbox check <category>:<command> [arm]` reads it, asserts against the sandbox tree, and prints a verdict. Run it standalone against an already-provisioned sandbox to iterate without paying for another session.

- `paths`: files that must exist after the run, as an exact path or as a glob
- `absent`: files that must not exist, as an exact path or as a glob
- `content`: array of tables, each a `path` and a `pattern` it must match, the path taking either form
- `write_scope`: globs bounding where the session may write
- `reply`: substrings the run's reply text must carry
- `manual`: prose the checker cannot assert, reported as unchecked
- `max_turns`: turn ceiling, above which the run fails

### Writing an assertion

Patterns use TOML literal strings (`'^- \[x\] done'`) so a regex needs no backslash escaping. The split between mechanical and human-judged is per expectation, not per skill: the `claude/docs` `drift` arm produces both kinds in one run, three the checker asserts and two needing a reader.

Every pattern compiles with `m` and nothing else. An inline `(?i)` is not a flag in this engine, so a pattern carrying one fails to compile rather than matching case-insensitively, and the result names it invalid rather than unmatched. Spell the folding as character classes.

Spelling one costs a gate, though, so prefer a case-stable substring where the fold is not load-bearing. cspell strips the bracketed pair and reads what follows as a word, so a pattern folding the first letter of an ordinary English word fails the spell stage of `bun run check` on the headless remainder. Adding the remainder to a dictionary files a regex artifact as a term, and quoting the failing pattern in prose reproduces the failure in the file describing it, so dropping the folded letter out of the pattern is the fix.

A literal string cannot carry an apostrophe, which is what closes it. A pin over prose spells that character `.` instead, costing one character of precision per apostrophe. Switching to a basic string to escape it would reintroduce the backslash doubling the literal form exists to avoid.

An entry carrying `*` is matched as a glob under all three of `paths`, `absent`, and `content`, and the result names the file that matched rather than the pattern that found it. That is what lets an arm name a file whose name a run derives rather than fixes, where pinning one spelling of the derived name passes vacuously against every other spelling and reads as coverage the arm does not have. It covers both directions: the per-session handoff `claude/orchestrate` must not write, and the numbered lesson `claude/teach` must, where the ordinal is the derivation worth asserting and the slug behind it is not.

A glob matching several files answers with one of them in no fixed order, so an arm asserting content through one seeds a folder holding a single match. A `content` path matching nothing falls back to itself, which keeps the miss reported against the entry as the declaration spells it.

`content` matches positively, so pinning a block from its first line to its last is how an arm asserts that nothing inside it changed. Both `claude/docs` diagram arms do this, one over frontmatter and one over a mermaid body and the paragraphs under it. Anchor the block below any frontmatter a run is allowed to append to, or the append pushes the closing line and fails a correct run.

`reply` reads `result` off the same envelope `max_turns` reads, so it costs nothing new to capture. Entries are plain substrings matched case-sensitively rather than regexes, because the token worth asserting is a path or a command and a regex invites an anchored sentence that goes red on any rewording. An absent envelope skips the assertion, while an envelope carrying an empty reply fails it. Those are different states and collapsing them would turn a gap in the input into a red arm.

A positive `reply` entry is only as stable as the slot it reads, so pin a token the fixture fixes and send a token the run chooses to `manual`. A reply entry pinning a token the skill chooses, such as the skill named on a board report's `Next:` line, can flip pass to fail between two runs against one unchanged fixture with nothing in the setup changed. Read a single failure of that shape against a second run before calling it a regression.

`claude:role-orchestrator`'s `plan-feature` entry sits in `manual` under `Judgment:` for that reason, which drops the arm to 5 asserted. Its neighbor `auto-ship` keeps its pin on the difference the fixture makes, since the planned task carries a staged plan file and the route therefore reads back off provisioning rather than off how one run worded a proposal. Nothing counts what an arm gives up this way, so a coverage number falling for a good reason looks identical to one falling for a bad one.

Repeated runs against one unchanged fixture returning the same pass count says the sample agrees, not that the arm is deterministic, since nobody reworded the slot between them and a stable sample says nothing about an unstable one. A turn-count spread across those runs confirms the arm's own header, which records a floor on what a correct run costs rather than a bound on it.

A pin scores the whole reply rather than the slot it was written about. `claude:role-orchestrator` pins `auto-ship` for the row a planned task earns, and a run that rewrote that row to route elsewhere still passed, because the skill names the same token again further down its output. Write the row into `manual` where a token repeats across a reply, since anchoring the pin costs the regex this section already declined.

A third source sits between the fixture and the run, and it is asserted rather than sent to `manual`. A label the skill's own `## Output` template spells is fixed by the body, so a run rewording it has stopped following the template, which is the failure the pin should catch rather than one it should tolerate. `claude:restate` pins the `Cut:` line on that basis alongside the fixture-fixed source path.

Declare only positives. An entry asserting what a run must not have said passes on every reply that phrases the thing differently, which is the vacuous pass `manual` is excluded from the count to prevent. Negatives stay in `manual`.

Every `manual` entry states why it stays there, as a sentence appended to the claim. `Semantic:` marks a claim no string match can carry, and `Unwired:` marks one that needs an input the harness does not yet supply, such as stderr or the tool calls. `Judgment:` marks one a string match reaches perfectly well against a token the run chooses rather than one the fixture fixes, so the entry passes or fails on a wording. Without the label the bucket absorbs all three, and work with a mechanism waiting for it reads the same as work that will never have one.

A step whose outcome reaches neither the tree nor the reply takes `Unwired:` rather than a pin over the artifact it feeds. `claude:session-map` opens by invoking capture, and a cold fixture gives capture nothing to persist, so it writes no memory file, returns no routed line, and the map owes it no mention either, which is what a pin over the map would fail against a conforming run. Admit the folder in `write_scope` so a run that did capture stays in bounds, and leave the step itself to a reader.

### Arms without an agent

Expectations are not agent-only. An `infra` arm invoking the CLI directly declares the same way, minus `max_turns`. No agent drives it, so no envelope is produced and a ceiling would sit permanently skipped rather than assert anything. `infra/wiki` carries one declaration per arm and is the pattern to copy for a CLI scenario.

`src/sandbox/expect.test.ts` builds a tree per assertion kind that violates it and requires a red verdict. A checker exercised only against a correct tree cannot distinguish asserting correctly from asserting nothing, so the negative trees are the point rather than extra coverage.
