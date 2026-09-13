#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-diagram",
  "version": "1.0.0",
  "private": true
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Ad triage

Two-folder app. `web/` runs a Next.js chat surface. `api/` runs FastAPI tools backed by SQLite for keyword and vector search.
EOF

  cat <<'EOF' >>canon/REQUIREMENTS.md

## Problem

Ad reviewers open one ticket at a time and search a policy corpus by hand.

## Tech stack

Next.js browser client, FastAPI service, SQLite corpus. Reviewers reach it from a browser. It calls an LLM provider with a key the reviewer supplies, and pulls policy documents from an internal compliance export.
EOF

  cat <<'EOF' >>canon/ARCHITECTURE.md

# Architecture

## Overview

Two folders: `web/` runs Next.js with the agent loop in the browser via the Vercel AI SDK, and `api/` runs FastAPI wrapping retrieval and ranking tools. SQLite holds the shared corpus with FTS5 for keywords and a numpy cosine scan for vectors.

Four layers, in request-flow order:

1. Web shell (Next.js plus chat components)
2. Agent shell (Vercel AI SDK, registers tools and runs the loop)
3. Backend (FastAPI HTTP layer)
4. Tools implementation (Python: retriever, ranker) plus storage (SQLite)

## Key technical decisions

### Hybrid retrieval

BM25 over FTS5 for exact terms, dense embeddings for semantics, reciprocal rank fusion to combine. Optional cross-encoder rerank when precision matters.

### SQLite over an external vector DB

One file, no extra service, ships embedded in the deploy image.

### BYOK

The deployed app does not carry an LLM key. Users supply their own at chat time, held in browser sessionStorage.
EOF

  mkdir -p web/src/agent web/src/tools api/src/retrieval api/src/ranking

  cat <<'EOF' >web/src/agent/loop.ts
// Vercel AI SDK agent loop. Registers tools and streams to the chat UI.
EOF

  cat <<'EOF' >web/src/tools/search.ts
// TS wrapper that POSTs to /api/tools/search.
EOF

  cat <<'EOF' >api/src/retrieval/hybrid.py
"""Hybrid retriever: BM25 + dense + RRF."""
EOF

  cat <<'EOF' >api/src/retrieval/embedding.py
"""multilingual-e5-base embedding wrapper."""
EOF

  cat <<'EOF' >api/src/ranking/rerank.py
"""Optional cross-encoder reranker."""
EOF

  # Two entries already drawn and still accurate. Only the deploy signal below
  # moves, so a conforming pass rewrites deployment.md and nothing else. These
  # are the siblings the checksum baseline protects.
  cat <<'EOF' >.canon/diagrams/components.md
---
title: Components
description: Layered structure inside the boundary, drawn from ARCHITECTURE.md
category: Components
---

# Components

How the four layers sit relative to each other.

```mermaid
flowchart TB
  accTitle: The four layers of the ad triage app
  accDescr: A browser tier feeds an HTTP tier, which feeds tools and storage.
  subgraph Browser
    A["Web shell"]
    B["Agent loop"]
  end
  subgraph Server
    C["FastAPI layer"]
    D["Retriever"]
  end
  E["SQLite corpus"]
  A --> B --> C --> D --> E
```

The browser holds the agent loop, so the server stays a plain tool host. Open `web/src/agent/loop.ts` for the loop and `api/src/retrieval/hybrid.py` for the retriever.
EOF

  cat <<'EOF' >.canon/diagrams/data-pipeline.md
---
title: Data pipeline
description: How a query reaches ranked policy documents, drawn from the retrieval modules
category: Data pipeline
---

# Data pipeline

How one query becomes a ranked list.

```mermaid
flowchart TB
  accTitle: Hybrid retrieval path for one query
  accDescr: A query fans out to keyword and vector search, then merges and reorders.
  A["Query"]
  B["BM25 over FTS5"]
  C["Dense embedding"]
  D["Reciprocal rank fusion"]
  E["Cross encoder rerank"]
  A --> B --> D
  A --> C --> D
  D --> E
```

Two retrieval arms run against the same SQLite file, so there is no second service to keep in sync. The rerank stage is optional and skipped when precision is not the binding constraint. See `api/src/retrieval/hybrid.py`.
EOF

  # The only signal that moves. The deploy topology gained a worker service,
  # so deployment.md is the one entry a conforming pass has reason to write.
  cat <<'EOF' >docker-compose.yml
services:
  web:
    build: ./web
    ports: ["3000:3000"]
  api:
    build: ./api
    ports: ["8000:8000"]
  worker:
    build: ./api
    command: python -m api.jobs.reindex
EOF

  mkdir -p fixtures

  # Baseline for the untouched assertion. The scenario's core claim is that a
  # deploy refresh leaves siblings byte-identical, which needs a recorded
  # before-state to be checkable rather than eyeballed.
  sha256sum .canon/diagrams/components.md .canon/diagrams/data-pipeline.md \
    >fixtures/siblings.sha256

  cat <<'EOF' >fixtures/known-bad.mmd
flowchart TB
  subgraph Browser
    A["Web shell"]
    B["Chat components"]
    C["Agent loop with Vercel AI SDK"]
    D["Tool registry"]
  end
  subgraph Server
    E["FastAPI HTTP layer"]
    F["Retriever"]
    G["Ranker"]
    H["Cross encoder reranker"]
    I["Embedding wrapper"]
  end
  subgraph Storage
    J["SQLite corpus"]
    K["FTS5 keyword index"]
    L["Vector table"]
  end
  A --> B --> C --> D --> E
  E --> F --> J
  F --> K
  F --> I --> L
  F --> G --> H
  H --> E
  G --> E
  J --> F
  K --> F
  L --> F
EOF

  git add . && git commit -m "feat(sandbox): seed two-folder app with two drawn diagram entries" --no-verify -q

  log_step "Scenario ready: refresh one diagram entry without disturbing its siblings"
  log_info "Context: web/ + api/ + SQLite, two entries already drawn under .canon/diagrams/"
  log_info "Signals the skill should pick up:"
  log_info "  docker-compose.yml gained a worker service → deployment is the stale kind"
  log_info "  canon/REQUIREMENTS.md names reviewers, an LLM provider, a compliance export → system context has no entry yet"
  log_info "  components.md and data-pipeline.md still match ARCHITECTURE.md → neither has a reason to change"
  log_info "Action: /canon:draft-diagram refresh the deployment diagram"
  log_info "Expect: .canon/diagrams/deployment.md written, with title, description, and category frontmatter"
  log_info "Expect: components.md and data-pipeline.md byte-identical afterward"
  log_info "  Assert it: sha256sum -c fixtures/siblings.sha256"
  log_info "Expect: .canon/diagrams/index.md regenerated, entries grouped under category headings"
  log_info "Expect: chat output names the untouched entries rather than reporting them as written"
  log_info "Expect: PNG render under .canon/tmp/diagrams/ for deployment alone, not for the siblings"
  log_info "Second pass: /canon:draft-diagram draw the system context"
  log_info "  Expect: system-context.md drawn from REQUIREMENTS.md, showing actors outside the boundary"
  log_info "  Expect: siblings.sha256 still verifies"
  log_info "Known-bad fixture: fixtures/known-bad.mmd passes every source rule and fails three ways rendered"
  log_info "  Render it to see the failure: bunx -y @mermaid-js/mermaid-cli -i fixtures/known-bad.mmd -o /tmp/known-bad.png"
  log_info "  Diagonal layout, three parallel stores in a row reading as a chain, six edges bundled on one node"
  log_info "Manual leg: whether an inspected render actually got corrected cannot be asserted here"
}
