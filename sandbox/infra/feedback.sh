#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  mkdir -p install
  touch install/.gitkeep

  git add .
  git commit -m "chore(sandbox): scaffold feedback test directory" --no-verify -q

  log_step "Feedback sandbox"
  log_info "refusal: pipes a report missing its Proposed fix section and asserts"
  log_info "         the command names that field and writes nothing"

  select_or_route_scenario "Which scenario?" "refusal"

  case "$SELECTED_OPTION" in
  "refusal")
    # The one arm this command can assert. A report that passes validation
    # writes into the toolkit's own `.canon/feedback/`, which sits
    # outside the tree the snapshot covers, and `run.sh` reports that as an
    # escape. A refusal writes nowhere at all, so the whole behavior lands
    # inside the sandbox.
    #
    # Both streams go to disk because `canon sandbox check` reads the tree and
    # nothing else. The status is held rather than left to `set -e`, since a
    # refusal exits 1 by design and an abort here would kill the scenario on
    # the outcome it exists to record.
    log_step "Running: canon feedback (report missing its Proposed fix section)"
    local refusal_status=0
    (
      cd install
      cat <<'REPORT' | bun "$PROJECT_ROOT/src/cli.ts" feedback \
        >refusal-stdout.log 2>refusal.log
## Toolkit feedback

### From project

a sandbox arm

### Surface

CLI, canon feedback

### Observed

A report missing a required field was written to disk anyway.

### Expected

The command refuses and names the field.

### Repro

Pipe this block to canon feedback.
REPORT
    ) || refusal_status=$?
    printf '%s\n' "$refusal_status" >install/refusal-status.txt
    # Byte count rather than the stream, because an assertion cannot pattern
    # match an empty file and a refusal that printed a path is the failure this
    # arm is watching for.
    wc -c <install/refusal-stdout.log | tr -d ' ' >install/refusal-stdout-bytes.txt
    cat install/refusal.log >&2
    log_info "install/refusal.log        carries the refusal and the field it named"
    log_info "install/refusal-status.txt carries the exit status"
    log_info "Expect: declared in fixtures/infra/feedback/refusal/expect.toml"
    log_info "        Check it with: canon sandbox check infra:feedback refusal"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
