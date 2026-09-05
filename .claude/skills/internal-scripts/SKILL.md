---
name: internal-scripts
description: CLI entry point, bash scripts, sandbox scenarios, and lib functions. Use for `src/`, `manage-*.sh`, sandbox hooks, or shared `lib/` functions.
---

# Scripts

Read `.claude/context/scripts/index.md` for structure, file inventory, and lib responsibilities before editing.

## Lib rules

- Each lib file owns one concern. Read `.claude/context/scripts/lib.md` for responsibilities before adding or modifying.
- Never duplicate logic that already exists in `lib/`. When adding a function, check if any existing script duplicates the logic and consolidate.

## Sandbox pattern

- Each sandbox defines three hooks: `use_config` (flags before provisioning), `use_anchor` (remote repo as base), `stage_setup` (scenario state after provisioning).
- Only `stage_setup` is required. End it with `log_step` describing what to run and what to expect.
- Default behavior: no standards, no gov rules, auto-commit on. Declare only the flags you need in `use_config`.
- For `claude/` scenarios, default to `SANDBOX_INJECT_SEEDS="true"`. See the rule and its two exceptions in `.claude/context/sandbox/overview.md`.
- For multi-scenario scripts, call `select_or_route_scenario "Which scenario?" "a" "b"` instead of `select_option`. It reads `SANDBOX_SCENARIO` to skip the picker when set by `canon sandbox <cat>:<cmd> <scenario>`. End every scenario `case` with a `*) log_error "Unknown scenario: $SELECTED_OPTION" ;;` arm. Use slug-style scenario names (no spaces) so agents can pass them without quoting.
- One sandbox file per skill. Before adding a new scenario, check if `scripts/sandbox/<cat>/<skill>.sh` exists. If so, extend it with a `select_or_route_scenario` call and a new `case` arm. Do not create sibling files.
- Sandbox scenarios mirror realistic use of the skill. Pick a happy-path shape that succeeds end-to-end. Put adversarial cases in a separate named scenario arm (e.g. `conflict`, `degraded`, `empty`) so pass/fail reads as a property of the skill, not the fixture.
- When testing a skill that has a sandbox scenario, run `canon sandbox <cat>:<cmd>` yourself before handing off. Tell the user the exact skill invocation and what to expect.
- To test a skill non-interactively, run `scripts/sandbox/run.sh <cat:cmd> "/canon:<skill>" [scenario]`. It provisions the scenario, drives the skill through `claude -p`, and returns a JSON envelope (`is_error`, `result`, `num_turns`, `total_cost_usd`). Judge the run from the envelope instead of opening an interactive session. See `.claude/context/sandbox/running.md`.
- When testing uncommitted script edits from a linked worktree, invoke the script via its worktree-local path like `./scripts/manage-sandbox.sh <cat>:<cmd>`. Global `canon` resolves to the main repo's scripts and cannot see worktree changes until they land on main.
- After refactoring a sandbox scenario, do not claim verified from a green run alone. Diff `.sandbox/` contents, file list, and `git log` against the pre-refactor behavior or spec, and report the comparison in the done message.
- A sandbox scenario validates a skill change only when its environment reproduces the bug's trigger. Standalone-repo scenarios cannot exercise host-conditional behavior like linked-worktree locks or remote-state failures. Mark the scenario extension as a follow-up rather than treating a green run as proof.
- `github.com/erclx/aitk-sandbox` is a pre-authorized destructive-ops playground. Sandbox scenarios that force-push to its `main` or delete `chore/canon-sync*` remote branches run without confirmation. Treat any other `erclx/*` repo as production where destructive ops still need explicit approval.

## Sync checklist

When adding a command to any `manage-*.sh`:

- Update the corresponding scenario list in `scripts/sandbox/infra/*.sh`
- Update the CLI table in `README.md`

After editing scripts in a domain that has a sandbox scenario:

- Run `canon sandbox infra:{domain} install` and `canon sandbox infra:{domain} sync` to verify
- Skip `create` scenarios. They require interactive input and will loop on empty input.

After editing install or sync code (`manage-*.sh`, `src/tooling/`):

- Run `bun run check:install` plus the affected stack's sandbox scenario before declaring done. Hand-tests do not count as e2e.

## Assets and captures

- Read `.claude/context/development/regeneration.md`'s Hero section before touching `assets/captures/` or `assets/*.png`. Those renders gate on drift, so a hand edit to a generated frame is overwritten by the next `scripts/core/regen-hero.sh` run.

## Hooks and husky

- Read `.claude/context/development/hooks.md` before touching `.claude/hooks/` or `.husky/`. It covers the Claude Code hook stdin guard, the husky POSIX `sh` constraint, and the `canon-no-seed:` capability-seeding marker rule from `.claude/ARCHITECTURE.md`.

## Reference

- `.claude/context/scripts/index.md`: structure, file inventory, core scripts, lib responsibilities
- `docs/agents/output-shape.md`: output shape and stream contract for every CLI command
- `.claude/context/sandbox/index.md`: sandbox system, hook pattern, provisioning flow, scenario catalog
- `claude/skills/bash-script/`: bash style rules and the interactive-script authoring contract
