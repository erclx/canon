#!/usr/bin/env bash
set -e
set -o pipefail

# No project copy of the corpus, for the same reason `claude/review-branch.sh` carries
# none. The absent project copy forces `ui-checklist` onto the
# `${CLAUDE_SKILL_DIR}/../../standards/skill.md` fallback, and the branch name
# below turns that citation into a checklist filename `expect.toml` asserts by
# exact path. It sat in `manual` while the skill could correctly write no
# checklist at all, which is the escape the shrink closed: the checklist is the
# skill's whole output now, so a run producing none has produced nothing.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude ui-checklist shared 01-initial

  git add . && git commit -m "feat(ui): task list" --no-verify -q

  git checkout -b feat/task-filter -q

  # The diff the skill classifies. `TaskList` gains an empty state, a loading
  # state, a filter input, and a link to an archive route. The states belong to a
  # component test and the route change to an end to end spec, which is the
  # routing this arm asserts. A spacing and color change is the visual half. All
  # three kinds have to be present or the skill takes its all-automatable branch
  # and writes no checklist, which is the file the fallback claim is about.
  #
  # The input stays mounted alongside the empty state. Returning the paragraph
  # alone would unmount it and strand a user who filtered to no matches with no
  # way to clear the filter, and a skill reading that diff reviews the fixture's
  # own defect instead of the change under test.
  stage_fixtures claude ui-checklist shared 02-task-filter

  git add . && git commit -m "feat(ui): filter tasks and handle the empty state" --no-verify -q

  log_step "Scenario ready: UI change with an automatable and a visual half"
  log_info "Context: feat/task-filter, one commit ahead of main"
  log_info "  component   : loading state, empty state, list count after filtering"
  log_info "  end to end  : the route change to /archive"
  log_info "  visual only : 12px gap, 16px padding, muted empty-state color"
  log_info ""
  log_info "This arm also checks the standards citation, not the skill alone."
  log_info "  .claude/standards/ is absent, so the skill must reach the plugin copy"
  log_info "  the slug transform lives only in standards/skill.md, never in the skill body"
  log_info "  so .canon/tmp/handoff/ui-checklist/task-filter.md is evidence it resolved"
  log_info "  expect.toml asserts that exact path, so the checker reads it for you"
  log_info ""
  log_info "The Playwright and vitest scaffold stays in the fixture on purpose."
  log_info "The skill writes no test now, so a run that installs a runner or adds"
  log_info "a spec has gone past its job. The write scope is what catches that:"
  log_info "e2e/ and the component test glob are outside it, so either write"
  log_info "reports as a violation rather than as coverage."
  log_info ""
  log_info "Action:  /canon:ui-checklist I added a filter input, a loading state, an empty state, and a link to the archive route to TaskList, and restyled its spacing"
  log_info "Expect:  declared in fixtures/claude/ui-checklist/expect.toml"
  log_info "         Check it with: canon sandbox check claude:ui-checklist"
}
