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
  "name": "sandbox-document-health",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  mkdir -p src/api docs canon/context

  cat <<'EOF' >src/api/router.ts
export function buildRoutes(): string[] {
  return ['/health']
}
EOF

  cat <<'EOF' >canon/context/index.md
---
title: Context
description: Per-domain narrative loaded on demand
---

# Context

- [API](api.md): Request handling, routing, and the serialization boundary
EOF

  # Staleness seed. Every path this entry names resolved when it was written and
  # two of them no longer do, which is the axis no verb answers. The count in
  # the Layout lead-in is the second testable claim shape.
  cat <<'EOF' >canon/context/api.md
---
title: API
description: Request handling, routing, and the serialization boundary
---

# API

## Overview

Owns request handling and the serialization boundary. Everything below the handler belongs to the data domain.

## Layout

Three files carry the domain:

- `src/api/router.ts` builds the route table from the handler registry
- `src/api/serialize.ts` converts a domain record into a wire payload
- `src/api/errors.ts` maps a thrown error onto a status code

Run `canon api verify --strict` before shipping a handler change.
EOF

  # Length seed. One paragraph past the sentence and character checkpoints, and
  # one top-level bullet carrying a paragraph's worth of text behind a dash.
  cat <<'EOF' >docs/overview.md
---
title: Overview
description: High-level project overview
---

# Overview

The project is organized around a handler registry that the router reads at startup to build its route table, and each handler declares the shape of the payload it accepts so the serialization boundary can reject a malformed request before any domain code runs. The registry is populated by a scan at build time rather than by an explicit list, which means a new handler reaches the router by existing in the right folder rather than by being registered anywhere. That scan runs once and caches its result, so a handler added while the process is live is not picked up until a restart. The caching is deliberate and it is the reason the development server watches the handler folder and restarts itself, which keeps the live loop working without making the production path pay for a watcher it never needs.

## Structure

- `src/api/` owns handlers and the router, and it is the only folder that reaches the serialization boundary directly, since everything below the handler is domain code that never sees a wire payload and never learns which transport carried the request it is answering, which is the separation the boundary exists to hold and the reason a domain module importing from the transport layer is treated as a defect rather than a shortcut.
- `docs/` holds the reference pages.
EOF

  git add . && git commit -m "docs(project): initial project scaffold" --no-verify -q

  log_step "Scenario ready: document health across three axes"
  log_info "Context: a project whose documents have rotted in three different ways:"
  log_info "  1. canon/context/api.md names src/api/serialize.ts and src/api/errors.ts, neither of which exists"
  log_info "  2. canon/context/api.md states 'Three files carry the domain' against a tree holding one"
  log_info "  3. canon/context/api.md names 'canon api verify --strict', a command that does not exist"
  log_info "  4. docs/overview.md carries a paragraph past the sentence and character checkpoints"
  log_info "  5. docs/overview.md carries a top-level bullet past the character checkpoint"
  log_info "Action:  /document-health"
  log_info "Expect:  one section per document across length, placement, and staleness."
  log_info "         Length findings on docs/overview.md read as 'measured', citing the checkpoint"
  log_info "         the markdown audit record returned rather than a number from the skill body."
  log_info "         Every staleness finding on canon/context/api.md is marked 'read', not measured."
  log_info "         No verdict across the three axes and no score across the documents."
  log_info "         Nothing is repaired: both files are byte-identical after the run."
}
