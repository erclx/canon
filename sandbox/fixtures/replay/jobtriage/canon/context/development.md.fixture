---
title: Development
description: Local dev workflow, scripts, WSL2 constraints, and the regen-gate pattern
---

# Development

Local dev for this monorepo. Two stack folders sit beside a thin orchestration root. This entry is the discoverable surface for a contributor with the source open: the rationale behind the rules that constrain local dev, plus every gotcha and hidden contract. `docs/development.md` is the public counterpart linked from the README, carrying only setup and the two commands to run the app, for a reader without the source cloned.

## Layer responsibilities

- `web/` owns the Next.js app, bun-managed, with its own lint, tests, and build.
- `python/` owns the FastAPI backend and CLI, uv-managed, with its own lint, types, and tests.
- Root owns format, spelling, and shell checks, plus the cascade that runs both stack verifies.

Per-stack structure and conventions live in `web.md` and `python.md`.

## Setup

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install [uv](https://docs.astral.sh/uv/): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Root deps: `bun install`
- Web deps: `cd web && bun install`
- Python deps: `cd python && uv sync`

## Scripts

### Verify cascade

| Command         | What runs                                                                      | Approx wall |
| --------------- | ------------------------------------------------------------------------------ | ----------- |
| `bun run check` | Format, spell, shell, python (ruff, mypy, pytest), web (typecheck, lint, test) | ~5s         |

`check` runs on every `git push` via the husky `pre-push` hook. The python verify also regenerates `python/openapi.json` and fails if the working copy drifts. Commit the regenerated file alongside the source change.

### Root scripts

| Command                | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `bun run check`        | Full cascade. Asserts format, spell, shell, python, and web checks pass. |
| `bun run dev:api`      | FastAPI backend with `--reload` on `http://127.0.0.1:8000`.              |
| `bun run restart:web`  | Kill stale `next-server`, rebuild, and serve on `http://localhost:3000`. |
| `bun run format`       | Auto-fix prettier and shfmt formatting.                                  |
| `bun run check:format` | Assert prettier and shfmt are clean.                                     |
| `bun run check:spell`  | Assert cspell passes against dictionaries.                               |
| `bun run check:shell`  | Assert shellcheck passes at warning level.                               |
| `bun run clean`        | Wipe `node_modules/`, clear bun cache, reinstall.                        |
| `bun run update`       | Interactive `bun update` followed by verification.                       |

### Web scripts

Run from `web/` after `cd web`.

| Command                 | Purpose                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`           | Disabled. Prints a pointer to `bun run restart:web` and exits 1.                                                                                                                                                                                                                                                                            |
| `bun run build`         | Production build.                                                                                                                                                                                                                                                                                                                           |
| `bun run start`         | Serve the production build.                                                                                                                                                                                                                                                                                                                 |
| `bun run lint`          | ESLint, zero warnings allowed.                                                                                                                                                                                                                                                                                                              |
| `bun run lint:fix`      | Auto-fix ESLint issues.                                                                                                                                                                                                                                                                                                                     |
| `bun run typecheck`     | `tsc --noEmit`.                                                                                                                                                                                                                                                                                                                             |
| `bun run test`          | Vitest in watch mode.                                                                                                                                                                                                                                                                                                                       |
| `bun run test:run`      | Vitest once with verbose reporter.                                                                                                                                                                                                                                                                                                          |
| `bun run test:coverage` | Vitest with coverage.                                                                                                                                                                                                                                                                                                                       |
| `bun run test:e2e`      | Playwright end-to-end.                                                                                                                                                                                                                                                                                                                      |
| `bun run favicon`       | Regenerate `src/app/favicon.ico` from `src/app/icon.svg`.                                                                                                                                                                                                                                                                                   |
| `bun run screenshots`   | Capture canonical UI states to `.canon/review/screenshots/<host>/` (`localhost/` by default, derived from `SCREENSHOT_BASE_URL`). Set `SCREENSHOT_FILTER=<substring>` to capture only matching `surface/name` labels and skip the wipe so other surfaces stay intact. Pass `--check-console-clean` to fail on any captured `console.error`. |
| `bun run smoke:prod`    | Run `screenshots` against `https://jobtriage.erclx.dev` with `--check-console-clean`. Output lands in `.canon/review/screenshots/jobtriage.erclx.dev/`.                                                                                                                                                                                     |
| `bun run check`         | Web verify (typecheck, lint, test).                                                                                                                                                                                                                                                                                                         |

### Python commands

Run from `python/` after `cd python`.

| Command                  | Purpose                   |
| ------------------------ | ------------------------- |
| `uv run ruff check .`    | Lint.                     |
| `uv run ruff format .`   | Auto-format.              |
| `uv run mypy .`          | Strict typecheck.         |
| `uv run pytest -v`       | Tests.                    |
| `bash scripts/verify.sh` | Full python verify.       |
| `uv run jobtriage-api`   | Start the FastAPI server. |

## Local smoke

To open the chat surface against the real backend on `http://localhost:3000`:

```bash
# terminal 1
bun run dev:api

# terminal 2
bun run restart:web
```

## Decisions

### `bun run dev` is disabled, use `bun run restart:web`

Turbopack's file watcher walks the AI Elements plus shadcn dep tree and freezes WSL2 (vercel/next.js issues #87796, #91161, #66326). The `dev` script exits 1 at the package level with a pointer to `restart:web`. The Playwright `webServer` runs `build && start` for the same reason. Hot reload is not available on this machine.

`bun run restart:web` calls `scripts/restart.sh`, which kills any stale `next-server` and Playwright zombies, rebuilds, starts the production server in the background, and verifies the listening pid changed before returning. Logs land at `.canon/tmp/restart/server.log`. Re-run after each edit.

Do not rely on `lsof -ti:3000` to detect stale servers, it misses `next-server`. The restart script handles process discovery.

### Regen-and-gate pattern requires `.prettierignore` co-update

When adding a regen-and-gate pattern (FastAPI OpenAPI export, codegen, schema dumps), append the artifact path to `.prettierignore` in the same commit. Otherwise prettier and the regen disagree on layout and the freshness check fails on every push.

The python verify regenerates `python/openapi.json` and fails if the working copy drifts. After backend changes that move endpoints or schemas, the regeneration is automatic. Commit the diff alongside the source change.

### Husky pre-push reformat behavior

The pre-push hook runs the full `bun run check` cascade. The cascade may reformat files. After `git push`, run `git status`. If files were modified, commit the diff as `style(<scope>):` and push again. Do not skip the hook with `--no-verify`.

### Dev-vs-deploy gates use `process.env.VERCEL`

`bun run restart:web` runs `next build && next start`, which sets `NODE_ENV=production` even on the local dev box. Anywhere a flag distinguishes "local dev" from "deployed", use `process.env.VERCEL` rather than `NODE_ENV !== 'production'`. The v4.10 deploy-mode override gate was first written against `NODE_ENV` and silently failed on the local browser path until the resolver was rewired to `VERCEL`.

### Ollama `num_ctx` floor at 8192

The Ollama branch sets `num_ctx` to 8192 by default via `providerOptions`, overridable through `OLLAMA_NUM_CTX`. Ollama's stock 131k context window allocates a KV cache that spills past WSL2's memory cap into Windows host RAM under inference, freezing the desktop. The 8192 floor fits the agent loop with multi-turn tool calls and keeps the cache resident in VRAM.

### Preview deploys are the outer loop, not the inner one

Every push to a branch with an open PR triggers a Vercel preview deploy, producing two URLs in the PR comment: a per-commit immutable URL (`jobtriage-<commitHash>-...`) and a per-branch alias (`jobtriage-git-<branch>-...`) that tracks the latest commit.

Stay on `bun run restart:web` for the inner loop. Local builds reflect edits in seconds, previews take minutes. Reach for a preview when a reviewer needs to click without a local checkout, when the change needs cross-device verification, when an OG card crawler must fetch the page (LinkedIn Post Inspector, Slack, and Twitter Card Validator cannot reach localhost), or when verifying that Vercel env vars produce the expected runtime.

Deployment Protection is off for this project, so preview URLs are publicly accessible. If a branch ever needs gated previews, toggle it to `Only Preview Deployments` in Vercel project settings.

## Hidden contracts

- The canonical UI inventory lives in `web/scripts/screenshots.ts` as surface-level capture cases (`byok`, `chat`, `profile`, `canvas`). When a change alters how an existing case renders, rerun `bun run screenshots` (or `SCREENSHOT_FILTER=<surface> bun run screenshots` for a single surface) and eyeball the diff against `canon/wireframes/<surface>.md`. When a change introduces a layout the harness does not yet cover, add a capture case first, then run. Component-only tweaks that change no captured PNG are exempt.
- All `.sh` files live under `scripts/` in their owning folder. Do not place shell scripts elsewhere.
- Husky wires three hooks: `pre-commit` runs `lint-staged` against staged files (prettier, cspell, shfmt, shellcheck), `commit-msg` runs `commitlint` against the conventional commit format, and `pre-push` runs the full `bun run check` cascade.

## Gotchas

### Hardware monitor before any local model load

Local LLM smoke runs (Ollama with `gemma4:26b`, the multilingual e5 embedder) can saturate WSL2 memory or push the Windows host into swap. WSL2 caps the guest at half the host by default, so the Linux side reports a much smaller ceiling than the physical install.

Run `scripts/monitor.sh` in a separate terminal before starting any local model:

```bash
./scripts/monitor.sh                         # 3s interval, frame UI on stderr, samples on stdout
./scripts/monitor.sh 1                       # 1s interval
./scripts/monitor.sh > /tmp/mon.log 2>&1 &   # detach, background, single combined log
```

The script samples four pressure sources every 3s (Windows host RAM, WSL guest RAM, GPU VRAM and utilization, loaded Ollama models) and warns at host RAM 85% or GPU util 90%. Abort the model load if host is already at 80%.

### `canon tooling sync` covers only the shared root layer

The `base` tooling stack `canon tooling sync` resolves for this repo covers `.editorconfig`, the husky hooks, prettier, cspell, and commitlint, the layer described in Layer responsibilities above as "root owns format, spelling, and shell checks." `.vscode/extensions.json`, `.vscode/settings.json`, `scripts/verify.sh`, and `.github/workflows/verify.yml` hand-diverge from the toolkit's generic single-folder template by design, since they orchestrate the `web/` plus `python/` split.

Running `canon tooling sync base --write` without reviewing the diff first replaces those four files with content built for a single-folder project: the Python and TypeScript editor config disappears from `.vscode/`, and `scripts/verify.sh` drops its calls into `python/scripts/verify.sh` and `web/scripts/verify.sh` entirely. Check the diff on each file the tool reports before applying it.

### `next build` and Playwright e2e are out of the verify cascade by design

The previous scaffold ran `next build` in `pre-push` and froze under WSL2. CI now runs the build on every PR instead. Run `cd web && bun run build` and `cd web && bun run test:e2e` manually before opening a PR if you want full parity.

### A wall of `TS2307` errors in `bun run check` means stale `web/node_modules`, not a code problem

`web/node_modules` can drift behind `web/package.json` and `web/bun.lock` when a dependency lands in the lockfile without a fresh install. The symptom is `tsc` failing with `Cannot find module` across many unrelated files at once (`lucide-react`, `radix-ui`, `ai`, `clsx`, and similar). Run `cd web && bun install` first before investigating further.
