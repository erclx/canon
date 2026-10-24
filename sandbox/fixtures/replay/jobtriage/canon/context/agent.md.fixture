---
title: Agent
description: Tool registry, system prompt, provider switch, and deploy-vs-local posture
---

# Agent

The agent loop is the project's core IP and the most-edited surface. This entry consolidates the wiring rules across `web/src/lib/agent/`, `web/src/app/api/chat/route.ts`, and `web/scripts/model-probe.ts`. Decision-level rationale lives in `canon/ARCHITECTURE.md` under "BYOK over a funded demo", "Live JobTech path in deploy", "Local Ollama for development", and "Tool decomposition over a single-prompt agent". This entry holds the operational wiring those decisions imply.

## Layer responsibilities

- `web/src/lib/agent/tools.ts` owns the two tool registries (`jobtriageTools` local, `deployJobtriageTools` deploy)
- `web/src/lib/agent/system-prompt.ts` owns `buildSystemPrompt` and the two base prompts per mode
- `web/src/app/api/chat/route.ts` orchestrates per-request provider and mode resolution
- `web/scripts/model-probe.ts` drives the chat route against `web/evals/` fixtures, see `evals.md`

## Decisions

### Tool registry split per posture

Local mode keeps the corpus tools because the maintainer's SQLite corpus is the right shape for daily personal triage. Deploy mode excludes corpus-dependent tools because a maintainer-curated corpus cannot serve any visitor's profile. The split is enforced at the registry layer, not at runtime. A deploy request never sees the corpus tools in the system prompt or in the SDK tool registry.

Specifically, deploy swaps `searchJobs`, `semanticSearch`, `triageBatch`, and `deadlineWatch` for live variants, drops the corpus-only tools entirely, and adds `lookupConcept` as the setup gate that resolves user-facing terms to JobTech taxonomy ids.

### Provider switch via header

`x-jobtriage-provider` selects the provider factory (`ollama`, `anthropic`, `openai`, `google`). Default is `anthropic`. The browser sends this header from the BYOK gate selection persisted in `SESSION_KEYS.provider`. BYOK providers require an `Authorization: Bearer <key>` header. Missing key returns 401. Per-provider model id defaults live in `web/src/app/api/chat/route.ts` and override via `ANTHROPIC_MODEL_ID`, `OPENAI_MODEL_ID`, `GEMINI_MODEL_ID`, `OLLAMA_MODEL_ID`.

### System-prompt fixes state the principle, not the examples

When tightening a model-behavior rule in `buildSystemPrompt`, write the principle alone. Do not list specific tokens or example phrases. Models treat example lists as literal whitelists, not instances of a rule, and the rule has to be rewritten on the next near-miss. Draft principle-only first. Add examples only if the principle alone fails the smoke probe set, and even then state them as criteria, not tokens.

Anti-fabrication is the one principle that lives in two places: the deploy planning-rules block in `DEPLOY_BASE` and the opening sentence of the deploy `searchJobs` description. Mid-tier models truncate the tail of long tool descriptions, so the rule needs a foothold in both surfaces. Keep them in sync: any rewrite to one must mirror in the other to avoid drift.

### Mode resolution with a VERCEL gate

`resolveAgentMode` order:

1. If `x-jobtriage-mode: deploy` AND `!process.env.VERCEL`, mode is `deploy`. This lets the model-probe harness drive the deploy posture against a local Ollama branch.
2. Otherwise: Ollama maps to `local`, any other provider maps to `deploy`.

The `VERCEL` gate means a deployed visitor cannot force local mode by spoofing the header. The gate is one-way: deploy traffic is always deploy, local traffic can opt into deploy for testing.

## Gotchas

### Mode override is local-only

A local BYOK provider run defaults to `deploy` because the second branch in the resolver only sees Ollama as `local`. To run a local BYOK probe against the full corpus tool set, run with Ollama or accept that BYOK exercises the deploy posture locally.

### Step count hard cap

`stopWhen: stepCountIs(8)` halts the agent after 8 tool calls in a single turn. No override. Designed to fit local-model context windows. Long chains (lookupConcept then searchJobs then matchProfile then groupAds then connectProfileToAds then setView already burns six). If a feature needs more, audit pairing first.

### Spatial tools are echoes, not server work

