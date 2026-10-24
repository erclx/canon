# jobtriage

Triages Swedish job ads against a pasted profile, lays results onto a spatial canvas, and shows the agent's tool calls inline so the ranking stays auditable. Next.js app in `web/`, FastAPI tool server and CLI in `python/`.

## Context

- Before non-trivial work in a domain, read `canon/context/<domain>.md`, and before touching a UI surface read `canon/wireframes/<surface>.md`. Pick which from the index anchors below.

@canon/context/index.md
@canon/REQUIREMENTS.md
@canon/ARCHITECTURE.md
@canon/wireframes/index.md

## Commands

- `bun run check` runs the full verify cascade. Full script reference in `canon/context/development.md`.
- Do not run `bun run dev`. The script is disabled. Run `bun run restart:web` from the repo root for any local server need. It kills stale `next-server` and Playwright zombies, rebuilds, starts the server in the background with logs at `.canon/tmp/restart/server.log`, and verifies the listening pid changed. Do not rely on `lsof -ti:3000`, it can miss `next-server`.

## Key paths

- `web/`: Next.js app, bun-managed, owns the chat surface, canvas, and the agent route
- `python/`: FastAPI tool server and Typer CLI, uv-managed, owns retrieval and the JobTech client
- `scripts/`: repo-root shell tooling (restart, monitor)
- `web/evals/`: structured JSON fixtures consumed by `web/scripts/model-probe.ts`. See `canon/context/evals.md` for fixture shape.
- `.claude/wiki/`: durable reusable technical knowledge that outlives any single project decision
