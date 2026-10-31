---
title: Sandbox
description: The scenarios that provision isolated project states, the fixture trees and expect.toml declarations they stage, the headless runner, and the coverage report and skill census
---

# Sandbox

## Overview

The sandbox provisions isolated project states for testing scripts, configs, and skills. A scenario sets the starting state, and an arm's `expect.toml` declares what a correct run leaves behind. `canon sandbox run` drives a skill through `claude -p` against that state and scores the result.

Every `canon sandbox` verb is toolkit-only, so run `bun src/cli.ts sandbox <verb>` from a checkout, since an installed `canon` refuses.

- Anchor scenarios push to a real remote and need an authenticated `gh` plus membership in the org owning `canon-sandbox`. Everything else runs offline.
- Sandboxes are minimal by default. `SANDBOX_INJECT_SEEDS` runs `canon claude init` and `SANDBOX_INJECT_GOV` runs `canon gov install`, so no hand copy drifts from the installer.
- A scenario that reads commit history needs a checkout `canon` first on `PATH`, and the headless run calls that same one.

## Layout

### `sandbox/`

Owns the scenario scripts, one folder per category and one `.ts` file per command, each holding one or more named arms.

- Add a scenario as `sandbox/<category>/<command>.ts` default-exporting `scenario()` from `src/sandbox/scenario.ts`, named for the skill it drives. `sandbox/git/pr.ts` shows the shape.
- `config` holds presence flags such as `SANDBOX_SKIP_AUTO_COMMIT`, `SANDBOX_INJECT_SEEDS`, `SANDBOX_INJECT_GOV`, and `SANDBOX_GOV_STACK`. `anchor: true` names the push target.
- `arms` maps an arm name to a function staging the tree through `ctx`, the only way in. Arm order is routing order, and a headless call naming no arm is refused with the arm names, so name the arm.
- An arm ends its narration with an `Action:` line spelling the full command, arguments included, since a skill guarding on a missing argument refuses a bare prompt
- `exempt.toml` names skills no arm should cover, each with a `reason`, and a stale or now-asserted one exits 1. Run `canon sandbox` bare for the live catalog.

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
- `census.ts` rates skills `asserted`, `should-be-asserted`, or `exempt`, pairing on `<category>-<command>` or `<command>`. `internal-*` skills answer `none`, `create-*` read `no scenario`.
- `equivalence.ts` diffs every arm's tree at a base ref against head. Add `--stub-remote` for anchor arms and `--base origin/main` where local `main` trails.
- `tree.ts` puts the tree at `$XDG_STATE_HOME/canon/sandbox-<run-id>` outside the repository, and `assertSandboxDirSafe` refuses a path that is not a strict descendant of home or the temp root

### `src/sandbox/headless/`

Owns the runner behind `canon sandbox run <cat:cmd> "<prompt>" [scenario]`.

- `run.ts` provisions, snapshots the tree, and spawns `claude -p --plugin-dir` on `sonnet` under `bypassPermissions`, since `acceptEdits` denies writes under `.claude/`
- The envelope carries `is_error`, `result`, `num_turns`, `total_cost_usd`, and a `verdict`. Read the verdict from `.canon/tmp/runs/sandbox/`, since a later `sandbox check` finds no sandbox.
- Pass the prompt whole as `/canon:<skill> <args>`. Four `CANON_SKILL_TEST_*` variables override the defaults. `_TOOLS` restricts nothing under `bypassPermissions`.
- The cap of 30 turns is the only budget. A run it truncates fails by `subtype`, and a `max_turns` at or above it compares nothing. A no-shell arm uses `dontAsk`, as `claude:deploy-app` does.
- `watch.ts` flags writes to `.canon/plans`, `.canon/review`, `.canon/memory`, and `.canon/tasks` as escapes and sees nothing else. `dispatch.ts` bounds a nested `claude --bg` by shim and reap.

### `src/sandbox/replay/`

Owns `canon sandbox replay`, which syncs a copy of a consumer with this checkout's CLI and judges the reads that follow.

- `run.ts` copies a source beside the provisioned tree, runs `sync .`, four `--json` health reads, and oxfmt over what sync wrote, then removes the copy
- A checkout is copied, not cloned, since a clone drops gitignored records. The copy retries on ENOENT, since git maintenance removes `.git/objects/maintenance.lock` mid-walk. Dirty trees are refused.
- `verdict.ts` reads a finding or a refusal as `ok` and carries each `!` line as a finding. A crash, unparsable `--json` stdout, or an unformatted write fails, and the verb exits 2.
- `expected.ts` fails a snapshot step as `drifted` when its exit or finding count leaves the `expected.json` beside it. A missing file fails every step, and a checkout is never compared.
- The format step runs under `tooling/base/configs/.oxfmtrc.json`, since oxfmt's defaults double-quote frontmatter every consumer keeps single-quoted

### `sandbox/fixtures/replay/`

Owns the frozen consumers the bare verb replays, one folder each, holding the consumer's tracked managed paths and a stub `.canon/tasks/index.md`.

- A snapshot tests the upgrade from the release it was cut at and misses a state only a newer consumer holds, which `sandbox replay <checkout>` covers before a release
- Refresh one by hand. Copy the consumer's tracked managed paths over its folder with the `.fixture` suffix, keep the stub task index, and name the consumer commit in the message.
- Re-record after a refresh with `bun src/cli.ts sandbox replay --record`, which refuses named paths and a run with a broken step, so a crash never becomes the answer
- A governance rename moves jobtriage's `sync` count and drifts the stage. The drift is correct, and a `--record` in the same change settles it.
- A `.canon/` file here needs `git add -f`, since the root ignore reaches it

### Other folders

The state and the remote a run touches sit outside the repository.

- `$XDG_STATE_HOME/canon/sandbox-<run-id>` owns the provisioned project, one tree per process, which `CANON_SANDBOX_DIR` overrides
- `.gitignore` keeps `.sandbox/` for a tree an older checkout left in the repository, or one `CANON_SANDBOX_DIR` pointed inside it
- `${GITHUB_ORG}/canon-sandbox` owns the disposable remote, which each anchor scenario resets by closing its PRs, deleting its branches, and force-pushing a fresh `main`
- Issues on that remote survive the reset, so a scenario filing them closes only a label it owns
- `canon sandbox check --help` owns the verb flags and the verdict states, and the `expect.toml` files under `sandbox/` show every key

## Gotchas

- A green `bun run check` does not prove an `expect.toml` parses, and a bare key under a `[[content]]` header joins that table and never asserts
- `canon sandbox check` mints a fresh run id and asserts nothing on a multi-arm scenario without an arm, so name the arm and pin `CANON_SANDBOX_DIR` outside `~/.claude/`, where every `Write` is refused
- The driven session resolves `canon` from `PATH`, the published release, so an arm exercising a verb this branch adds meets a binary that refuses
- A skill with a decline guard declines in a cold sandbox, which holds nothing git does not, so the arm's prompt states the reasoning to record as `claude:session-compact` does
- A verdict covers the arm that ran, so read `unchecked` beside `asserted`, since `manual` entries carry what no substring reaches
