#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  log_step "Docs sandbox"
  log_info "list : downstream catalog, toolkit-internal context entries filtered out"
  log_info "get  : print one doc to stdout by exact name, from docs/ or canon/context/"
  log_info "canon docs reads the toolkit's own docs/ and canon/context/, no target needed"

  select_or_route_scenario "Which scenario?" "list" "get"

  case "$SELECTED_OPTION" in
  "list")
    log_step "Running: canon docs list"
    bun "$PROJECT_ROOT/src/cli.ts" docs list
    log_step "Running: canon docs list --json | jq '.docs[0] | keys'"
    bun "$PROJECT_ROOT/src/cli.ts" docs list --json | jq '.docs[0] | keys'
    log_info "Expect keys: category, description, name, target"
    log_info "Expect docs topics: agents, ai-workflow, projects"
    log_info "Expect ai-workflow at target docs/workflow/ai-workflow.md, listed from one level down"
    log_info "Expect projects at target docs/target/projects.md, listed from one level down"
    log_info "Expect no workflow topic: the folder index declares no target-facing category"
    log_info "Expect agents by folder name, described by its index subtitle"
    log_info "Expect domain context topics: tooling, governance, standards"
    log_info "Expect no toolkit-internal topics: ci, development, sandbox"
    ;;
  "get")
    log_step "Running: canon docs agents"
    agents_doc=$(bun "$PROJECT_ROOT/src/cli.ts" docs agents)
    head -5 <<<"$agents_doc"
    log_info "Expect the agents folder index on stdout, frontmatter stripped"
    log_step "Running: canon docs tooling"
    tooling_doc=$(bun "$PROJECT_ROOT/src/cli.ts" docs tooling)
    head -5 <<<"$tooling_doc"
    log_info "Expect the tooling doc resolved from canon/context/, not docs/"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
