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
  "name": "sandbox-ux-walkthrough",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Notes app

A single-page notes app. No build command and no running server: this tree is
source only.
EOF

  mkdir -p src
  cat <<'EOF' >src/main.js
document.body.innerHTML = "<h1>Notes</h1>"
EOF

  git add . && git commit -m "feat(notes): source-only tree with no build or server" --no-verify -q

  log_step "Scenario ready: refuse with nothing to measure (ux-walkthrough)"
  log_info "Context: package.json declares no build, dev, or preview script, and CLAUDE.md's Commands section holds only the seed placeholder"
  log_info "Action:  /canon:ux-walkthrough"
  log_info "Expect:  the skill refuses with 'Nothing to inspect. A walkthrough measures a running build.' and stops"
  log_info "Expect:  no file under .canon/walkthroughs/, no candidate page, and no server started"
  log_info "Manual:  the link-before-question order, the batch relay, and measurement read-back need a live operator, a browser, and a served build, so a headless run can only prove the refusal above"
}
