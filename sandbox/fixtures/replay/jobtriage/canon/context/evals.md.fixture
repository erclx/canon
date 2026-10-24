---
title: Evals
description: Retrieval ablation harness and agent-eval fixtures, two separate stacks
---

# Evals

Two unrelated eval stacks sit under one name. Do not assume changes in one affect the other. Retrieval ablation runs in Python over a Swedish golden set. Agent eval runs in TypeScript driving the chat route against fixture JSON. Both ship their own metrics into README ablation tables.

## Stack 1: Retrieval ablation

### Layer responsibilities

- `python/src/jobtriage/evals/golden.py` loads a YAML golden set into a Pydantic model with `query`, `expected_ad_ids`, and an optional `note`.
- `python/src/jobtriage/evals/harness.py` owns the four-configuration runner: filter-only, BM25-only, dense-only, hybrid. Metrics per config: precision@1, precision@5, precision@10, recall@10, p50 latency, p95 latency.
- `python/src/jobtriage/evals/embedding_ablation.py` (separate runner) encodes chunks in memory per model and ranks via cosine similarity. Loads chunks once, runs three models (e5-base default, e5-large, MiniLM English baseline) with explicit `gc.collect()` between models. Zero database writes. `ad_chunks.embedding` stays untouched.
- `python/src/jobtriage/cli/evaluate.py` is the `evaluate` Typer command. Loads YAML, instantiates `SentenceTransformerEmbedder`, runs four configs, renders markdown, optionally writes JSON.
- `python/src/jobtriage/cli/evaluate_embeddings.py` is the `evaluate-embeddings` Typer command. Three-model dense plus hybrid ablation. Output goes into the multilingual table in the README.

### Commands

Run from `python/` after `cd python`:

```bash
uv run jobtriage evaluate --golden <path> --model <model-id> [--db <path>] [--json-out <path>]
uv run jobtriage evaluate-embeddings --golden <path> [--db <path>] [--json-out <path>]
```

### Gotchas

- The eval harness is pure retrieval and does not call an LLM. The nightly `eval.yml` workflow runs at 03:00 UTC and skips when no SQLite corpus is present in the runner.
- In-memory ablation cannot mutate `ad_chunks.embedding`. The canonical pipeline still indexes with e5-base. The ablation is read-only.

## Stack 2: Agent eval

### Layer responsibilities

- `web/scripts/model-probe.ts` is the fixture-agnostic driver. Loads a JSON fixture, dispatches probes by `kind` field, emits one markdown table per provider or per model alongside a structured JSON artifact.
- `web/scripts/probe-eval.ts` holds the pure SSE parser, the conversation-kind evaluators (tool-call accuracy, ad-id recall, keyword recall, concept-id discipline, recovery detection), and the markdown emitter. Imported by both the harness and `probe-eval.test.ts`.
- `web/evals/*.json` carry the fixtures. Each declares a `kind` plus a `probes` array. Supported kinds: `discipline`, `language`, `pairing`, `general-profile`, `conversation`.
- `.github/workflows/agent-eval.yml` wires the harness into GitHub Actions on `workflow_dispatch` only.

### Fixture kinds

- **`discipline`** (`agent-discipline.json`): chitchat versus tool-warranted. Measures chitchat false-positives and tool-warranted correct rate.
- **`language`** (`agent-language.json`): English versus Swedish. Text-based detection via Swedish marker-word set (min 2 hits).
- **`pairing`** (`agent-spatial-pairing.json`): data tool plus paired spatial tool. Verdict per probe: full, partial, missing, unexpected-tool. Includes `fallbackSpatialTools` for accepted substitutions.
- **`general-profile`** (`agent-general-profile.json`): cross-profession deploy posture. Carries an inline `profiles` map keyed by `profileKey` (ai-engineer, nurse, marketer, chef). Harness sends `x-jobtriage-mode: deploy` via `forceDeploy: true`.
- **`conversation`** (`agent-conversation.json`): per-probe expected tools, expected ad ids in top-k, expected response keywords, and per-probe `pass_criteria` thresholds layered over fixture-level defaults. Verdict combines tool-call accuracy (set match by default, ordered match opt-in), ad-id recall against a frozen scope (`local-only` or `skip` for deploy probes), keyword recall on the joined assistant text, concept-id discipline (lookupConcept precedes searchJobs OR ids match the JobTech nanoid format), and recovery detection (a named tool fires after a captured `tool-output-error`). Per-probe `forceDeploy` lets one fixture mix local-corpus and deploy-posture probes.

