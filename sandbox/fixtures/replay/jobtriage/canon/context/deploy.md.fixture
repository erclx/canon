---
title: Deploy
description: Cloud Run backend, Vercel frontend, Cloudflare domain, and the platform gotchas behind them
---

# Deploy

Two surfaces ship the public demo: the Python FastAPI backend on Google Cloud Run, the Next.js frontend on Vercel. A custom domain at Cloudflare points at Vercel. The deployed image is BYOK and stateless. Anthropic, OpenAI, and Gemini keys live in the visitor's browser sessionStorage and forward per request. The gate also exposes a no-key mock path that replays pre-canned SSE fixtures from `web/src/features/mock/scripts/` so a visitor without a key can still see the agent and the spatial canvas.

`docs/deploy.md` is the public counterpart linked from the README: the steps to deploy your own fork plus a "Common failures" section drawn from the Gotchas below. This entry keeps the decision rationale and the production-specific smoke commands, for a reader with the source open.

## Layer responsibilities

The backend runs out of `python/` as a Docker image built remotely by Cloud Build.

| File                             | Purpose                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `python/Dockerfile`              | Python 3.12 slim base, installs `requirements-deploy.txt`, copies `src/`, runs `python -m jobtriage.api`. |
| `python/requirements-deploy.txt` | Pinned slim dependency set. No torch, no sentence-transformers, no typer.                                 |
| `python/.dockerignore`           | Excludes `var/`, `tests/`, `evals/`, `*.db`, and other build noise.                                       |
| `python/.gcloudignore`           | Mirror of `.dockerignore` for `gcloud builds`.                                                            |
| `python/scripts/deploy.sh`       | One-shot `gcloud run deploy` wrapper. Reads `JOBTRIAGE_CLOUD_RUN_SERVICE` and `_REGION` overrides.        |

The frontend runs out of `web/` as a Next.js 16 App Router project on the Vercel Hobby free tier.

| Setting          | Value                             |
| ---------------- | --------------------------------- |
| Root Directory   | `web`                             |
| Framework Preset | `Next.js`                         |
| Build Command    | default (`next build` via preset) |
| Install Command  | default (`bun install`)           |
| Node             | 24.x                              |

## Decisions

### Slim image (`JOBTRIAGE_DEPLOY_MODE=slim`)

The Cloud Run image omits `sentence-transformers`, `torch`, and the SQLite corpus. The lifespan skips the embedder warmup. Corpus-dependent endpoints return 503 with `Corpus tools are disabled in deploy mode.` This is what the tool registry split in `agent.md` rests on.

### Region is `europe-west1`

Belgium, the closest free-tier-eligible region to the JobTech upstream. The service scales to zero and starts on the first request. Always-Free tier covers this workload at $0/month.

### Per-provider model id env vars

`ANTHROPIC_MODEL_ID`, `OPENAI_MODEL_ID`, `GEMINI_MODEL_ID` override the defaults pinned in `web/src/app/api/chat/route.ts`. Production Vercel can A/B without a code edit. See `agent.md` for current defaults.

| Key                  | Default                     |
| -------------------- | --------------------------- |
| `ANTHROPIC_MODEL_ID` | `claude-haiku-4-5-20251001` |
| `OPENAI_MODEL_ID`    | `gpt-5.1-mini`              |
| `GEMINI_MODEL_ID`    | `gemini-3-flash`            |

### Cloud Run memory pinned at 1Gi

`python/scripts/deploy.sh` ships `--memory 1Gi`. The prior `512Mi` ran out of memory under live-search plus live-details parallel load and SIGKILLed without a log. 1Gi stays inside the Always-Free tier because the binding limits are CPU-seconds and request count, not memory.

### Cloud Run cold-start is acceptable for a BYOK demo

`min-instances 0` means the first request after idle pays a 1-5 second cold start. Acceptable because the user is already waiting on LLM streaming latency. Do not bump `min-instances` to 1 to chase cold-start metrics, it would push the Always-Free tier into paid.

## Hidden contracts

- Cloud Run injects `PORT`, which `jobtriage.api.__main__` honors with a fallback to `JOBTRIAGE_API_PORT` then `8000`.
- Vercel environment variables:

