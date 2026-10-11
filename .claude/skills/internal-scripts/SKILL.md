---
name: internal-scripts
description: CLI entry point, bash scripts, sandbox scenarios, and lib functions. Use for `src/`, `manage-*.sh`, or sandbox scenarios.
---

# Scripts

Read `canon/context/scripts/index.md` for structure, file inventory, and lib responsibilities before editing.

## CLI design

- Extend an existing command with a flag rather than adding a bespoke variant. Prefer `--add` and similar composition over stack explosion.
- Keep toolkit surfaces general-purpose. Map an external tool's schema in a thin sync adapter rather than adopting it as the canonical shape.

## Lib rules

- Each lib file owns one concern. Read `canon/context/scripts/lib.md` for responsibilities before adding or modifying.
- Never duplicate logic that already exists in `lib/`. When adding a function, check if any existing script duplicates the logic and consolidate.

## Sandbox pattern

- Write a scenario as `sandbox/<cat>/<cmd>.ts` per `canon/context/sandbox/authoring.md`, which holds the TypeScript form, the config flags and their defaults, and the one-file-per-skill rule. The seeds default for `claude/` scenarios is in `canon/context/sandbox/overview.md`.
- Sandbox scenarios mirror realistic use of the skill. Pick a happy-path shape that succeeds end-to-end. Put adversarial cases in a separate named scenario arm (e.g. `conflict`, `degraded`, `empty`) so pass/fail reads as a property of the skill, not the fixture.
- When testing a skill that has a sandbox scenario, run `canon sandbox <cat>:<cmd>` yourself before handing off. Tell the user the exact skill invocation and what to expect.
- To test a skill non-interactively, run `canon sandbox run <cat:cmd> "/canon:<skill>" [scenario]`. It provisions the scenario, drives the skill through `claude -p`, and returns a JSON envelope (`is_error`, `result`, `num_turns`, `total_cost_usd`). Judge the run from the envelope instead of opening an interactive session. See `canon/context/sandbox/headless.md`.
- When testing uncommitted script edits from a linked worktree, invoke the CLI through its worktree-local path like `bun src/cli.ts sandbox <cat>:<cmd>`. Global `canon` resolves to the main repo's source and cannot see worktree changes until they land on main.
- After refactoring a sandbox scenario, do not claim verified from a green run alone. Diff `.sandbox/` contents, file list, and `git log` against the pre-refactor behavior or spec, and report the comparison in the done message.
- A sandbox scenario validates a skill change only when its environment reproduces the bug's trigger. Standalone-repo scenarios cannot exercise host-conditional behavior like linked-worktree locks or remote-state failures. Mark the scenario extension as a follow-up rather than treating a green run as proof.
- `github.com/erclx/canon-sandbox` is a pre-authorized destructive-ops playground. Sandbox scenarios that force-push to its `main` or delete `chore/canon-sync*` remote branches run without confirmation. Treat any other `erclx/*` repo as production where destructive ops still need explicit approval.

## Sync checklist

When adding a command to any `manage-*.sh`:

- Update the corresponding scenario list in `sandbox/infra/*.ts`
- Update the CLI table in `README.md`

After editing scripts in a domain that has a sandbox scenario:

- Run `canon sandbox infra:{domain} install` and `canon sandbox infra:{domain} sync` to verify
- Skip `create` scenarios. They require interactive input and will loop on empty input.

After editing install or sync code (`manage-*.sh`, `src/tooling/`):

- Run `bun run check:install` plus the affected stack's sandbox scenario before declaring done. Hand-tests do not count as e2e.

## Captures

- Read `canon/context/development/evidence.md` before editing `src/capture/` or `src/pr/`. It states which `evidence` folders are dev baselines and which are prod captures, and that `canon pr evidence` compares both.

## Hooks and husky

- Read `canon/context/development/hooks/index.md` before touching `.claude/hooks/` or `.husky/`, then the file it names for the hook at hand. The folder covers the Claude Code hook stdin guard, the husky POSIX `sh` constraint, and the `canon-no-seed:` capability-seeding marker rule from `canon/context/tooling/seeds.md`.

## Reference

- `canon/context/scripts/index.md`: structure, file inventory, core scripts, lib responsibilities
- `docs/agents/output-shape.md`: output shape and stream contract for every CLI command
- `canon/context/sandbox/index.md`: sandbox system, hook pattern, provisioning flow, scenario catalog
- `canon/context/scripts/framing.md`: the timeline frame a domain script prints inside. A new domain script is written in TypeScript on Bun, and an existing shell file over 100 lines is edited in place without growing it and flagged for a rewrite. Existing domain scripts stay bash on `scripts/lib/ui.sh`, frame included, until they move
