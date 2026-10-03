#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  stage_fixtures claude ux-measure shared 01-initial

  git add . && git commit -m "feat(ui): task list served by vite preview" --no-verify -q

  log_step "Scenario ready: runtime measurement with a detectable harness"
  log_info "Context: Vite/React app carrying a preview command, a documented port, and Playwright"
  log_info "Seeded so detection has one answer:"
  log_info "  playwright.config.ts and @playwright/test make Playwright the harness found"
  log_info "  preview on 4173 is production-shaped, dev on 5173 is not"
  log_info "  TaskList.tsx fills its list after 400ms above an unsized banner,"
  log_info "  so the banner is pushed down and the layout reading is non-zero"
  log_info "Before:  bun install, then bunx playwright install chromium. Neither is seeded,"
  log_info "         since a sandbox provisions files and cannot fetch a browser."
  log_info "Action:  /ux-measure"
  log_info "Expect:  Playwright named as the harness, a median per metric beside its threshold,"
  log_info "         a Shifted line naming the banner img the seeded shift moves,"
  log_info "         taken off the run that produced the median rather than merged across three,"
  log_info "         and a reading written to .canon/review/ux-measure-<slug>.md"
  log_info "Second arm: delete playwright.config.ts and the two Playwright entries in package.json,"
  log_info "         re-run, and expect a statement of what the measurement needs rather than a failure"
}