| Key                      | Scope                            | Value                                                          |
| ------------------------ | -------------------------------- | -------------------------------------------------------------- |
| `JOBTRIAGE_API_BASE_URL` | Production, Preview, Development | Cloud Run service URL (server-only, no `NEXT_PUBLIC_` prefix). |
| `NEXT_PUBLIC_SITE_URL`   | Production                       | Custom domain, used by `metadataBase` for OG card resolution.  |

## Gotchas

### `/healthz` is reserved by Cloud Run's edge

Use `GET /health` instead. Cloud Run's edge intercepts `/healthz` before the container and returns a Google Frontend 404. The interception is case-sensitive, so uppercase `/HEALTHZ` reaches the app but should never be relied on.

### Vercel Framework Preset must stay `Next.js` for App Router routes

If the build, output, or install overrides toggle on, Vercel clears the preset to `null` and stops applying its Next.js builder. The build still succeeds, but every route returns `x-vercel-error: NOT_FOUND` at runtime. If you hit this state, set Framework Preset back to `Next.js` and turn the override toggles off.

### Cloudflare proxy mode breaks Vercel SSL

DNS records pointing at Vercel must stay on **DNS only** (gray cloud) in Cloudflare. Orange-cloud proxy mode causes a Cloudflare 525 (SSL handshake failed) because Cloudflare's edge tries to negotiate SSL with Vercel's origin, which expects to terminate SSL itself.

### Hobby plan Deployment Protection defaults on

Vercel Hobby returns 401 or 404 to non-team-member traffic until Deployment Protection is set to `Disabled` under Settings. Anonymous visitors cannot reach the demo otherwise.

## Deploy

Backend, from `python/`:

```bash
cd python
./scripts/deploy.sh
```

First run creates the service. Subsequent runs roll a new revision. Cloud Build uploads `python/` (filtered by `.gcloudignore`), runs the `Dockerfile`, pushes to Artifact Registry, and Cloud Run creates a new revision.

Frontend: Vercel auto-deploys on push to `main` once the GitHub integration is connected. Manual redeploys:

```bash
bunx vercel@latest redeploy https://jobtriage-<hash>-<team-slug>.vercel.app
```

## Custom domain

`jobtriage.erclx.dev` resolves via Cloudflare DNS to Vercel's anycast IP.

1. Add the domain to the Vercel project: `bunx vercel@latest domains add jobtriage.erclx.dev`.
2. At Cloudflare, in the `erclx.dev` zone, add a DNS record:
   - Type: `A`
   - Name: `jobtriage`
   - IPv4: `76.76.21.21`
   - Proxy status: **DNS only** (gray cloud)
   - TTL: 60s or Auto
3. Vercel verifies the record and issues a Let's Encrypt cert within ~5 minutes.

## Smoke

Backend, against the Cloud Run URL:

```bash
URL=https://jobtriage-<project-number>.europe-west1.run.app
curl -sS "$URL/health"
curl -sS -X POST "$URL/v1/taxonomy/lookup" -H 'content-type: application/json' -d '{"query":"sjuksköterska","top_k":2}'
curl -sS -X POST "$URL/v1/jobs/live-search" -H 'content-type: application/json' -d '{"query":"developer","top_k":2}'
curl -sS -X POST "$URL/v1/jobs/semantic" -H 'content-type: application/json' -d '{"query":"test","top_k":2}'  # expect 503
```

End to end, against the deployed domain:

```bash
URL=https://jobtriage.erclx.dev

curl -sS -o /dev/null -w "%{http_code}\n" "$URL/"
curl -sS -X POST "$URL/api/chat" \
  -H 'content-type: application/json' \
  -H 'x-jobtriage-provider: anthropic' \
  -H 'Authorization: Bearer sk-ant-...' \
  -d '{"messages":[{"id":"u1","role":"user","parts":[{"type":"text","text":"hi"}]}],"profile":null}'
```

For a visual smoke, open the URL in a cold browser tab, paste a key in the BYOK gate, send a tool-warranted prompt like `Show me nursing roles in Stockholm`, confirm the trace shows `lookupConcept` then `searchJobs` and the canvas populates with ad nodes.

For an automated visual smoke, run `bun run smoke:prod` from `web/`. The Playwright harness drives every canonical state against the deployed URL, captures PNGs to `.canon/review/screenshots/jobtriage.erclx.dev/`, and exits non-zero on any `console.error`. Eyeball the PNG set against `canon/wireframes/<surface>.md` for drift.

Validate the OG card via the [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) once the custom domain is live.
