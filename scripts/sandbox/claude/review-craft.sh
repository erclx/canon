#!/usr/bin/env bash
set -e
set -o pipefail

# Three planted defects. The script now fetches and runs an unpinned package at
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
# it is a floor as well.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_trunk() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-review-craft",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Release tool

Shell helpers that tag and publish a release. Scripts live in `scripts/`.

## Commands

- `bash scripts/release.sh <version>`: tag the current commit and push the tag
- `bash scripts/check.sh`: lint every script before a commit
EOF

  mkdir -p scripts
  cat <<'EOF' >scripts/check.sh
#!/usr/bin/env bash
set -euo pipefail

shellcheck scripts/*.sh
EOF

  cat <<'EOF' >scripts/release.sh
#!/usr/bin/env bash
set -euo pipefail

version="$1"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

git tag -a "v$version" -m "Release $version"
git push origin "v$version"
EOF

  cat <<'EOF' >README.md
# Release tool

## Usage

Run `scripts/release.sh <version>` to tag the current commit and push the tag.

## Tags

Every tag is annotated and named `v<version>`.

## Safety

`release.sh` refuses to run while the working tree has uncommitted changes, so a
tag always points at work that is committed.
EOF
}

stage_branch() {
  cat <<'EOF' >scripts/check.sh
#!/usr/bin/env bash
set -euo pipefail

find scripts -name '*.sh' ! -name release.sh -exec shellcheck {} +
EOF

  cat <<'EOF' >scripts/release.sh
#!/usr/bin/env bash
set -euo pipefail

version="$1"
dry_run="${DRY_RUN:-0}"

previous="$(git describe --tags --abbrev=0)"
notes="$(npx -y release-notes-writer@latest --from "$previous")"

git tag -a "v$version" -m "Release $version" -m "$notes"
git push origin "v$version"
EOF

  cat <<'EOF' >README.md
# Release tool

## Usage

Run `scripts/release.sh <version>` to tag the current commit and push the tag.
The tag message carries release notes generated from the commits since the
previous tag.

## Tags

Every tag is annotated and named `v<version>`.

## Safety

`release.sh` refuses to run while the working tree has uncommitted changes, so a
tag always points at work that is committed.
EOF
}

stage_setup() {
  stage_trunk
  git add . && git commit -m "feat(release): tag and push a version" --no-verify -q

  git checkout -b feat/release-tag -q
  stage_branch
  git add . && git commit -m "feat(release): generate release notes" --no-verify -q

  log_step "Scenario ready: a branch carrying three defects outside the old axis list"
  log_info "Context: feat/release-tag generates release notes in scripts/release.sh."
  log_info "  1. The notes come from npx -y <pkg>@latest, an unpinned package"
  log_info "     fetched and run on the release machine on every release"
  log_info "  2. The dirty-tree refusal is gone, while README.md's Safety section,"
  log_info "     two headings below the edited Usage hunk, still promises it"
  log_info "  3. DRY_RUN is read into dry_run and never used, which nobody asked for"
  log_info "  4. scripts/check.sh now leaves release.sh out of its shellcheck run,"
  log_info "     with no reason stated anywhere in the diff"
  log_info ""
  log_info "Action:  /canon:review-branch"
  log_info "Expect:  declared in fixtures/claude/review-craft/expect.toml"
  log_info "         Check it with: canon sandbox check claude:review-craft"
}
