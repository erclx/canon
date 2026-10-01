#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  mkdir -p install
  touch install/.gitkeep

  # A standard this project authored at its own root. Nothing installs the
  # toolkit corpus into a target any more, so the root folder is the only
  # project spelling left and the arm below reads past it to the package copy.
  mkdir -p authored/standards
  printf -- '---\ntitle: Project own\ndescription: A standard this project authored\n---\n\n# Project own\n' \
    >"authored/standards/project-own.md"

  git add .
  git commit -m "chore(sandbox): scaffold standards test directories" --no-verify -q

  log_step "Standards sandbox"
  log_info "list     : read-only catalog dump, no target needed"
  log_info "read     : resolves one standard from install/, where the project"
  log_info "           spelling does not exist, so only the package corpus can answer"
  log_info "authored/: a project-authored standard at the root the resolver reads first"

  select_or_route_scenario "Which scenario?" "list" "read"

  case "$SELECTED_OPTION" in
  "read")
    # Run from `install/` rather than from the sandbox root. The root carries
    # `authored/standards/`, and a reader checking the premise by eye would have
    # to know the resolve never walks upward to tell the two apart.
    #
    # Both streams land on disk because `canon sandbox check` reads the tree and
    # nothing else. The frame carries the root that answered and the body carries
    # the document, so splitting them is what lets the arm assert the resolve
    # separately from the read.
    # The status is held rather than left to `set -e`. A miss writes its warning
    # and the whole catalog to the log file, so an abort here would kill the
    # scenario with the one diagnostic the command produced sitting unread.
    log_step "Running: canon standards skill (from install/, which holds none)"
    local read_status=0
    (
      cd install
      bun "$PROJECT_ROOT/src/cli.ts" standards skill \
        >read-body.md 2>read-frame.log
    ) || read_status=$?
    cat install/read-frame.log >&2
    [ "$read_status" -eq 0 ] || log_error "The read exited $read_status. The frame above says why."
    log_info "install/read-frame.log names the root that answered"
    log_info "install/read-body.md  is the document that root returned"
    log_info "Expect: declared in fixtures/infra/standards/read/expect.toml"
    log_info "        Check it with: canon sandbox check infra:standards read"
    ;;
  "list")
    log_step "Running: canon standards list"
    bun "$PROJECT_ROOT/src/cli.ts" standards list
    log_step "Running: canon standards list --json | jq '.standards[0] | keys'"
    bun "$PROJECT_ROOT/src/cli.ts" standards list --json | jq '.standards[0] | keys'
    log_info "Expect keys: appliesTo, content, description, name, source"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
