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
  "name": "sandbox-test-first",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test"
  }
}
EOF

  mkdir -p src

  # One function with the test that covers it, both already committed. The
  # pairing convention is the one the loop reads: a subject at `foo.ts` takes
  # its test at `foo.test.ts` beside it. Seeding the pair rather than
  # describing it leaves the run a shape to copy instead of a rule to recall.
  cat <<'EOF' >src/index.ts
export function greet(name: string): string {
  return `Hello, ${name}!`
}
EOF

  cat <<'EOF' >src/index.test.ts
import { describe, expect, it } from 'bun:test'

import { greet } from './index'

describe('greet', () => {
  it('should address the name it was given', () => {
    expect(greet('Ada')).toBe('Hello, Ada!')
  })
})
EOF

  git add .
  git commit -m "feat(greeting): add the greet helper and its test" --no-verify -q

  log_step "Scenario ready: a paired function and test, with a sibling function still to write"
  log_info "Context: src/index.ts carries greet with src/index.test.ts beside it, committed."
  log_info "         Nothing covers the farewell function the prompt asks for, so the test"
  log_info "         for it has to be written before the code that satisfies it."
  log_info "Action:  /canon:test-first, asking for a farewell function returning 'Goodbye, <name>!'"
  log_info "Expect:  canon:test-craft loaded at step 1 and the layer named as unit, since"
  log_info "         farewell is pure logic. Then a case added to src/index.test.ts naming"
  log_info "         what farewell proves, run once against the unchanged src/index.ts and"
  log_info "         read as failing for the missing export rather than for a typo or a bad"
  log_info "         import, then the smallest implementation, then the same test run green"
  log_info "         and the file's other case still passing, then a refactor pass with the"
  log_info "         suite re-run green after it."
  log_info "Read:    the ordering off the session's own turns, which means reading this arm"
  log_info "         interactively. The tree a correct run leaves and the tree a run that"
  log_info "         wrote both halves at once leaves are identical, and run.sh keeps the"
  log_info "         result rather than the turns, so a headless pass covers the artifact"
  log_info "         and says nothing about the order. A run reporting that it went red"
  log_info "         first is not evidence that it did."
  log_info "Driven:  twice on sonnet, at 8 and 9 turns and 0.16 dollars each, on 2026-09-07."
  log_info "         Both left the case, the smallest implementation, and greet still"
  log_info "         passing, and both claimed a red run that neither could be checked on."
  log_info "         Both runs predate the layer hop and the refactor step, so neither"
  log_info "         covers them."
}
