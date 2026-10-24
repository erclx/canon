---
title: CI
description: GitHub Actions workflow triggers, the verify jobs, and the bot-PR fixture refresh
---

# CI

GitHub Actions for this monorepo. Three parallel jobs mirror the local `bun run check` cascade, and three scheduled or dispatched workflows sit beside them.

## Layer responsibilities

| File                                          | Trigger                               | Purpose                                                          |
| --------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `.github/workflows/verify.yml`                | Push to main + PR + workflow_dispatch | Format, lint, types, tests, build                                |
| `.github/workflows/eval.yml`                  | Nightly cron + workflow_dispatch      | Retrieval ablation against the golden set                        |
| `.github/workflows/agent-eval.yml`            | workflow_dispatch only                | Per-provider agent fixtures against Anthropic, OpenAI, Gemini    |
| `.github/workflows/refresh-mock-fixtures.yml` | Weekly cron + workflow_dispatch       | Re-capture mock-mode fixtures and open a refresh PR when changed |

Triggers across all workflows: pull requests targeting `main`, `workflow_dispatch`, a nightly cron at 03:00 UTC for the eval workflow, and a weekly cron at 06:00 UTC Mondays for the mock-fixture refresh. `verify.yml` also triggers on push to `main`, added so a status badge pinned to `main` in the README reports the branch it claims to cover rather than showing no runs.

## Verify jobs

Defined in `.github/workflows/verify.yml`. All jobs must pass before merge. Jobs run in parallel for speed.

### Root checks

| Step   | Command                | What it asserts                              |
| ------ | ---------------------- | -------------------------------------------- |
| Format | `bun run check:format` | prettier and shfmt are clean across the repo |
| Spell  | `bun run check:spell`  | cspell passes against dictionaries           |
| Shell  | `bun run check:shell`  | shellcheck passes at warning level           |

### Python checks

Runs in `python/` with `uv`.

| Step         | Command                        | What it asserts      |
| ------------ | ------------------------------ | -------------------- |
| Lint         | `uv run ruff check .`          | Ruff lint passes     |
| Format check | `uv run ruff format --check .` | Ruff format is clean |
| Typecheck    | `uv run mypy .`                | Strict mypy passes   |
| Tests        | `uv run pytest -v`             | pytest exits 0       |

### Web checks

Runs in `web/` with `bun`.

| Step      | Command             | What it asserts                  |
| --------- | ------------------- | -------------------------------- |
| Typecheck | `bunx tsc --noEmit` | TypeScript passes                |
| Lint      | `bun run lint`      | ESLint passes with zero warnings |
| Tests     | `bun run test:run`  | Vitest exits 0                   |
| Build     | `bun run build`     | Next production build succeeds   |

`bun run check` from the repo root runs the same cascade plus auto-formats first. If CI fails on format, run `bun run check` locally and commit the diff.

## Decisions

### Agent eval is dispatch-only so paid providers stay capped

`agent-eval.yml` triggers on `workflow_dispatch` only. The `providers` input defaults to `gemini` (free tier), so a maintainer must explicitly type `anthropic` or `openai` to opt into paid runs. Providers without a configured secret emit a warning and skip.

The job builds the web server then drives `web/scripts/model-probe.ts` three times per provider: the dispatch-supplied fixture, then `agent-general-profile.json`, then `agent-conversation.json`. `PROBE_PROVIDER` and `PROBE_API_KEY` come from the `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` secrets. Each run uploads both the Markdown table and the peer JSON artifact.

The `only_input_fixture` boolean (default false) skips the hardcoded general-profile and conversation steps so a dispatch targets only the supplied fixture. Use it for surgical reruns, especially when one provider's key is depleted.

### Mock fixtures refresh as a bot PR with a human merge

`refresh-mock-fixtures.yml` runs Monday at 06:00 UTC. When regenerated fixtures diff against the working tree, `peter-evans/create-pull-request` opens or updates a PR on the `bot/refresh-mock-fixtures` branch titled `chore(mock): refresh fixtures`. Unchanged fixtures open no PR.

Auto-merge stays off so a visitor-visible fixture rotation always gets a human glance before it ships. The built-in `GITHUB_TOKEN` covers the push and PR write, so no PAT is required.

## Hidden contracts

- The eval job skips when no SQLite corpus is present in the runner.
- The harness paces probes via `PROBE_INTER_PROBE_MS` with per-provider defaults (`gemini=6500`, others `0`) so free-tier rate limits do not return empty SSE on later probes. An explicit env override always wins.
- Concurrency group `refresh-mock-fixtures` with `cancel-in-progress` keeps overlapping runs from fighting over the working tree.
- When upstream JobTech returns a status other than 200 or 404 for any ad, the capture script throws and the workflow surfaces a red badge so the maintainer sees the outage.

## Gotchas

### The fixture refresh must run prettier via `bunx`, not root deps

`bun run capture-mock` emits raw JSON via `JSON.stringify`, so the workflow runs `bunx prettier@3.8.3 --write web/src/features/mock/scripts` to match the project's TypeScript style. Without this pass the bot PR lands as roughly 500 lines of double-quote versus single-quote churn that hides the real data changes.

The Prettier version pins to match the root `package.json` devDependency, and `bunx` downloads it on demand rather than installing root deps. Installing root deps would trigger husky's `prepare` script and register a pre-commit hook running cspell. The runner ships Node 20 but cspell requires Node 22+, so any commit during the workflow run would fail.