Spatial tools (`placeAds`, `groupAds`, `connectProfileToAds`, `pairAdsForCompare`, `placeAdsOnTimeline`, `pinToShortlist`, `markStatus`, `setView`) never call the FastAPI backend. They are server-defined echoes whose `output-available` parts the client `CanvasBridge` translates into reducer dispatches. See `canvas.md` for the bridge contract.

### Authorization header is case-sensitive

`Authorization: Bearer <key>`, exactly. Missing or malformed returns 400 with the provider name in the error message. Do not surface key contents in any error path.

### JobTech API parameter quirks

JobTech `/search` filters occupation concept ids via `occupation-name`, not `occupation-concept-id`. The latter is silently ignored and returns the unfiltered global corpus. JobTech's taxonomy `suggesters/autocomplete` accepts one `type` per request, so cross-taxonomy lookups must fan out to parallel calls. When adding any new JobTech filter, hit the live endpoint and verify the response narrows. Do not trust parameter names from training data or from other endpoints in the same API.

## Probing the agent

Verify agent behavior (tool selection, prompt edits, model output, SSE shape) by driving the running stack directly rather than through the browser. Only reach for the browser when the check needs visual rendering. Probe multiple times to surface non-determinism, since local Ollama is sampling-noisy.

```bash
curl -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -H 'x-jobtriage-provider: ollama' \
  -d '{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"<prompt>"}]}],"profile":null}'
```

Swap `x-jobtriage-provider: ollama` for `Authorization: Bearer sk-ant-...` to drive the deployed Anthropic path.

To exercise the deploy posture (live JobTech path, `lookupConcept` plus live `searchJobs`) on the local Ollama branch without burning Anthropic credits, add `x-jobtriage-mode: deploy` to the headers, or open `http://127.0.0.1:3000/?mode=deploy` so the chat client sends the same header. The route gates the override on the absence of `process.env.VERCEL`, so production traffic cannot force the posture.

Read tool-call ordering with `grep -oE '"toolName":"[a-zA-Z]+"'` and final text with `grep -oE '"delta":"[^"]*"'`.

Before loading a local model, start `scripts/monitor.sh` and check host RAM. Override `num_ctx` to 8192 via `OLLAMA_NUM_CTX` or route `providerOptions`. Ollama's default 131k allocates a KV cache that spills WSL2 into Windows host RAM on 30B-class models. Abort if host is already at 80%. Full rationale in `development.md`.

When a model ignores a prompt rule across 3-5 probes at the working temperature, stop tightening the prompt. Document it as a known limitation and queue a model-swap or guard-rail follow-up instead.

## Hidden contracts

- `x-jobtriage-mode` default is empty, not `local`. The resolver falls through to step 2 when the header is absent or anything other than `deploy`.
- The system prompt is rebuilt per request, not cached. The `today` field is the request's date in ISO, so the date used in deadline reasoning is server-side and stable across the agent's loop.
- Profile content flows from the chat request body (`profile` field), not from a header or cookie. The browser pulls profile from `SESSION_KEYS.profile` and posts it inline. No persistence server-side.
- When `profile` is null or whitespace-only, `buildSystemPrompt` omits the `PROFILE_HEADER`/`PROFILE_FOOTER` sandwich entirely and the agent skips `connectProfileToAds` per the base prompts.
- Endpoint mapping for the seven local data tools: `searchJobs` and `semanticSearch` hit `/v1/jobs/search` and `/v1/jobs/semantic`. `matchProfile` and `compareRoles` share `/v1/jobs/details`. `triageBatch` calls `/v1/jobs/triage`. `deadlineWatch` calls `/v1/jobs/deadline`. `trackStatus` reads `GET /v1/engagements/status`. The deploy posture remaps `searchJobs` to `/v1/jobs/live-search`, `matchProfile` and `compareRoles` to `/v1/jobs/live-details`, and adds `lookupConcept` against `/v1/taxonomy/lookup`. See `python.md` for backend route ownership.
- Deploy `searchJobs` requires at least one of `query` or `occupation_concept_id`. Both the Zod `LiveJobSearchRequestSchema` and the pydantic `LiveJobSearchRequest` refuse region-only or empty payloads with a 422 whose message names `lookupConcept` as the recovery path. The system-prompt rule about concept-id error recovery covers the 422 contract. Do not duplicate the recovery wording in the tool description.
