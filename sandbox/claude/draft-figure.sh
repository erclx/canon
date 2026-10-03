#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

# A rendered lesson page rather than markdown, since the in-page capture needs a
# page to load. The stylesheet defines the custom properties a figure colors
# through, and the hand font is what Mermaid cannot measure. The body face is
# one every machine resolves, since `canon capture` refuses a page whose figure
# inherits a family the machine lacks.
seed_lesson() {
  local file="$1"

  mkdir -p "$(dirname "$file")"
  cat <<'EOF' >"$file"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Order states</title>
    <style>
      :root { --ink: #1f1d1a; --paper: #fbf8f1; --muted: #6b665c; --accent: #b4532a; }
      body { background: var(--paper); color: var(--ink); font-family: system-ui, sans-serif; line-height: 1.6; }
      main { max-width: 68ch; margin: 0 auto; padding: 2rem 1rem; }
      figure { margin: 2rem -4rem; }
      figure svg text { font-family: Virgil, Excalifont, cursive; }
    </style>
  </head>
  <body>
    <main>
      <h1>Order states</h1>
      <p>An order moves through four states: placed, paid, shipped, and delivered.
      It only moves forward, and each move has one trigger. Payment clearing moves
      a placed order to paid, the carrier scan moves it to shipped, and the
      delivery scan moves it to delivered.</p>
      <p>One branch leaves the path. A paid order that has not shipped can be
      refunded, which ends it in the refunded state instead of delivered.</p>
      <section class="quiz">
        <h2>Quiz</h2>
        <fieldset class="q">
          <legend>Which state can a refund start from?</legend>
          <label><input type="radio" name="q1" /> Paid, before the carrier scan</label>
          <label><input type="radio" name="q1" /> Shipped, before delivery scan</label>
        </fieldset>
      </section>
    </main>
  </body>
</html>
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "graph-shaped" "not-graph-shaped" "teach-lesson"

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
  "teach-lesson")
    seed_lesson ".canon/teach/01-orders/lessons/0001-order-states.html"

    git add . && git commit -m "docs: add order states lesson with no figure" --no-verify -q

    log_step "Scenario ready: draft a graph-shaped figure into a teach lesson"
    log_info "Context: .canon/teach/01-orders/lessons/0001-order-states.html states a"
    log_info "  four-state order path in prose, with a refund branch, and draws nothing"
    log_info "  The subject is graph-shaped, so outside a lesson it routes through Mermaid"
    log_info ""
    log_info "Action:  /canon:draft-figure the order path from placed to delivered, with the"
    log_info "         refund branch, in .canon/teach/01-orders/lessons/0001-order-states.html,"
    log_info "         ahead of the quiz. Write it without waiting for a confirmation."
    log_info "Expect:  declared in fixtures/claude/draft-figure/teach-lesson/expect.toml"
    log_info "         Check it with: canon sandbox check claude:draft-figure teach-lesson"
    log_info "         Render path decided as freehand because the destination is a teach lesson"
    log_info "         No Mermaid source or config under .canon/tmp/figures/"
    log_info "         The figure captured inside the lesson with canon capture --selector figure"
    log_info "         <figure>, <figcaption>, and an inline SVG colored through the lesson's"
    log_info "         custom properties, placed ahead of the quiz"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
