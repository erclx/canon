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
  "name": "sandbox-diagram-migrate",
  "version": "1.0.0",
  "private": true
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Ad triage

Two-folder app. `web/` runs a Next.js chat surface. `api/` runs FastAPI tools backed by SQLite.
EOF

  cat <<'EOF' >>canon/ARCHITECTURE.md

# Architecture

## Overview

`web/` runs Next.js with the agent loop in the browser. `api/` runs FastAPI wrapping retrieval tools. SQLite holds the corpus.
EOF

  mkdir -p web/src api/src

  cat <<'EOF' >web/src/loop.ts
// Vercel AI SDK agent loop.
EOF

  cat <<'EOF' >api/src/hybrid.py
"""Hybrid retriever."""
EOF

  # The pre-split surface. Three kinds in one file, which is the shape every
  # project installed before the folder still carries.
  cat <<'EOF' >.claude/DIAGRAMS.md
# Diagrams

Drawn from ARCHITECTURE.md. Covers the layered structure, one request, and the deploy topology.

## Components

The four layers and how they stack.

```mermaid
flowchart TB
  accTitle: The layers of the ad triage app
  accDescr: A browser tier feeds an HTTP tier, which feeds tools and storage.
  A["Web shell"]
  B["Agent loop"]
  C["FastAPI layer"]
  D["SQLite corpus"]
  A --> B --> C --> D
```

The browser holds the agent loop, so the server stays a plain tool host. Open `web/src/loop.ts` for the loop.

## Request flow

What happens when a reviewer asks one question.

```mermaid
sequenceDiagram
  accTitle: One reviewer question end to end
  accDescr: The browser calls the API, which searches SQLite and returns ranked hits.
  participant R as Reviewer
  participant W as Web shell
  participant A as FastAPI
  participant S as SQLite
  R->>W: Ask a policy question
  W->>A: POST /tools/search
  A->>S: Hybrid query
  S-->>A: Ranked hits
  A-->>W: Tool result
  W-->>R: Streamed answer
```

The loop runs in the browser, so the server never holds conversation state. Each tool call is independent.

## Deployment

Where each piece runs.

```mermaid
flowchart TB
  accTitle: Deploy topology
  accDescr: Two containers behind one host, sharing an embedded database file.
  A["Host"]
  B["web container"]
  C["api container"]
  D["SQLite file"]
  A --> B
  A --> C
  C --> D
```

SQLite ships inside the api image, so a deploy is two containers and no managed database. See `docker-compose.yml`.
EOF

  cat <<'EOF' >docker-compose.yml
services:
  web:
    build: ./web
    ports: ["3000:3000"]
  api:
    build: ./api
    ports: ["8000:8000"]
EOF

  mkdir -p fixtures

  # Baseline for the leave-the-original-alone assertion. A conversion that
  # edits or deletes its own source removes the only way to check the split.
  sha256sum .claude/DIAGRAMS.md >fixtures/original.sha256

  git add . && git commit -m "feat(sandbox): seed a project holding the pre-split flat diagram file" --no-verify -q

  log_step "Scenario ready: convert a pre-split .claude/DIAGRAMS.md into per-kind entries"
  log_info "Context: three H2 sections in one flat file, seeded .canon/diagrams/ holding index.md alone"
  log_info "Signals the skill should pick up:"
  log_info "  .canon/diagrams/ has no entries and .claude/DIAGRAMS.md exists → this is a migration pass"
  log_info "  Three H2 sections map to components, request flow, and deployment"
  log_info "  No section maps to system context, so that kind stays absent this pass"
  log_info "Action: /canon:draft-diagram"
  log_info "Expect: three entries under .canon/diagrams/, one per H2 section"
  log_info "  Named by the standard: components.md, request-flow.md, deployment.md"
  log_info "Expect: each mermaid body carried across unchanged, not redrawn"
  log_info "  Assert it: diff <(grep -A 20 'flowchart TB' .claude/DIAGRAMS.md) is a manual read, compare bodies by eye"
  log_info "Expect: .claude/DIAGRAMS.md untouched on disk"
  log_info "  Assert it: sha256sum -c fixtures/original.sha256"
  log_info "Expect: chat output says deleting the original is the user's call"
  log_info "Expect: .canon/diagrams/index.md regenerated, three entries under category headings"
  log_info "Failure to catch: a pass that redraws rather than converts, which hides whether the move or the rewrite broke a diagram"
  log_info "Manual leg: whether each section landed in the kind it actually belongs to"
}
