---
title: Python
description: FastAPI backend, Python tools, and Typer CLI structure
---

# Python

FastAPI backend, Python tools, and Typer CLI. The same Python modules power the HTTP layer the web app calls and the CLI for local daily triage.

## Stack

- Python 3.12, managed with [uv](https://docs.astral.sh/uv/)
- FastAPI for the HTTP layer
- Typer for the CLI
- SQLite for storage. FTS5 for the BM25 keyword index. A nullable `embedding` BLOB column on `ad_chunks` holds dense vectors, scored in-process via numpy cosine.
- `intfloat/multilingual-e5-base` for embeddings (v1), via `sentence-transformers`
- `httpx` for the JobTech API client
- `ruff` for lint and format, `mypy` for strict types, `pytest` for tests

Typer, httpx, pydantic, and pydantic-settings shipped in v0. The hybrid retriever, embedder, and eval harness shipped in v1. FastAPI shipped in v2 per `canon/ARCHITECTURE.md`.

## Layout

```plaintext
python/
├── src/
│   └── jobtriage/
│       ├── __init__.py
│       ├── __main__.py         ← `python -m jobtriage` entrypoint
│       ├── settings.py         ← pydantic-settings, env-prefixed JOBTRIAGE_
│       ├── errors.py           ← project-rooted exception hierarchy
│       ├── engagement.py       ← mark-status writer for the engagement log
│       ├── api/                ← FastAPI app, routers, schemas, dependencies
│       ├── jobtech/            ← async JobTech client (search, taxonomy, ad fetch) + pydantic models
│       ├── storage/            ← SQLite schema, chunker, append-mostly ingest
│       ├── embeddings.py       ← multilingual-e5 wrapper with passage/query prefixes
│       ├── retrieval.py        ← BM25, dense cosine, reciprocal rank fusion
│       ├── evals/              ← golden-set loader and ablation harness
│       └── cli/                ← Typer commands: sweep, mark-status, index, search, evaluate, evaluate-embeddings
├── tests/                      ← pytest, mirrors src/ layout
├── scripts/
│   ├── verify.sh               ← Python verify (ruff, mypy, pytest, openapi freshness)
│   ├── serve.sh                ← `bun run dev:api` runner, uvicorn with `--reload`
│   └── export_openapi.py       ← regenerates `openapi.json`, called from verify.sh
├── openapi.json                ← FastAPI schema, regenerated and gated by verify.sh
├── .python-version             ← 3.12
├── pyproject.toml              ← project + [dependency-groups] dev + hatchling
├── ruff.toml
├── mypy.ini
├── pytest.ini
└── .coveragerc
```

The `storage/` schema reserves a nullable `embedding` BLOB column on `ad_chunks` that v1 backfills via the `index` command. An `ad_chunks_fts` virtual table mirrors chunk text under FTS5 for BM25 queries, kept in lockstep with chunk inserts and deletes.

## Layer responsibilities

- `jobtech/` owns the async httpx JobTech client and pydantic models
- `api/` owns the thin FastAPI HTTP wrapper, request schemas, and lifespan
- `storage/` owns the SQLite schema, paragraph-then-length chunker, and append-mostly ingest
- `embeddings.py` owns the `multilingual-e5` wrapper with passage/query prefixes
- `retrieval.py` owns BM25, dense cosine, and the RRF fusion that composes them
- `evals/` owns the golden-set loader and four-configuration runner, details in `canon/context/evals.md`
- `engagement.py` owns the markdown engagement log reader and writer
- `cli/` owns the Typer commands (`sweep`, `index`, `search`, `mark-status`), plus `evaluate` and `evaluate-embeddings` covered in `canon/context/evals.md`

## Decisions

### JobTech concept-id format validation at the request schema

`JobSearchRequest.occupation_concept_id` and `LiveJobSearchRequest.occupation_concept_id` validate against the JobTech 4-3-3 alphanumeric nanoid pattern (e.g., `X9jv_K2b_m48`). Fabricated ids return 422 with an actionable message. The v4.2 audit caught the agent inventing ids like `occupation-12345` on adversarial prompts, which silently returned the unfiltered global corpus because no boundary check existed. A structured 422 lets the model recover into a different tool, instead of looking like the corpus has no matches.

### RRF floor scoped to corpus endpoints

`JOBTRIAGE_RRF_FLOOR` (default `0.025`) drops below-floor results at `/v1/jobs/triage` and `/v1/jobs/semantic` only. `/v1/jobs/search` and `/v1/jobs/live-search` are left untouched since they filter recent ads regardless of relevance score. Full rationale in `canon/context/retrieval.md`.

### `/v1/jobs/live-details` returns partial results on per-ad failure

`live_job_details` uses `asyncio.gather(..., return_exceptions=True)` and partitions outcomes into a parallel `errors` array on `LiveJobDetailsResponse`. A single transient JobTech 5xx no longer aborts the whole batch. A per-ad `LiveAdDetailsError{ad_id, error}` lands in `errors` and the route only emits 404 when every ad failed. Web zod schema mirrors the optional field with `.default([])` so the canvas bridge keeps iterating `results` unchanged.

### Exception handlers route through `JobtriageError`

`@app.exception_handler(JobtriageError)` returns 400 with the project-rooted message. A generic `@app.exception_handler(Exception)` logs the traceback and returns a sanitized 500 (`{'detail': 'Internal server error.'}`). The prior bare `ValueError` handler leaked pydantic and numpy internals through the 400 body. FastAPI's built-in `RequestValidationError` and `HTTPException` paths still resolve before the generic handler, so 422 boundary validation stays clean.

### JobTech client timeout under the web boundary

`Settings.jobtech_timeout_seconds` defaults to `20.0` so FastAPI emits the structured 504 ahead of the web client's `JOBTRIAGE_API_TIMEOUT_MS=30000` abort. Tune via env when JobTech latency drifts.

## Conventions

- Strict mypy. Annotate every function. `uv init --app` ships an unannotated `main()` that fails on first run.
- Sidecar configs for ruff and mypy (`ruff.toml`, `mypy.ini`). pytest config lives inline under `[tool.pytest.ini_options]` in `pyproject.toml` because pytest has no sidecar precedence drift.
- `[project.scripts]` exposes `jobtriage` as the CLI entrypoint, installed via the hatchling build backend.
- Tests live under `tests/` with `pythonpath = src`. `asyncio_mode = "auto"` so `async def` tests run without per-test markers.

## Anti-patterns

- Do not use `pip` directly. Always go through `uv add`, `uv sync`, or `uv run`.
- Do not move `[tool.ruff]` or `[tool.mypy]` into `pyproject.toml`. Keep them sidecar to avoid silent precedence bugs.
- Do not pin Python via `[project] requires-python` and `.python-version` independently. Treat `.python-version` as the source of truth.
- Do not add `commitizen` for conventional commits. Root already ships commitlint plus husky.

## Commands

Run from `python/` after `cd python`.

| Command                                   | Purpose                            |
| ----------------------------------------- | ---------------------------------- |
| `uv sync`                                 | Install dependencies into `.venv/` |
| `uv add <pkg>`                            | Add a runtime dependency           |
| `uv add --dev <pkg>`                      | Add a dev dependency               |
| `uv run ruff check .`                     | Lint                               |
| `uv run ruff format .`                    | Auto-format                        |
| `uv run mypy .`                           | Strict typecheck                   |
| `uv run pytest -v`                        | Tests                              |
| `bash scripts/verify.sh`                  | Full python verify                 |
| `uv run jobtriage-api`                    | Start the FastAPI server           |
| `uv run python scripts/export_openapi.py` | Regenerate `openapi.json`          |

## Deploy

Google Cloud Run on the Always Free tier, region `europe-west1`. The image ships in slim mode (`JOBTRIAGE_DEPLOY_MODE=slim`): no SQLite corpus and no `sentence-transformers`/`torch` wheel, since the deploy posture only calls `live-search`, `live-details`, `taxonomy/lookup`, and `engagements/status`. Corpus-backed endpoints return 503 in slim mode. The deployed image carries no provider keys: visitors supply Anthropic, OpenAI, or Gemini keys at chat time.

For the full deploy sequence (Cloud Run build, Vercel project setup, Cloudflare DNS) and the platform gotchas behind it, see `canon/context/deploy.md`.
