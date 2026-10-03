#!/usr/bin/env bash
set -e
set -o pipefail

# No project copy of the corpus, which is what every target looks like now. The
# absence forces `review-branch` onto the
# `${CLAUDE_SKILL_DIR}/../../standards/skill.md` fallback, and the branch name
# below turns that citation into a report filename a reader can check by eye.
# `expect.toml` carries that claim as a manual entry rather than an assertion,
# because the report lands at a root no run determines. An arm that staged a copy
# of its own resolves the project path instead and stops being about the fallback
# at all, so the declaration asserts the absence to make that edit go red rather
# than pass quietly.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  # `src/api/session.ts` lands on `main` clean so the branch can dirty it without
  # staging. A file first written on the branch would sit in the committed half
  # as well, and the unstaged assertion could then pass on either half.
  stage_fixtures claude review-branch shared 01-trunk

  git add . && git commit -m "feat(api): initial user endpoint" --no-verify -q

  git checkout -b feat/user-batch -q

  stage_fixtures claude review-branch shared 02-batch

  git add . && git commit -m "feat(api): add batch user fetch and merge" --no-verify -q

  # The three writes below leave the branch carrying one half apiece, which is
  # what the selection rule has to read in a single range. Committing them, or
  # staging all three, collapses the arm back onto the one half it covered when
  # Step 2 chose between the staged set and the branch set.
  stage_fixtures claude review-branch shared 03-staged

  git add src/api/orders.ts

  stage_fixtures claude review-branch shared 04-unstaged

  log_step "Scenario ready: review with known bugs"
  log_info "Context: feat/user-batch branch carrying one bug in each of four halves."
  log_info "  committed  src/api/users.ts"
  log_info "    1. Off-by-one in getUsers loop (i <= ids.length)"
  log_info "    2. No error handling on fetch response"
  log_info "    3. mergeUser mutates the base object"
  log_info "  staged     src/api/orders.ts"
  log_info "    4. cancelOrder returns true on a failed request"
  log_info "  unstaged   src/api/session.ts"
  log_info "    5. readToken logs the credential it resolved"
  log_info "  untracked  src/api/cache.ts"
  log_info "    6. recall never reads expires, so an entry never expires"
  log_info ""
  log_info "A report naming only src/api/users.ts read the committed half alone."
  log_info ""
  log_info "This arm also checks the standards citation, not the skill alone."
  log_info "  .claude/standards/ is absent, so the skill must reach the plugin copy"
  log_info "  the slug transform lives only in standards/skill.md, never in the skill body"
  log_info "  so branch-user-batch.md is evidence the fallback resolved"
  log_info "  read that filename yourself, the checker cannot assert it yet"
  log_info ""
  log_info "Action:  /canon:review-branch"
  log_info "Expect:  declared in fixtures/claude/review-branch/expect.toml"
  log_info "         Check it with: canon sandbox check claude:review-branch"
  log_info "         One content entry per half. Three claims need a reader."
}
