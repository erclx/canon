---
name: internal-scripts
description: CLI entry point, bash scripts, sandbox scenarios, and lib functions. Use for `src/`, `manage-*.sh`, or sandbox scenarios.
---

# Scripts

Read `canon/context/development/scripts.md` for structure and lib responsibilities before editing.

## CLI design

- Extend an existing command with a flag rather than adding a bespoke variant. Prefer `--add` and similar composition over stack explosion.
- Keep toolkit surfaces general-purpose. Map an external tool's schema in a thin sync adapter rather than adopting it as the canonical shape.

## Lib rules

- Each lib file owns one concern. Read `canon/context/development/scripts.md` for responsibilities before adding or modifying.
- Never duplicate logic that already exists in `lib/`. When adding a function, check if any existing script duplicates the logic and consolidate.

## Sandbox pattern

Write a scenario as `sandbox/<cat>/<cmd>.ts` per `canon/context/development/sandbox.md`, which holds the TypeScript form, the config flags, and the one-file-per-skill rule. The seeds default for `claude/` scenarios is in `canon/context/development/sandbox.md`.

- Mirror realistic use of the skill with a happy-path shape that succeeds end to end
- Put adversarial cases in a separate named arm, such as `conflict`, `degraded`, or `empty`, so pass or fail reads as a property of the skill rather than the fixture
- Write each `expect.toml` assertion's reason as its `why`, and the arm's reason as `purpose`, in the form `canon/context/development/sandbox.md` states, rather than in a comment nothing reads
- Run `canon sandbox <cat>:<cmd>` yourself before handing off a skill that has a scenario, and tell the user the exact invocation and what to expect

### Testing a skill headlessly

`canon sandbox run <cat:cmd> "/canon:<skill>" [scenario]` provisions the scenario, drives the skill through `claude -p`, and returns a JSON envelope carrying `is_error`, `result`, `num_turns`, and `total_cost_usd`. Judge the run from the envelope rather than opening an interactive session, per `canon/context/development/sandbox.md`.

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

When writing a test over a class of files, such as workflows, hooks, or configs:

- Read every stack's tree beside the root, in `src/gate/` style, so the test covers every stack and not canon alone. When a test deliberately covers one side, name why in the test.
- Follow the both-direction sync in `internal-tooling` when the class has a seeded counterpart.

After editing scripts in a domain that has a sandbox scenario:

- Run `canon sandbox infra:{domain} install` and `canon sandbox infra:{domain} sync` to verify
- Skip `create` scenarios. They require interactive input and will loop on empty input.

After editing install or sync code (`manage-*.sh`, `src/tooling/`):

- Run `bun run check:install` plus the affected stack's sandbox scenario before declaring done. Hand-tests do not count as e2e.

## Captures

- Read `canon/context/development/local-loop.md` before editing `src/capture/` or `src/pr/`. It sorts the `evidence` folders into dev baselines and prod captures, which `canon pr evidence` compares.

## Hooks and husky

Read `canon/context/development/local-loop.md` before touching `.claude/hooks/` or `.husky/`. It covers the hook stdin guard, the husky POSIX `sh` constraint, and the `canon-no-seed:` marker rule from `canon/context/surfaces/tooling.md`.

## Plan callers

A plan here that changes a verb's command file carries a `## Callers` section saying what happens to each skill that runs the verb, since a change to the verb often owes the same change there.

`canon records validate plans` reports `callers-unstated` for a calling skill no bullet covers and `callers-malformed` for a bullet it cannot read.

- List the callers with `canon claude skills callers <verb>`, which prints each skill and line across `claude/skills/` and `.claude/skills/`
- A backticked `.ts` path under `src/commands/` in `## Files to touch` fires the check, a test file excepted, and a file in a family folder or a top-level file owns every verb it registers
- Each bullet names a skill path or a verb in backticks before a colon and one verdict after it, and a skill folder covers every file in it

Add under `## Plan callers`, after its lead sentence, the three forms below.

```text
- `<skill path>`: here, <what changes in it>
- `<skill path>`: none, <why it needs no change>
- `canon <verb>`: none, <why no caller of the verb needs a change>
```

- A verb bullet covers every caller of that verb and of each verb under it, so `canon pr` covers the whole family
- A verb named only in prose, such as "the lift verb", escapes the listing, so read the skill bodies for one

The check runs only where `claude/skills/` exists, so a target project never sees it.

## Reference

A new domain script is written in TypeScript on Bun, on the `src/cli/ui.ts` frame. A shell file over 100 lines is edited in place without growing and flagged for a rewrite.

- `canon/context/development/scripts.md`: structure and core scripts
- `docs/agents/output-shape.md`: output shape and stream contract for every CLI command
- `canon/context/development/sandbox.md`: sandbox system, hook pattern, provisioning flow, scenario catalog
