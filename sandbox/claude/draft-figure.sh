#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "graph-shaped" "not-graph-shaped" "teach-lesson" "architecture-set"

  case "$SELECTED_OPTION" in
  "graph-shaped")
    stage_fixtures claude draft-figure graph-shaped 01-initial

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
    stage_fixtures claude draft-figure not-graph-shaped 01-initial

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
    # A rendered lesson page rather than markdown, since the in-page capture needs a
    # page to load. The stylesheet defines the custom properties a figure colors
    # through, and the hand font is what Mermaid cannot measure. The body face is
    # one every machine resolves, since `canon capture` refuses a page whose figure
    # inherits a family the machine lacks.
    stage_fixtures claude draft-figure teach-lesson 01-initial

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
  "architecture-set")
    # A small two-folder project with its requirements record and one context
    # entry to draw into. The request names an architecture view, so the run
    # shapes it through the architecture set and renders it through Mermaid,
    # landing it in the entry rather than in a per-kind diagrams folder.
    stage_fixtures claude draft-figure architecture-set 01-initial

    git add . && git commit -m "docs: add components entry with no figure" --no-verify -q

    log_step "Scenario ready: draft an architecture view into a named entry"
    log_info "Context: canon/REQUIREMENTS.md and the context index describe a"
    log_info "  four-layer web, agent, API, and SQLite app"
    log_info "  canon/context/components.md states the layers in prose and draws nothing"
    log_info ""
    log_info "Action:  /canon:draft-figure the components view in canon/context/components.md,"
    log_info "         below the opening paragraph. Write it without waiting for a confirmation."
    log_info "Expect:  declared in fixtures/claude/draft-figure/architecture-set/expect.toml"
    log_info "         Check it with: canon sandbox check claude:draft-figure architecture-set"
    log_info "         Render path decided as architecture, drawn from canon/context/index.md and the folder layout"
    log_info "         A rendered SVG inside <figure> and <figcaption> in the entry"
    log_info "         Nothing written under .canon/diagrams/"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
