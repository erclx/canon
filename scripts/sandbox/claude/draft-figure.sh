#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "graph-shaped" "not-graph-shaped"

  case "$SELECTED_OPTION" in
  "graph-shaped")
    mkdir -p docs
    cat <<'EOF' >docs/onboarding.md
# Onboarding

A new account moves through three states before it can place an order:
signup, verification, and active. Nothing in this document draws that path
yet.
EOF

    git add . && git commit -m "docs: add onboarding page with no figure" --no-verify -q

    log_step "Scenario ready: draft a graph-shaped figure"
    log_info "Context: docs/onboarding.md states a three-state account path in prose alone"
    log_info "Action:  /canon:draft-figure the account signup-to-active path in docs/onboarding.md"
    log_info "Expect:  render path decided as Mermaid, since the subject is already a path a flowchart expresses"
    log_info "Expect:  a rendered SVG under the hand-drawn look with the Virgil/Excalifont stack, no literal hex colors"
    log_info "Expect:  a PNG read back and judged before the figure is confirmed"
    log_info "Expect:  <figure> and <figcaption> wrapping the drawing in docs/onboarding.md"
    log_info "Manual leg: whether the rendered picture actually matches the three-state path cannot be asserted here"
    ;;
  "not-graph-shaped")
    mkdir -p docs
    cat <<'EOF' >docs/layout.md
# Card layout

The dashboard arranges four cards in a two-by-two grid, each card offset by
a small rotation to read as hand-placed rather than gridded. Nothing in this
document shows that arrangement yet.
EOF

    git add . && git commit -m "docs: add layout page with no figure" --no-verify -q

    log_step "Scenario ready: draft a freehand figure"
    log_info "Context: docs/layout.md describes a spatial card arrangement, not a graph"
    log_info "Action:  /canon:draft-figure the four-card rotated grid in docs/layout.md"
    log_info "Expect:  render path decided as freehand, since a flowchart cannot express a rotated spatial layout"
    log_info "Expect:  hand-authored inline SVG, no external renderer invoked, no literal hex colors"
    log_info "Expect:  role=\"img\" with an aria-label or aria-labelledby on the drawing"
    log_info "Expect:  <figure> and <figcaption> wrapping the drawing in docs/layout.md"
    log_info "Manual leg: whether the freehand drawing actually reads as the intended layout cannot be asserted here"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
