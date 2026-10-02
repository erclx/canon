#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

seed_source_tree() {
  mkdir -p src scripts

  cat <<'TS_ALPHA' >src/alpha.ts
/**
 * A doc block recording why this boundary exists.
 */
export function alpha(): void {}

// An inline comment holding a decision the code cannot carry.
export const RETRIES = 3

const endpoint = 'https://example.com//health'
TS_ALPHA

  cat <<'TS_BETA' >src/beta.ts
export function beta(value: number): number {
  return value * 2
}
TS_BETA

  cat <<'SH_PLAIN' >scripts/deploy.sh
#!/usr/bin/env bash
set -e

# The remote rejects a push older than the tag, so fetch first.
git fetch --tags
git push
SH_PLAIN
}

# The regression arm. Every `#` inside the heredoc below is a markdown heading
# in fixture data, and counting it as a bash comment is what turned a measured
# 112 comment lines into 427 during the comment-discipline track.
seed_heredoc_scenario() {
  mkdir -p scripts

  cat <<'SH_OUTER' >scripts/scenario.sh
#!/usr/bin/env bash
set -e

# One real comment, recording why the fixture is inline.
stage_setup() {
  cat <<'INNER' >README.md
# API Server

## Configuration

### Ports

# Still a heading, not a comment
INNER

  echo provisioned
}
SH_OUTER
}

seed_vocabulary_rule() {
  mkdir -p .claude/rules/core

  cat <<'RULE' >.claude/rules/core/090-comments.md
# Code comment standards

## Comments

- Comment what the code cannot say.

## Degradation vocabulary

- Markers: `FIXED`, `BUGFIX`, `HACK`, `XXX`, `TODO`, `FIXME`
- Prose: `previously`, `used to`, `workaround`

## Density

- Report density as an output. Do not set a target.
RULE
}

seed_degraded_source() {
  mkdir -p src

  cat <<'TS_DEGRADED' >src/orders.ts
// TODO: revisit once the queue lands
export function enqueue(): void {}

// This previously used a lock file, kept for the migration window.
export function drain(): void {}

const message = 'TODO: this sits in a string and must not count'
TS_DEGRADED
}

seed_history() {
  seed_source_tree
  git init -q
  configure_sandbox_git_identity
  git add . && git commit -q -m "chore: seed uncommented source"

  cat <<'TS_DOCUMENTED' >src/beta.ts
/**
 * Doubling is the contract the caller depends on, not an implementation
 * detail, so the block is here rather than at the call site.
 */
export function beta(value: number): number {
  return value * 2
}
TS_DOCUMENTED

  git add . && git commit -q -m "docs: document the beta contract"
}

stage_setup() {
  log_step "Comments sandbox"
  log_info "snapshot   : density by language and by comment kind"
  log_info "heredoc    : heredoc bodies are data, not bash comments"
  log_info "vocabulary : sweep reads its terms from an installed rule"
  log_info "skipped    : no rule means the sweep reports skipped, not clean"
  log_info "trend      : recomputes the series from git with no ledger"
  log_info "json       : machine record on stdout, frame still on stderr"

  select_or_route_scenario "Which scenario?" "snapshot" "heredoc" "vocabulary" "skipped" "trend" "json"

  case "$SELECTED_OPTION" in
  "snapshot")
    seed_source_tree
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: TypeScript 4 comment lines, 1 doc block, 1 inline"
    log_info "Expect: the https:// literal is not counted as a comment"
    ;;
  "heredoc")
    seed_heredoc_scenario
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: Bash 1 comment line, not 5"
    log_info "Expect: the shebang is excluded and heredoc lines leave the total"
    ;;
  "vocabulary")
    seed_vocabulary_rule
    seed_degraded_source
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: hits for TODO and previously, sourced from the rule"
    log_info "Expect: the TODO inside the string literal is not a hit"
    ;;
  "skipped")
    seed_degraded_source
    log_step "Running: canon comments scan"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan
    log_info "Expect: sweep reported skipped rather than zero hits"
    ;;
  "trend")
    seed_history
    log_step "Running: canon comments scan --since HEAD~1"
    bun "$PROJECT_ROOT/src/cli.ts" comments scan --since HEAD~1
    log_info "Expect: a two-point series with comment lines rising"
    log_info "Expect: no ledger file written anywhere in the tree"
    ;;
  "json")
    seed_source_tree
    log_step "Running: canon comments scan --json"
    exec bun "$PROJECT_ROOT/src/cli.ts" comments scan --json
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
