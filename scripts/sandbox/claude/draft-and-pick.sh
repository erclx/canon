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
  "name": "sandbox-draft-and-pick",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  # The page carries one unresolved treatment and nothing else worth deciding,
  # so a run has one subject to draft arms against. The callout ships flat, which
  # is arm 0 for any candidate set drawn off this page.
  cat <<'EOF' >index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Release notes</title>
    <style>
      body {
        font: 16px/1.5 system-ui, sans-serif;
        margin: 0 auto;
        max-width: 40rem;
        padding: 3rem 1rem;
      }
      .callout {
        background: #f4f4f5;
        padding: 1rem;
      }
    </style>
  </head>
  <body>
    <h1>Release notes</h1>
    <p>Every change since the last tag, grouped by the surface it reaches.</p>
    <div class="callout">
      <p>Upgrading from 3.x needs one manual step. Read the migration note first.</p>
    </div>
    <p>Nothing else on this page has an unresolved treatment.</p>
  </body>
</html>
EOF

  mkdir -p .claude
  cat <<'EOF' >canon/DESIGN.md
---
title: Design
description: Tokens, typography, and the treatments still unresolved
---

# Design

## Tokens

- Ground: `#ffffff`
- Ink: `#18181b`
- Muted ground: `#f4f4f5`

## Unresolved

The callout on `index.html` reads as a flat grey block and carries no signal
that it is a warning rather than an aside. How it should separate from the
prose around it is undecided, and the decision is taste rather than
correctness: a border, a ground shift, and a rule down one edge are all
defensible and nobody has looked at them side by side.
EOF

  git add . && git commit -m "feat(page): release notes with an undecided callout treatment" --no-verify -q

  log_step "Scenario ready: a stated visual decision with one treatment undecided"
  log_info "Context: index.html carries one flat callout, and .claude/DESIGN.md states the"
  log_info "         treatment as undecided between a border, a ground shift, and an edge rule"
  log_info "Browser: machine-dependent, and the sandbox does not decide it. canon capture resolves"
  log_info "         playwright-core through the installed canon rather than this project, so the"
  log_info "         render works wherever bunx playwright install chromium has run once and takes"
  log_info "         the refusal path everywhere else. Measured 2026-09-02: chromium present, a page"
  log_info "         declaring no font refused on Times New Roman, and one declaring system-ui"
  log_info "         rendered. The project harness an end to end test needs is still absent either way,"
  log_info "         since that one resolves @playwright/test out of a node_modules nobody installed."
  log_info "Action:  /canon:draft-and-pick draft candidates for the callout treatment on index.html, and take arm 2 when you put the pick to me"
  log_info "Expect:  the closed state. A headless run has no operator to say the pick is right, so it"
  log_info "         carries the pre-supplied pick through step 6 rather than parking at the hand-off:"
  log_info "         the arm applied to the callout in index.html, the rest of that page untouched,"
  log_info "         and the scratch folder removed. Measured 2026-09-02 at 99 seconds, drafting four"
  log_info "         arms with the shipping wash as arm 0 and recording the pick in the design note."
  log_info "Not reached: the loop, the pick, and the hand-off. The loop stops on a person saying the"
  log_info "         pick is right and no fixture supplies one, so a pass here is not coverage of them."
}