### Request shape

The harness posts to `PROBE_CHAT_URL` (default `http://localhost:3000/api/chat`) with `x-jobtriage-provider`, optional `x-jobtriage-mode: deploy`, and optional `Authorization: Bearer <key>`. Body shape:

```json
{
  "messages": [
    {
      "id": "u1",
      "role": "user",
      "parts": [{ "type": "text", "text": "<prompt>" }]
    }
  ],
  "profile": "<string or null>"
}
```

Response is the AI SDK SSE stream. The harness walks each `data:` line, decodes the JSON envelope, and builds an ordered `toolCalls` array keyed by `toolCallId` (capturing `tool-input-available`, `tool-output-available`, `tool-output-error`, and `text-delta` events). The discipline, language, pairing, and general-profile kinds consume the flat `toolNames` list. The conversation kind also reads `toolCalls[].input` and `toolCalls[].output` so the evaluator can assert ad-id recall and concept-id discipline against captured payloads.

### `workflow_dispatch` posture and secrets

- `agent-eval.yml` triggers on `workflow_dispatch` only. No cron. The maintainer-funded providers stay capped.
- Inputs: `providers` (comma-separated, default `gemini` for the free tier), `fixture` (default `web/evals/agent-discipline.json`).
- Per-provider gating reads `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`. Providers without a configured secret emit a warning and skip.
- Each run starts a local web server (`bun build && bun start`), polls health, then drives the harness three times: the dispatch-supplied fixture, then `agent-general-profile.json`, then `agent-conversation.json`.
- Output lands at `.canon/tmp/ollama-model-research/smoke-{provider}-{fixture-name}.md` plus a peer `.json` artifact and uploads both as a build artifact.

### Deploy posture override

General-profile runs flip `forceDeploy: true`, which sends `x-jobtriage-mode: deploy`. The chat route honors it only when `!process.env.VERCEL`. Local Ollama dev surface can simulate deploy behavior (corpus-excluded tool set) for portability checks. Vercel CI sets `VERCEL` automatically so prod cannot be forced from outside.

### Model bake-off history (gemma4:26b selection)

`gemma4:26b` was chosen over the prior `qwen3-coder:30b` after a six-model A/B smoke run via this harness. The coder variant fired retrieval tools on conversational turns (3/5 false-positives on "hi", "what can you do", "how are you"), a known limitation of agentic-coder RL training. Gemma 4 26B (MoE 25.2B / 3.8B-active) hit 0/5 chitchat false-positives plus 3/3 tool-warranted correct at 2.6 s avg latency, beat the dense `gemma4:31b` on speed at the same accuracy, and beat `mistral-small3.2:24b` and `qwen3:32b` on tool selection. The two latter models mis-fired `searchJobs` without a JobTech concept_id, a system-prompt rule violation. `qwen3:30b` was disqualified for leaking thinking-channel content into chat output. Re-run the harness on future model swaps.

## Gotchas

- For Ollama, the harness calls `bun run restart:web` between model batches with `OLLAMA_MODEL_ID` set in env. Restart timeout defaults to 120s. A timed-out restart fails that model and continues to the next.
- `PROBE_SKIP_RESTART=1` short-circuits the restart for a maintainer iterating against an already-running local server. The default leaves restarts on so per-model A/B runs stay clean.
- BYOK runs skip the restart and require `PROBE_API_KEY` set per provider.
- The `kind` field is required. The harness dispatches by `kind` and an unknown value fails fast. Add a new probe shape by extending the dispatch table, not by reusing an existing `kind`.
- Multi-turn discipline is not covered. `/api/chat` is single-shot stateless and the harness sends one user turn per probe. v6.1 will add a per-probe `turns: []` thread that pipes assistant replies back into the next request body.
- `PROBE_INTER_PROBE_MS` paces requests with per-provider defaults (`gemini=6500`, others `0`) so free-tier rate limits do not return empty SSE on later probes. Resolved via `web/scripts/lib/pacing.ts`. Explicit env override always wins. The smoke artifact records the value in use under `Inter-probe delay: <ms>ms`.
- The `agent-eval.yml` `only_input_fixture` boolean (default false) skips the hardcoded general-profile and conversation steps so a dispatch targets only the dispatch-supplied fixture. Use for surgical reruns, especially when one provider's key is depleted and rerunning the full set would burn budget on rate-limited probes.
