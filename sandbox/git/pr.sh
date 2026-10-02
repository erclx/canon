#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_anchor() {
  use_sandbox_anchor
}

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "feature-branch" "reused-name" "draft-guard"

  case "$SELECTED_OPTION" in
  "feature-branch")
    log_step "Configuring PR environment ($ANCHOR_REPO)"

    configure_sandbox_anchor_remote
    git push --force origin HEAD:main
    git push origin --delete feature/string-utils -q 2>/dev/null || true

    git checkout -b feature/string-utils -q

    cat <<'EOF' >>utils.js
export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
EOF

    git add utils.js
    git commit -m "feat(utils): add capitalize helper" -q

    log_step "Scenario ready: feature branch"
    log_info "Context: branch 'feature/string-utils' with un-pushed commits"
    log_info "Action:  /canon:git-pr"
    log_info "Expect:  agent renames branch -> pushes -> opens PR"
    ;;
  "reused-name")
    log_step "Configuring PR environment ($ANCHOR_REPO)"

    configure_sandbox_anchor_remote
    # `git init` runs without `-b`, so the baseline branch follows the machine's
    # init.defaultBranch. This arm returns to it by name, so it has to be main.
    git branch -M main
    git push --force origin HEAD:main -q
    git push origin --delete feat/slugify -q 2>/dev/null || true
    gh pr list --head feat/slugify --state open --json number -q '.[].number' 2>/dev/null |
      xargs -r -I {} gh pr close {} -d -c "scenario reset" >/dev/null 2>&1 || true

    git checkout -b feat/slugify -q

    cat <<'EOF' >>utils.js
export function slugify(text) {
  return text.toLowerCase().replace(/\s+/g, "-");
}
EOF

    git add utils.js
    git commit -m "feat(utils): add slugify helper" -q
    git push -u origin feat/slugify -q

    # The arm closes rather than merges. `gh pr view` resolves by head branch and
    # ignores state, so a closed pull request drives the same lookup a merged one
    # does, without depending on the anchor repo permitting a squash merge.
    stale_pr=$(gh pr create \
      --title "feat(utils): add slugify helper" \
      --body "Adds slugify helper to utils." \
      --head feat/slugify \
      --base main | grep -oE '[0-9]+$')

    # `-d` deletes the branch and switches back to main itself, so the checkout is
    # a no-op on current gh and the delete finds nothing left to remove. Both stay
    # tolerant rather than assuming which half gh already did.
    gh pr close "$stale_pr" -d -c "closed to stage the reused name" >/dev/null

    git checkout main -q
    git branch -D feat/slugify >/dev/null 2>&1 || true
    git reset --hard origin/main -q

    git checkout -b feat/slugify -q

    cat <<'EOF' >>utils.js
export function truncate(text, max) {
  return text.length > max ? text.slice(0, max) : text;
}
EOF

    git add utils.js
    git commit -m "feat(utils): add truncate helper" -q

    log_step "Scenario ready: branch name reused after a non-open PR"
    log_info "Context: PR #$stale_pr sits closed on 'feat/slugify', the name now carries unrelated truncate() work"
    log_info "Action:  /canon:git-pr"
    log_info "Expect:  agent opens a NEW pull request. PR #$stale_pr keeps its original title and body"
    ;;
  "draft-guard")
    git checkout -b draft/init -q

    touch feature.js
    git add feature.js
    git commit -m "feat: work in progress" -q

    log_step "Scenario ready: draft/init guard"
    log_info "Context: user forgot to run /git:branch before /git:pr"
    log_info "Action:  /canon:git-pr"
    log_info "Expect:  guard warning. Branch looks unset, run /git:branch first"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
