#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "full" "small" "multi-concern" "stacked" "constraint" "layout" "vague" "underspecified"

  case "$SELECTED_OPTION" in
  "full")
    stage_fixtures claude plan-feature full 01-initial

    mkdir -p .claude

    mkdir -p src src/routes

    mkdir -p .canon/tasks

    git add . && git commit -m "feat(api): initial task endpoints" --no-verify -q

    log_step "Scenario ready: feature planning (full mode)"
    log_info "Context: task API with SQLite, Express routes, CLAUDE.md, ARCHITECTURE.md, and .canon/tasks/ present"
    log_info "Action:  /plan-feature (reference the task in .canon/tasks/)"
    log_info "Expect:  plan written to .canon/plans/feature-<slug>.md with files to touch, risks, and questions, each question carrying a Suggested line and an Answer slot, and v01.0-due-dates.md's Plan: line points at it"
    ;;
  "small")
    stage_fixtures claude plan-feature small 01-initial

    mkdir -p .claude

    mkdir -p canon/wireframes
    rm -f canon/wireframes/feature-name.md

    mkdir -p .canon/tasks

    git add . && git commit -m "chore(notes): initial notes repo" --no-verify -q

    log_step "Scenario ready: feature planning (small mode)"
    log_info "Context: prose-only repo, single README task, decoy DESIGN and wireframes/ with sentinel text"
    log_info "Action:  /plan-feature (reference the task in .canon/tasks/)"
    log_info "Expect:  chat-only output, NO .canon/plans/ file written, decoys NOT surfaced"
    ;;
  "multi-concern")
    stage_fixtures claude plan-feature multi-concern 01-initial

    mkdir -p src/routes docs

    mkdir -p .canon/tasks

    git add . && git commit -m "chore(sandbox): initial state" --no-verify -q

    log_step "Scenario ready: feature planning (multi-concern)"
    log_info "Context: two unrelated tasks in .canon/tasks/, one API change and one prose edit"
    log_info "Action:  /plan-feature 'add pagination to /users and tighten the docs intro'"
    log_info "Expect:  two plan files in .canon/plans/, one per concern, not a single bundled slug, and each task's Plan: line points at its own plan"
    ;;
  "stacked")
    stage_fixtures claude plan-feature stacked 01-initial

    mkdir -p src/form

    mkdir -p .canon/tasks

    git add . && git commit -m "feat(form): initial signup form" --no-verify -q

    log_step "Scenario ready: feature planning (stacked)"
    log_info "Context: one task with three outcomes that build in sequence over the same three source files"
    log_info "Action:  /plan-feature 'plan the task'"
    log_info "Expect:  one plan file in .canon/plans/, or every extra plan carrying a Judged apart from constraint with a reason, and canon records validate plans reports no stack-foldable"
    ;;
  "constraint")
    stage_fixtures claude plan-feature constraint 01-initial

    mkdir -p docs canon/context

    mkdir -p .canon/tasks

    git add . && git commit -m "docs(reference): initial reference doc" --no-verify -q

    log_step "Scenario ready: feature planning (constraint)"
    log_info "Context: docs/reference.md split into a folder, cited by docs/onboarding.md and canon/context/pipeline.md"
    log_info "Action:  /plan-feature 'split docs/reference.md per the task. Constraint: leave canon/context/pipeline.md alone.'"
    log_info "Expect:  the plan's Constraints entry resolves both acts for pipeline.md, forbidding conforming it to the new shape and requiring its citations of the deleted path be retargeted, and v01.0-reference-split.md's Plan: line points at the plan"
    ;;
  "layout")
    # Two roles share one flat folder: generic primitives any screen renders
    # and pieces only the cart screen renders. The arm scores whether the plan
    # adds three more components beside them or places them by role.
    stage_fixtures claude plan-feature layout 01-initial

    mkdir -p src/components e2e
    local component
    for component in Button Card Dialog Input Select Spinner Tooltip; do
      cat <<EOF >"src/components/$component.tsx"
export function $component(props: { children?: React.ReactNode }) {
  return <div className="$component">{props.children}</div>
}
EOF
    done
    for component in CartLine CartSummary CartEmpty CouponField ShippingPicker; do
      cat <<EOF >"src/components/$component.tsx"
import { Card } from './Card'

export function $component() {
  return <Card>$component</Card>
}
EOF
    done

    mkdir -p .canon/tasks

    git add . && git commit -m "feat(shop): initial storefront and cart" --no-verify -q

    log_step "Scenario ready: feature planning (layout)"
    log_info "Context: flat src/components/ mixing 7 primitives with 5 cart pieces, flat e2e/ mixing 2 specs with 2 helpers, one wishlist task"
    log_info "Before:  rm -rf .claude/skills/codebase-layout .claude/skills/plan-feature, since the injected copies carry no references/ or standards/ and shadow the plugin"
    log_info "Action:  /canon:plan-feature plan the wishlist task in .canon/tasks/v01.0-wishlist.md"
    log_info "Expect:  plan names its new components under a subfolder rather than flat in src/components/, its new e2e helper outside the specs' folder, and a placement reason on each new path"
    ;;
  "vague")
    # The ask names no number, so the only measurable criterion in reach is
    # the budget this file states. The arm scores whether the plan carries it.
    stage_fixtures claude plan-feature vague 01-initial

    mkdir -p canon

    mkdir -p src/routes

    git add . && git commit -m "feat(api): initial task list" --no-verify -q

    log_step "Scenario ready: feature planning (vague)"
    log_info "Context: task list API that filters in memory, canon/REQUIREMENTS.md states a 200 ms p95 budget for GET /tasks"
    log_info "Action:  /canon:plan-feature make the task list faster"
    log_info "Expect:  plan written whose Verification carries the stated budget as a number with a unit, with the success criteria settled before the file list"
    ;;
  "underspecified")
    stage_fixtures claude plan-feature underspecified 01-initial

    mkdir -p src

    git add . && git commit -m "chore(app): initial app" --no-verify -q

    log_step "Scenario ready: feature planning (underspecified)"
    log_info "Context: one-line CLAUDE.md and one source file, no requirements, no tasks"
    log_info "Action:  /canon:plan-feature improve the app"
    log_info "Expect:  NO .canon/plans/ file written, and the session asks what the improvement must achieve before planning"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
