---
title: Sandbox
description: The scenarios that provision isolated project states, the fixture trees and expect.toml declarations they stage, the headless runner, and the coverage report and skill census
---

# Sandbox

## Overview

The sandbox provisions isolated project states for testing scripts, configs, and skills. A scenario sets the starting state, and an arm's `expect.toml` declares what a correct run leaves behind. `canon sandbox run` drives a skill through `claude -p` against that state and scores the result.

Every `canon sandbox` verb is toolkit-only, so run `bun src/cli.ts sandbox <verb>` from a checkout, since an installed `canon` refuses.

## Layout

### `sandbox/`

Owns the scenario scripts, one folder per category and one `.ts` file per command, each holding one or more named arms.

- Add a scenario as `sandbox/<category>/<command>.ts` default-exporting `scenario()` from `src/sandbox/scenario.ts`, named for the skill it drives. `sandbox/git/pr.ts` shows the shape.
- `config` holds presence flags such as `SANDBOX_SKIP_AUTO_COMMIT`, `SANDBOX_INJECT_SEEDS`, `SANDBOX_INJECT_GOV`, and `SANDBOX_GOV_STACK`. `anchor: true` names the repository the scenario pushes to.
- `arms` maps an arm name to a function staging the tree through `ctx`, the only way in. Commands run in `ctx.dir`, and arm order is routing order.
- An arm ends its narration with an `Action:` line spelling the full command, arguments included, since a skill guarding on a missing argument refuses a bare prompt
- `exempt.toml` names skills no arm should cover, each with a `reason`. Run `canon sandbox` bare for the live catalog.

### `sandbox/fixtures/`

Owns the content a scenario stages and each arm's `expect.toml`. It holds no scenarios, and `listCategories` skips it.

- Content lives at `<category>/<scenario>/<arm>/<stage>/`, and `ctx.fixtures(category, scenario, arm, stage)` copies one stage
- A stage splits into `create/`, which overwrites, and `append/`, which fails when the target the anchor or seeds should provide is missing
- Every file carries a `.fixture` suffix the helper strips, which keeps formatters and `canon indexes regen` off content that drifts on purpose
- `shared/` holds a stage several arms reach and carries no `expect.toml`. `anchor/create/` is the tree every anchor scenario provisions from.
- Stage records at `.canon/`, never `.claude/`, since a fixture spells its own record root and nothing reconciles it with the arm's expectations

### `src/sandbox/`

Owns provisioning, the scenario contract, the checker, the coverage report, the skill census, and the equivalence verb.

- `provision.ts` injects seeds and gov rules through the real installers, runs the arm, then commits and tags `refs/sandbox/baseline`, which `canon sandbox reset` restores
- `expect.ts` returns pass, fail, or unchecked, and only a failure exits non-zero. A declaration with no mechanical assertion fails, and `--strict` fails an unchecked arm.
- `coverage.ts` and `census.ts` rate each skill `asserted`, `should-be-asserted`, or `exempt`. A scenario pairs as `<category>-<command>` or `<command>`, and `SANDBOX_ASSERTED_FLOOR` fails a lost one.
- `equivalence.ts` diffs every arm's tree at a base ref against head. Add `--stub-remote` for anchor arms and `--base origin/main` where local `main` trails.
- `tree.ts` puts the tree at `$XDG_STATE_HOME/canon/sandbox-<run-id>` outside the repository, and `assertSandboxDirSafe` refuses a path that is not a strict descendant of home or the temp root

### `src/sandbox/headless/`

Owns the runner behind `canon sandbox run <cat:cmd> "<prompt>" [scenario]`.

- `run.ts` provisions, snapshots the tree, spawns `claude -p --plugin-dir` under `bypassPermissions` on `sonnet`, and scores the diff. The record lands in `.canon/tmp/runs/sandbox/`.
- Pass the prompt whole as `/canon:<skill> <args>`, since the runner adds nothing and a bare `/<skill>` does not reach the branch's body
- `CANON_SKILL_TEST_MODEL`, `_TOOLS`, `_MAX_TURNS`, and `_PERMISSION_MODE` override the defaults. The cap of 30 turns is the only budget.
- `watch.ts` reports writes to `.canon/plans`, `.canon/review`, `.canon/memory`, and `.canon/tasks` as escapes, which an arm's `escape_scope` turns into a result
- `dispatch.ts` bounds a nested `claude --bg` with a PATH shim refusing the flag, a process-group reap after the verdict, and a before and after read of the session registry

### Other folders

The state and the remote a run touches sit outside the repository.

- `$XDG_STATE_HOME/canon/sandbox-<run-id>` owns the provisioned project, one tree per process, which `CANON_SANDBOX_DIR` overrides
- `${GITHUB_ORG}/canon-sandbox` owns the disposable remote, which each anchor scenario resets by closing its PRs, deleting its branches, and force-pushing a fresh `main`
- `docs/agents/sandbox.md` owns the verb flags, the JSON shapes, and every `expect.toml` key

## Gotchas

- A green `bun run check` does not prove an `expect.toml` parses, and a bare key under a `[[content]]` header joins that table and never asserts
- `canon sandbox check` mints a fresh run id and asserts nothing on a multi-arm scenario without an arm, so name the arm and pin `CANON_SANDBOX_DIR`
- The driven session resolves `canon` from `PATH`, the published release, so an arm exercising a verb this branch adds meets a binary that refuses
- Never point `CANON_SANDBOX_DIR` under `~/.claude/`, where the driven session has every `Write` refused as a sensitive path
- A verdict covers the arm that ran, so read `unchecked` beside `asserted`, since `manual` entries carry what no substring reaches
