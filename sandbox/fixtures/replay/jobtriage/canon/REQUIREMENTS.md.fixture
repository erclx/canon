# Requirements

## Problem

The Swedish JobTech (Platsbanken) UI filters by occupation code, region, and deadline. It cannot answer free-form questions like "which roles mention agentic systems and have a deadline before next Friday" or "which of these are remote-friendly and ask less than five years of experience." Today this requires opening dozens of full-text ads in browser tabs, reading each by hand, and scoring them against personal criteria with no consistent framework.

## Goals

- Accept a free-form question in chat, return a ranked list of Swedish job ads with deadlines, employer, and a one-line rationale per ad
- Let the user paste their own profile markdown to drive personalized scoring, no account or login required
- Surface tool-call traces so the user can audit which retrieval and reasoning steps produced each answer
- Run the same agent locally via CLI for daily personal use, with read and write access to a local triage state file

## Non-goals

- Auto-apply automation. Different problem class, not the engineering work this project exists to demonstrate.
- Cross-platform aggregation across LinkedIn, Indeed, Otta, and similar. The differentiation is JobTech-specific.
- Recommender-system framing. This is retrieval plus reasoning, not user-modeling.
- Fine-tuning of any model.
- Production-grade auth or multi-tenant. Demo is anonymous and single-session.
- Persistent chat history across sessions (deferred).
- Mobile-optimized UI (deferred).

## MVP features

1. Structured search: query the JobTech API by occupation code, location, deadline, or employer
2. Semantic search: hybrid retrieval over Swedish ad descriptions, ranked by reciprocal rank fusion
3. Profile match: score one ad against a user-provided profile markdown with rationale
4. Triage batch: combine search and match for a sweep, output grouped by recommendation
5. Compare roles: side-by-side analysis of multiple ads against the same criteria
6. Deadline watch: time-sensitive view of ads with imminent deadlines
7. Track status: read engagement state from a local file to surface "already applied" markers (CLI only)
8. Spatial workspace: retrieved ads render as nodes on a canvas the agent drives. The canvas exposes four canonical views (triage clusters, timeline, compare, shortlist). The profile is a persistent node with weighted edges to matched ads. Pinning persists for the browser session.

## Tech stack

- Frontend: Next.js 15, Vercel AI SDK, AI Elements chat components, Tailwind, shadcn/ui
- Backend: FastAPI, Python 3.12
- Job source: JobTech JobSearch API (free, public)
- Embeddings: multilingual-e5-base
- Vector store: SQLite plus sqlite-vec
- Keyword index: SQLite FTS5
- LLM in deploy: Anthropic via the AI SDK (BYOK)
- LLM in development: Ollama with `qwen3-coder:30b`
- CLI: Typer
- Deploy: Vercel for the web surface, Google Cloud Run for the backend

## Constraints

- BYOK only. The deployed app does not carry an Anthropic key. End users supply their own at chat time, held in browser sessionStorage and sent with each request.
- Public repo. Profile markdown is a per-session input, never persisted server-side. No personal data baked into the deployed image.
- Free-tier hosting. Vercel and Cloud Run free tiers must cover the demo workload.
- The ad corpus is shared across all users since Platsbanken data is identical for everyone. Only the conversation and the pasted profile are per-session.
