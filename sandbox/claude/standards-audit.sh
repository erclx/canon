#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude standards-audit shared 01-initial

  git add . && git commit -m "docs(project): initial project scaffold" --no-verify -q

  git checkout -b feat/docs-pass -q

  stage_fixtures claude standards-audit shared 02-docs-pass

  git add . && git commit -m "docs(overview): expand structure section and skill body" --no-verify -q

  log_step "Scenario ready: standards audit with seeded violations"
  log_info "Context: feat/docs-pass branch, one commit ahead of main with markdown violations:"
  log_info "  1. docs/overview.md: em dash in prose"
  log_info "  2. docs/overview.md: 'Here are the X:' lead-in"
  log_info "  3. docs/overview.md: semicolon joining clauses in a bullet"
  log_info "  4. .claude/skills/example/SKILL.md: em dash and inflated prose ('comprehensive', 'offers')"
  log_info "  5. .claude/skills/example/SKILL.md: non-imperative hedging voice ('You should probably try')"
  log_info "  6. canon/context/api.md: em dash, and a Layout section listing files instead of folders"
  log_info "Action:  /standards-audit"
  log_info "Expect:  violations grouped by file with line references, each naming its standard."
  log_info "         canon/context/api.md is the reach test: it must be audited against context.md,"
  log_info "         which the mapping resolves from that standard's own scope statement."
}
