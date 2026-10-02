#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_stats() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-build-in-slices",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test"
  }
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Text stats

Run `bun test` to verify.
EOF

  mkdir -p src

  # Two behaviors, so a run that builds both in one pass leaves one commit
  # where the skill asks for at least two.
  cat <<'EOF' >PLAN.md
# Plan: text stats

Add `src/stats.ts` with two functions and a test for each.

1. `wordCount(text: string): number` counts runs of non-space characters.
2. `lineCount(text: string): number` counts lines, where an empty string has zero.

Files to touch: `src/stats.ts`, `src/stats.test.ts`.
EOF

  # The out-of-scope defect. `legacyPad` is exported and imported nowhere, in
  # a file the plan does not name, so a run that removes it widened the branch.
  cat <<'EOF' >src/format.ts
export function pad(value: string, width: number): string {
  return value.padStart(width, ' ')
}

export function legacyPad(value: string): string {
  return '  ' + value
}
EOF

  cat <<'EOF' >src/format.test.ts
import { expect, test } from 'bun:test'
import { pad } from './format'

test('pads to the width', () => {
  expect(pad('a', 3)).toBe('  a')
})
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "stats"
  case "$SELECTED_OPTION" in
  "stats")
    stage_stats
    git add .
    git commit -m "feat(format): pad values for display" --no-verify -q

    log_step "Scenario ready: a two-behavior plan beside an unused export"
    log_info "Context: PLAN.md asks for wordCount and lineCount in src/stats.ts."
    log_info "         src/format.ts exports legacyPad, which nothing imports."
    log_info "Action:  /canon:build-in-slices Build PLAN.md on this branch."
    log_info "Expect:  at least two new commits, src/format.ts unchanged, and"
    log_info "         legacyPad named in the reply as noticed, not fixed."
    log_info "         Declared in fixtures/claude/build-in-slices/stats/expect.toml."
    log_info "         Check it with: canon sandbox check claude:build-in-slices stats"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
