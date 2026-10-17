---
name: internal-scripts
description: CLI entry point, bash scripts, sandbox scenarios, and lib functions. Use for `src/`, `manage-*.sh`, or sandbox scenarios.
---

# Scripts

Read `canon/context/scripts.md` for structure and lib responsibilities before editing.

## CLI design

- Extend an existing command with a flag rather than adding a bespoke variant. Prefer `--add` and similar composition over stack explosion.
- Keep toolkit surfaces general-purpose. Map an external tool's schema in a thin sync adapter rather than adopting it as the canonical shape.

## Lib rules

- Each lib file owns one concern. Read `canon/context/scripts.md` for responsibilities before adding or modifying.
- Never duplicate logic that already exists in `lib/`. When adding a function, check if any existing script duplicates the logic and consolidate.

## Sandbox pattern

Write a scenario as `sandbox/<cat>/<cmd>.ts` per `canon/context/sandbox/authoring.md`, which holds the TypeScript form, the config flags, and the one-file-per-skill rule. The seeds default for `claude/` scenarios is in `canon/context/sandbox/overview.md`.

- Mirror realistic use of the skill with a happy-path shape that succeeds end to end
- Put adversarial cases in a separate named arm, such as `conflict`, `degraded`, or `empty`, so pass or fail reads as a property of the skill rather than the fixture
- Run `canon sandbox <cat>:<cmd>` yourself before handing off a skill that has a scenario, and tell the user the exact invocation and what to expect

### Testing a skill headlessly

`canon sandbox run <cat:cmd> "/canon:<skill>" [scenario]` provisions the scenario, drives the skill through `claude -p`, and returns a JSON envelope carrying `is_error`, `result`, `num_turns`, and `total_cost_usd`. Judge the run from the envelope rather than opening an interactive session, per `canon/context/sandbox/headless.md`.

- From a linked worktree, invoke `bun src/cli.ts sandbox <cat>:<cmd>`, since global `canon` resolves to main's source and cannot see worktree changes
- After refactoring a scenario, a green run alone is no proof. Diff `.sandbox/` contents, the file list, and `git log` against the prior behavior, and report the comparison.

### Scenario limits and the playground

A scenario validates a skill change only when its environment reproduces the bug's trigger. A standalone-repo scenario cannot exercise host-conditional behavior such as linked-worktree locks or remote-state failures, so mark that extension as a follow-up rather than reading a green run as proof.

- `github.com/erclx/canon-sandbox` is a pre-authorized destructive playground, where force-pushing its `main` or deleting `chore/canon-sync*` branches runs without confirmation
- Treat any other `erclx/*` repo as production, where destructive operations still need explicit approval

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

- Read `canon/context/development/evidence.md` before editing `src/capture/` or `src/pr/`. It sorts the `evidence` folders into dev baselines and prod captures, which `canon pr evidence` compares.

## Hooks and husky

Read `canon/context/development/hooks/index.md` before touching `.claude/hooks/` or `.husky/`, then the file it names for the hook at hand. The folder covers the hook stdin guard, the husky POSIX `sh` constraint, and the `canon-no-seed:` marker rule from `canon/context/tooling/seeds.md`.

## Reference

A new domain script is written in TypeScript on Bun. An existing domain script stays bash on `scripts/lib/ui.sh`, frame included, until it moves, and a shell file over 100 lines is edited in place without growing and flagged for a rewrite.

- `canon/context/scripts.md`: structure, core scripts, lib responsibilities, and the timeline frame a bash script prints inside
- `docs/agents/output-shape.md`: output shape and stream contract for every CLI command
- `canon/context/sandbox/index.md`: sandbox system, hook pattern, provisioning flow, scenario catalog
