#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >>CLAUDE.md

# My App

## About

This toolkit supports every popular language and framework out of the box.

## Commands

- `bun run check`: lint and typecheck
EOF

  mkdir -p docs
  cat <<'EOF' >docs/overview.md
---
title: Overview
description: Supports every popular language and framework out of the box.
---

# Overview

The `description` field above is required by the docs index and can never be
left blank, so a wrong claim there is corrected to a different one rather
than deleted.

## Tagline

The line below is quoted verbatim by the release notes template and is
required there. It can only be replaced with a different line, never
deleted or left blank:

> It is the fastest way to ship production-grade software.

See `docs/limitations.md` for what is actually installed today.
EOF

  cat <<'EOF' >docs/limitations.md
# Limitations

The toolkit supports TypeScript and Python projects. Every other stack needs
a hand-written stack config before the toolkit can install anything into it.
EOF

  git add . && git commit -m "docs: add overview and limitations pages" --no-verify -q

  log_step "Scenario ready: one inflated claim corrects, one has to be drafted"
  log_info "Context: CLAUDE.md and docs/overview.md's description field both"
  log_info "  carry the same inflated framework claim, corrected by"
  log_info "  docs/limitations.md, which already states the true scope."
  log_info "  docs/overview.md's tagline carries a second inflated claim that"
  log_info "  cannot be deleted and has no source anywhere in the tree, so"
  log_info "  its replacement has to be invented."
  log_info ""
  log_info "Action:  /canon:markdown-propose screen CLAUDE.md and"
  log_info "         docs/overview.md for inflated claims and propose fixes,"
  log_info "         as the inflated-claims proposal"
  log_info "Expect:  declared in fixtures/claude/markdown-propose/expect.toml"
  log_info "         Check it with: canon sandbox check claude:markdown-propose"
  log_info "         A folder at .canon/proposals/<slug>/ carrying a corrected"
  log_info "         single-replacement change in each file and one drafted"
  log_info "         change with three labelled variants, every You: slot empty."
  log_info "         Three expectations need a reader and report as unchecked."
}
