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
  "name": "sandbox-migration-context",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >CLAUDE.md
# My App

Mixed web and python project that predates the three-tier context model.

See `docs/web.md` and `docs/python.md` for per-stack details.
EOF

  mkdir -p docs
  cat <<'EOF' >docs/web.md
---
title: Web
description: Next.js app structure, layers, and conventions
---

# Web

Next.js app. Owns the chat UI and the agent loop.

## Stack

- Next.js 16 with App Router
- React 19
- Tailwind v4

## Layout

```plaintext
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── features/chat/
│   └── lib/
└── package.json
```

## Conventions

- Server components by default. Add `'use client'` only when required.
- Domain UI lives under `src/features/`.

## Anti-patterns

- Do not use `tsc -b` or composite mode. Use `tsc --noEmit`.
- Do not lint the `.next/` build output.
EOF

  cat <<'EOF' >docs/python.md
---
title: Python
description: FastAPI backend, Python tools, and CLI structure
---

# Python

FastAPI backend and CLI.

## Stack

- Python 3.12, managed with uv
- FastAPI for the HTTP layer
- Click for the CLI

## Layout

```plaintext
python/
└── src/sample/
    ├── api/
    └── cli/
```

## Commands

| Command          | Purpose          |
| ---------------- | ---------------- |
| `uv sync`        | Install deps     |
| `uv run pytest`  | Run tests        |

## Anti-patterns

- Do not use `pip` directly. Always go through `uv`.
EOF

  cat <<'EOF' >docs/contributing.md
# Contributing

Welcome! This guide walks new contributors through getting set up.

## Getting started

1. Clone the repository
2. Install dependencies with `bun install`
3. Run the dev server with `bun run dev`
4. Open a pull request when you have a change to propose

We are happy to review contributions from anyone, regardless of experience level.
EOF

  cat <<'EOF' >docs/development.md
---
title: Development
description: Local dev workflow, scripts, and husky hooks
---

# Development

Local dev workflow for this project.

## Setup

- Install [Bun](https://bun.sh): `curl -fsSL https://bun.sh/install | bash`
- Install dependencies: `bun install`

## Scripts

| Command          | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `bun run check`  | Full verification. Auto-formats, then asserts clean. |
| `bun run format` | Auto-fix prettier and shfmt formatting.              |

## Shell scripts

All `.sh` files live under `scripts/`.

## Husky hooks

- `pre-commit` runs `lint-staged`.
- `pre-push` runs `bun run check`.
EOF

  cat <<'EOF' >docs/index.md
---
title: Docs
subtitle: Reference docs for the project
---

# Docs

- [Contributing](contributing.md): getting started for new contributors
- [Development](development.md): local dev workflow
- [Web](web.md): Next.js layout and conventions
- [Python](python.md): FastAPI layout and commands
EOF

  git add . && git commit -m "chore(project): initial docs layout" --no-verify -q

  log_step "Scenario ready: classify docs/ for migration"
  log_info "Context: docs/ folder with mixed content"
  log_info "  docs/web.md       agent-flavored: anti-patterns, file paths, conventions"
  log_info "  docs/python.md    agent-flavored: layer responsibilities, command tables"
  log_info "  docs/contributing.md  human-only: tutorial prose, getting-started"
  log_info "  docs/development.md   matches toolkit base seed shape"
  log_info "  docs/index.md     auto-regenerated, not migrated"
  log_info ""
  log_info "Action:  /migration-context"
  log_info "Expect:  proposal block with grouped sections:"
  log_info "         Move to canon/context/: web.md, python.md"
  log_info "         Keep in docs/: contributing.md"
  log_info "         Defer to seed-sync: development.md"
  log_info "         Suggested git mv commands listed for the user to run"
  log_info "         Inbound link to fix: CLAUDE.md references docs/web.md and docs/python.md"
  log_info "         Skill does NOT execute the moves and does NOT rewrite CLAUDE.md"
}
