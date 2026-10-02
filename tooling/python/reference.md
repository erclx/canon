# Tooling Python reference

> Extends: `base`. Apply base stack first.

## Overview

The python stack covers Python 3.13+ projects managed with `uv`. It ships golden sidecar configs for `ruff`, `mypy`, `pytest`, and `coverage`, plus a `.python-version` pin and a python phase list for base's verify runner. Framework adapters layer on top with their own deps and configs.

Configs ship as sidecar files (`ruff.toml`, `mypy.ini`, `pytest.ini`, `.coveragerc`) rather than `[tool.*]` sections in `pyproject.toml`. Sync overwrites configs on every run, so keeping them sidecar avoids stomping the user-owned `[project]` block in `pyproject.toml`.

## Scaffold checklist

1. Scaffold with `uv init --package <name>`. This creates `pyproject.toml` with a `uv_build` backend, `.python-version` pinned to 3.14, and `src/<name with underscores>/__init__.py` holding an annotated `def main() -> None:`, so source lands under `src/` where `mypy.ini`, `pytest.ini`, and `.coveragerc` look for it. `uv init` defaults `requires-python` to `>=3.14`, which matches the `.python-version` pin this stack ships.
2. Seed `package.json` so the base layer's bun-side tools (husky, prettier, cspell, commitlint) have a target to install into: `bun init -y`. Without this the sync drops base configs but skips the dep install, since `resolve_missing_deps` short-circuits when `package.json` is absent.
3. Install base tooling: `canon tooling sync base . --write`
4. Install python tooling: `canon tooling sync python . --write`
5. Install Python tooling deps: `uv add --dev ruff mypy pytest pytest-cov`. v1 of this stack does not declare these in `[dependencies.dev]` because manifest injection hardcodes `bun add -D`, which can not install Python packages. Until the injector branches on `runtime`, this step is manual.
6. Sync the lockfile and create the venv: `uv sync`.
7. Run `bun run lint:fix` then `bun run check`.

The python stack also ships `tests/test_smoke.py` as a copy-once seed. `pytest` collects at least one test on first run, so `bun run test:run` exits 0 instead of the empty-collection exit code 5. Delete or replace the smoke test with real tests.

## What ships as golden configs

- `ruff.toml`: line length 88, target `py314`, strict lint rules (`E`, `W`, `F`, `I`, `B`, `C4`, `UP`, `N`), single-quote format, banned relative imports.
- `mypy.ini`: strict mode, `python_version = 3.14`, `mypy_path = src`, excludes `tests/` and `docs/`.
- `pytest.ini`: tests live under `tests/`, source under `src/`.
- `.coveragerc`: branch coverage on `src/`, html report under `.coverage_cache/html`.
- `.python-version`: pinned to `3.14` to match `uv init` defaults.
- `scripts/verify.json`: requires Typecheck (`mypy`), Lint (`ruff check && ruff format --check`), and Tests (`pytest -v`) on top of base's runner, and stops naming `uv` when it is not on PATH. The markdown bans phase runs as it does everywhere.

## Hybrid project shape

A python project synced with this stack ends up with both `package.json` from base and `pyproject.toml` from `uv init`. The base layer brings prettier, cspell, commitlint, and husky for non-Python files. Both `node_modules/` and `.venv/` coexist at the project root. The hybrid shape gives Python projects access to the toolkit's cross-cutting tools without forking the base stack.

## Dependencies

The manifest declares no `[dependencies.dev]`. Manifest injection currently calls `bun add -D` for any declared deps, which would fail for Python packages. v1 sidesteps this by leaving the section empty. Framework adapters that need Python deps require the injector to branch on `runtime` or detect `pyproject.toml` and call `uv add --dev` instead.

## Verify command

`canon tooling verify python` runs the manifest's `[verify] prepare` before Sync, which is checklist steps 2, 5, and 6: `bun init -y`, `uv add --dev ruff mypy pytest pytest-cov`, and `uv sync`. `uv init` writes no `package.json`, and a verify that reaches its end with none fails, so the prepare is what lets `bun run lint:fix` and `bun run check` run at all. Python's `verify.json` requires the `lint`, `typecheck`, and `test:run` scripts that delegate to `uv run`, so the run needs `uv` on the machine and a network for the installs. The end-to-end test and screenshot phases are gated on `package.json` script keys that python does not declare, so they skip.

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

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `mypy .` passes ``. Add a Lint row whose assertion reads: `` `ruff check` and `ruff format --check` pass ``. Add a Tests row whose assertion reads: `` `pytest` exits 0 ``. <!-- audit-ignore-citations: canon/context/ci.md -->
