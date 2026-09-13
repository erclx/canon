# Tooling Python reference

> Extends: `base`. Apply base stack first.

## Overview

The python stack covers Python 3.13+ projects managed with `uv`. It ships golden sidecar configs for `ruff`, `mypy`, `pytest`, and `coverage`, plus a `.python-version` pin and a python-aware `verify.sh`. Framework adapters layer on top with their own deps and configs.

Configs ship as sidecar files (`ruff.toml`, `mypy.ini`, `pytest.ini`, `.coveragerc`) rather than `[tool.*]` sections in `pyproject.toml`. Sync overwrites configs on every run, so keeping them sidecar avoids stomping the user-owned `[project]` block in `pyproject.toml`.

## Scaffold checklist

1. Scaffold with `uv init --app <name>`. This creates `pyproject.toml`, `.python-version` pinned to 3.14, `src/<name>/`, and a starter `main.py`. `uv init` defaults `requires-python` to `>=3.14`, which matches the `.python-version` pin this stack ships.
2. Seed `package.json` so the base layer's bun-side tools (husky, prettier, cspell, commitlint) have a target to install into: `bun init -y`. Without this the sync drops base configs but skips the dep install, since `resolve_missing_deps` short-circuits when `package.json` is absent.
3. Install base tooling: `canon tooling sync base . --write`
4. Install python tooling: `canon tooling sync python . --write`
5. Install Python tooling deps: `uv add --dev ruff mypy pytest pytest-cov`. v1 of this stack does not declare these in `[dependencies.dev]` because manifest injection hardcodes `bun add -D`, which can not install Python packages. Until the injector branches on `runtime`, this step is manual.
6. Sync the lockfile and create the venv: `uv sync`.
7. Annotate `main()` in the scaffold-generated `main.py` with `-> None`. `uv init --app` ships an unannotated `main()` that fails strict mypy on the first run.
8. Run `bun run lint:fix` then `bun run check`.

The python stack also ships `tests/test_smoke.py` as a copy-once seed. `pytest` collects at least one test on first run, so `bun run test:run` exits 0 instead of the empty-collection exit code 5. Delete or replace the smoke test with real tests.

## What ships as golden configs

- `ruff.toml`: line length 88, target `py314`, strict lint rules (`E`, `W`, `F`, `I`, `B`, `C4`, `UP`, `N`), single-quote format, banned relative imports.
- `mypy.ini`: strict mode, `python_version = 3.14`, `mypy_path = src`, excludes `tests/` and `docs/`.
- `pytest.ini`: tests live under `tests/`, source under `src/`.
- `.coveragerc`: branch coverage on `src/`, html report under `.coverage_cache/html`.
- `.python-version`: pinned to `3.14` to match `uv init --app` defaults.
- `scripts/verify.sh`: overrides base verify to add Typecheck (`mypy`), Lint (`ruff check && ruff format --check`), and Tests (`pytest -v`) phases.

## Hybrid project shape

A python project synced with this stack ends up with both `package.json` from base and `pyproject.toml` from `uv init`. The base layer brings prettier, cspell, commitlint, and husky for non-Python files. Both `node_modules/` and `.venv/` coexist at the project root. The hybrid shape gives Python projects access to the toolkit's cross-cutting tools without forking the base stack.

## Dependencies

The manifest declares no `[dependencies.dev]`. Manifest injection currently calls `bun add -D` for any declared deps, which would fail for Python packages. v1 sidesteps this by leaving the section empty. Framework adapters that need Python deps require the injector to branch on `runtime` or detect `pyproject.toml` and call `uv add --dev` instead.

## Verify command

`canon tooling verify <stack>` currently runs `bun run lint:fix` and `bun run check` against any stack with a `package.json`. Since base ships a `package.json`, those run for python too. Python's verify.sh wraps the package.json `lint`/`typecheck`/`test:run` scripts that delegate to `uv run`, so the verify path works end-to-end as long as `uv` is installed in the verify environment. The end-to-end test and screenshot phases are gated on `package.json` script keys that python does not declare, so they cleanly skip.

## Anti-patterns

- Do not use `pip` directly. Always go through `uv add` / `uv sync` / `uv run`.
- Do not move `[tool.ruff]`, `[tool.mypy]`, `[tool.pytest.ini_options]`, or `[tool.coverage.*]` into `pyproject.toml`. Sync owns the sidecar files. Editing `pyproject.toml` tool sections will conflict with the sidecars and produce silent precedence bugs.
- Do not pin Python via `[project] requires-python` and `.python-version` independently. Treat `.python-version` as the source of truth and let `requires-python` in `pyproject.toml` track it.
- Do not add `commitizen` for conventional commits. The base stack already ships commitlint + husky. Two enforcers is one too many.
- Do not ship a `Dockerfile` or `mkdocs` config under tooling. Those are framework or deployment choices and belong in the project itself or in a future adapter stack.

## Development docs (extend)

Append to the `## Scripts` table:

| `bun run lint` | Run `ruff check` and `ruff format --check`. |
| `bun run lint:fix` | Auto-fix with `ruff check --fix` then `ruff format`. |
| `bun run typecheck` | Run `mypy` in strict mode. |
| `bun run test` | Run `pytest`. |
| `bun run test:run` | Run `pytest -v` (used by `verify`). |
| `bun run test:cov` | Run `pytest` with branch coverage and HTML report. |

## CI docs (extend)

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `mypy .` passes ``. Add a Lint row whose assertion reads: `` `ruff check` and `ruff format --check` pass ``. Add a Tests row whose assertion reads: `` `pytest` exits 0 ``.
