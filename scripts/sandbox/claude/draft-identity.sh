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
  "name": "sandbox-draft-identity",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Focus timer

A single-screen focus timer for writers. Voice is calm and disciplined.
EOF

  mkdir -p .claude
  cat <<'EOF' >canon/DESIGN.md
---
title: Design
description: Tokens for the focus timer
---

# Design

## Personality

Quiet and disciplined. Warm paper tones, a single confident accent for the
active state. No decoration, no motion.

## Color

| Role   | Intent               | Value     |
| ------ | --------------------- | --------- |
| Ground | warm paper page       | `#faf6f0` |
| Ink    | primary text          | `#2b241c` |
| Accent | the active timer state | `#b5502e` |

## Typography

| Role  | Family                    | Weight | Size | Line height |
| ----- | ------------------------- | ------ | ---- | ----------- |
| Body  | system-ui, sans-serif     | 400    | 16px | 1.5         |
| Heavy | system-ui, sans-serif     | 700    | 28px | 1.2         |

## Spacing

- Base unit: `8px`

## Borders

| Role    | Radius | Width |
| ------- | ------ | ----- |
| Default | 4px    | 1px   |

## Motion

No animation.

## Iconography

No custom icons.
EOF

  git add . && git commit -m "feat(project): seed a focus timer with DESIGN.md tokens" --no-verify -q

  log_step "Scenario ready: a project with DESIGN.md tokens and no logo, favicon, or manifest yet"
  log_info "Context: CLAUDE.md names a focus timer, canon/DESIGN.md carries Personality, Color, and Typography"
  log_info "Signals the skill should pick up:"
  log_info "  Personality: quiet, disciplined, warm paper tones, single accent, no motion"
  log_info "  Color: warm paper ground, dark ink, a rust accent for the active state"
  log_info "  No public/, static/, index.html, or manifest.json anywhere in the tree"
  log_info "Action: /canon:draft-identity draft a logo mark and social card, and take arm 1 when you put the pick to me"
  log_info "        The pick is pre-supplied in the prompt, the same shape draft-and-pick's own sandbox arm"
  log_info "        uses, since a headless run has nobody to answer the question and would stall on it otherwise."
  log_info "Expect: the default icon size sequence announced (16x16, 32x32, 48x48, 180x180, 192x192, 512x512),"
  log_info "        since no HTML head or manifest declares one"
  log_info "Expect: the write folder announced as the project root, since no public/ or static/ folder exists"
  log_info "Expect: favicon.svg, one PNG per default size, and og-image.png (1200x630) written at the project root"
  log_info "Expect: canon capture's own stdout reports each PNG's rendered width and height"
  log_info "Not reached: whether the mark itself reads well. That is a person's call, the same ceiling"
  log_info "        draft-and-pick's own sandbox arm accepts for its loop-and-pick half."
}
