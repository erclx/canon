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
  "name": "sandbox-sketch-design",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  mkdir -p .claude references
  cat <<'EOF' >>canon/REQUIREMENTS.md

# Requirements

A single-screen focus timer for writers.

## Personality

Quiet and disciplined, and undecided on one axis: whether the page should
read warm or cool. Two reference images sit in references/ for that call.
EOF

  # Two flat SVG swatches stand in for reference screenshots, so the scenario
  # needs no network render and no browser binary to exercise the pick.
  cat <<'EOF' >references/warm.svg
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
  <rect width="320" height="180" fill="#faf3e8"/>
  <rect x="24" y="24" width="120" height="40" fill="#b5502e"/>
  <text x="24" y="100" font-family="Georgia, serif" font-size="20" fill="#2b241c">Warm paper</text>
</svg>
EOF

  cat <<'EOF' >references/cool.svg
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">
  <rect width="320" height="180" fill="#eef2f6"/>
  <rect x="24" y="24" width="120" height="40" fill="#2f5fae"/>
  <text x="24" y="100" font-family="system-ui, sans-serif" font-size="20" fill="#1a2331">Cool slate</text>
</svg>
EOF

  git add . && git commit -m "chore(project): seed a focus timer undecided between two reference swatches" --no-verify -q

  log_step "Scenario ready: two local reference images with no DESIGN.md yet"
  log_info "Context: REQUIREMENTS.md names the undecided axis, references/warm.svg and references/cool.svg"
  log_info "         are the two swatches to compare. No canon/DESIGN.md exists, so there is no arm 0."
  log_info "Action:  /canon:sketch-design compare references/warm.svg and references/cool.svg for the page's"
  log_info "         color and type direction, and take arm 2 (cool slate) when you put the pick to me."
  log_info "         The pick is pre-supplied in the prompt, the same shape draft-and-pick's own sandbox arm"
  log_info "         uses, since a headless run has nobody to answer the question and would stall on it otherwise."
  log_info "Expect:  the closed state. A headless run has no operator to ask for a narrower set, so it carries"
  log_info "         the pre-supplied pick straight to the trace rather than looping."
  log_info "Expect:  .canon/review/evidence/<slug>/design-handoff.md naming arm-2 as picked, the operator's"
  log_info "         stated reason, and Color and Typography values traced from cool.svg: the slate ground,"
  log_info "         the blue accent, and the system-ui family, with no ? verify tag on any of them."
  log_info "Expect:  .canon/review/evidence/<slug>/ also holds both arms' rendered PNGs, not only the winner."
  log_info "Not reached: canon/DESIGN.md itself. That is a separate run of /canon:design-extract reading"
  log_info "         the handoff this run writes, which is out of scope for this scenario."
}
