#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "with-context" "bare"

  case "$SELECTED_OPTION" in
  "with-context")
    cat <<'EOF' >CLAUDE.md
# Notes App

Markdown note-taking app. v2 launch adds inline edit on click.
EOF

    mkdir -p .claude
    cat <<'EOF' >canon/REQUIREMENTS.md
# Requirements

## Audience

Power users evaluating note-taking tools.

## v2 scope

- Inline edit on click, no modal
- Save indicator per note
- Keyboard nav across the note list
EOF

    mkdir -p .canon/tasks
    cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v02.0: Record v2 launch screencast](v02.0-launch-screencast.md): Walk the inline edit flow end to end for the v2 launch
EOF

    cat <<'EOF' >.canon/tasks/v02.0-launch-screencast.md
---
title: 'v02.0: Record v2 launch screencast'
description: Walk the inline edit flow end to end for the v2 launch
---

# v02.0: Record v2 launch screencast

Walk through the inline edit flow end to end. The hero moment is save-on-blur with the indicator updating in place under 400ms.

- [ ] Outcome: 75-90s recording covering click -> edit -> save indicator
- [ ] Outcome: distribution to social and canonical hosts
EOF

    git add . && git commit -m "feat(notes): v2 scope notes" --no-verify -q

    log_step "Scenario ready: screencast draft (with project context)"
    log_info "Context: notes app v2 launch with REQUIREMENTS, .canon/tasks/, and CLAUDE.md present"
    log_info "Action:  /canon:draft-screencast 'v2 inline edit launch'"
    log_info "Expect:  4 discovery questions with seeded defaults, then draft to .canon/tmp/screencast/<slug>.md with 8 sections and 5 pre-seeded beats"
    log_info "Expect:  the closing block names canon demo compile as the next step and the session stops there rather than compiling or recording"
    ;;
  "bare")
    cat <<'EOF' >README.md
# My Tool

A small CLI for organizing notes.
EOF

    git add . && git commit -m "chore: initial state" --no-verify -q

    log_step "Scenario ready: screencast draft (no project context)"
    log_info "Context: bare repo, no CLAUDE.md or .canon/tasks/"
    log_info "Action:  /canon:draft-screencast 'cli onboarding walkthrough'"
    log_info "Expect:  discovery falls back to generic defaults and the draft is still written"
    log_info "Expect:  no recording tool, editing tool, font, or window manager inside the draft, and no selector, URL, or timing on a beat"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
