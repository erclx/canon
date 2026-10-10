#!/usr/bin/env bash
set -e
set -o pipefail

# Four planted defects. The script now fetches and runs an unpinned package at
# release time, so whoever publishes that package's next version runs code on
# the release machine. The body before `review-craft` caught that under its
# one-word security axis, and caught an `eval` draft of it too, so it guards a
# floor rather than discriminating. The README's Usage section is edited on the
# branch while its Safety
# section, two headings further down, still claims the dirty-tree refusal the
# same diff deletes. A review reading only the changed hunks misses it, since
# the stale claim sits outside every hunk. The branch also edits
# `scripts/check.sh` to leave the changed script out of its `shellcheck` run
# and states no reason, which lowers the bar the change has to clear rather
# than meeting it. The body before the guard-the-bar axis caught that too, so
# it is a floor as well. A fourth defect is an upgrade: one commit bumps a
# dependency across a major version and a second one alongside it, and the
# lockfile diff adds a transitive package the manifest never names, carrying an
# install script. The body without a dependency reference caught it, so it is a
# floor as well.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_trunk() {
  stage_fixtures claude review-craft shared 01-trunk
}

stage_branch() {
  stage_fixtures claude review-craft shared 02-branch
}

stage_setup() {
  stage_trunk
  git add . && git commit -m "feat(release): tag and push a version" --no-verify -q

  git checkout -b feat/release-tag -q
  stage_branch
  git add . && git commit -m "feat(release): generate release notes" --no-verify -q

  log_step "Scenario ready: a branch carrying four defects outside the old axis list"
  log_info "Context: feat/release-tag generates release notes in scripts/release.sh."
  log_info "  1. The notes come from npx -y <pkg>@latest, an unpinned package"
  log_info "     fetched and run on the release machine on every release"
  log_info "  2. The dirty-tree refusal is gone, while README.md's Safety section,"
  log_info "     two headings below the edited Usage hunk, still promises it"
  log_info "  3. DRY_RUN is read into dry_run and never used, which nobody asked for"
  log_info "  4. scripts/check.sh now leaves release.sh out of its shellcheck run,"
  log_info "     with no reason stated anywhere in the diff"
  log_info "  5. package.json bumps tag-formatter across a major version and"
  log_info "     range-parser in the same commit with no changelog read, and the"
  log_info "     lockfile adds color-shim, which the manifest never names and"
  log_info "     which carries an install script"
  log_info ""
  log_info "Action:  review the changes on this branch, writing one graded finding per line as"
  log_info "         '- **critical|should-fix|minor**: ...' under a heading per file to"
  log_info "         .canon/review/branch-release-tag.md"
  log_info "Expect:  declared in fixtures/claude/review-craft/expect.toml"
  log_info "         Check it with: canon sandbox check claude:review-craft"
}
