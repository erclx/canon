#!/usr/bin/env bash
set -e

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "new-subject" "project-owned" "already-covered"

  mkdir -p wiki/claude

  cat <<'EOF' >wiki/index.md
---
title: Wiki
subtitle: 'Reference pages for subjects owned outside this project. Written and maintained by hand.'
---

# Wiki

Reference pages for subjects owned outside this project. Written and maintained by hand.

- [Claude](claude/index.md): Claude Code features and the adjacent Anthropic products, one page per subject Anthropic owns
EOF

  cat <<'EOF' >wiki/claude/index.md
---
title: Claude
subtitle: Claude Code features and the adjacent Anthropic products, one page per subject Anthropic owns.
---

# Claude

Claude Code features and the adjacent Anthropic products, one page per subject Anthropic owns.

- [Claude Code hooks](hooks.md): Event hooks, configuration, and behavior control
EOF

  cat <<'EOF' >wiki/claude/hooks.md
---
title: Claude Code hooks
description: Event hooks, configuration, and behavior control
---

# Claude Code hooks

Hooks are shell commands that run in response to Claude Code events. The harness executes them, not Claude. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

## Events

`PreToolUse` fires before a tool runs and can block it. `PostToolUse` fires after one succeeds.
EOF

  git add . && git commit -m "docs(wiki): seed a populated wiki catalog" -q

  case "$SELECTED_OPTION" in
  "new-subject")
    log_step "Scenario ready: subject passes both placement tests"
    log_info "Context: the catalog holds one page and nothing covers subagents"
    log_info "Action:  /canon:draft-wiki write a wiki page for Claude Code subagents"
    log_info "Expect:  drafted at wiki/claude/subagents.md, sourced through claude-code-guide rather than recall, confirmed before write"
    ;;

  "project-owned")
    log_step "Scenario ready: subject fails the first placement test"
    log_info "Context: the sandbox scenario runner is this project's own surface"
    log_info "Action:  /canon:draft-wiki write a wiki page for how our sandbox scenarios work"
    log_info "Expect:  refuses on the ownership test, routing to draft-docs or draft-context rather than drafting"
    ;;

  "already-covered")
    log_step "Scenario ready: subject already has a page"
    log_info "Context: wiki/claude/hooks.md already documents the hook events"
    log_info "Action:  /canon:draft-wiki add a wiki page about PreToolUse and PostToolUse events"
    log_info "Expect:  refuses on the catalog read, since hooks.md covers it under a different slug"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
