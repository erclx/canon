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
  select_or_route_scenario "Which scenario?" "open-pr" "review-comment" "no-pr-guard" "main-guard"

  configure_sandbox_anchor_remote
  git branch -M main

  git push --force origin HEAD:main -q
  git push origin --delete feat/utils-followup -q 2>/dev/null || true
  gh pr list --head feat/utils-followup --state open --json number -q '.[].number' 2>/dev/null |
    xargs -r -I {} gh pr close {} -d -c "scenario reset" >/dev/null 2>&1 || true

  case "$SELECTED_OPTION" in
  "open-pr")
    git checkout -b feat/utils-followup -q

    cat <<'EOF' >>utils.js

export function lowercase(text) {
  return text.toLowerCase();
}
EOF
    git add utils.js && git commit -m "feat(utils): add lowercase helper" -q
    git push -u origin feat/utils-followup -q

    gh pr create \
      --title "feat(utils): add lowercase helper" \
      --body "Adds lowercase helper to utils." \
      --head feat/utils-followup \
      --base main >/dev/null

    cat <<'EOF' >>utils.js

export function trim(text) {
  return text.trim();
}
EOF

    log_step "Scenario ready: open PR with one followup edit"
    log_info "Context: feat/utils-followup tracks origin, PR open, unstaged trim() addition"
    log_info "Action:  /git-followup"
    log_info "Expect:  stage -> commit -> push -> PR body updated to mention trim helper"
    ;;
  "review-comment")
    git checkout -b feat/utils-followup -q

    cat <<'EOF' >>utils.js

export function lowercase(text) {
  return text.toLowerCase();
}
EOF
    git add utils.js && git commit -m "feat(utils): add lowercase helper" -q
    git push -u origin feat/utils-followup -q

    pr_number=$(gh pr create \
      --title "feat(utils): add lowercase helper" \
      --body "Adds lowercase helper to utils." \
      --head feat/utils-followup \
      --base main | grep -oE '[0-9]+$')

    review_line=$(grep -n 'toLowerCase' utils.js | head -1 | cut -d: -f1)
    gh api "repos/{owner}/{repo}/pulls/${pr_number}/comments" \
      -f body="Guard against a null argument here." \
      -f commit_id="$(git rev-parse HEAD)" \
      -f path="utils.js" \
      -F line="$review_line" \
      -f side="RIGHT" >/dev/null

    cat <<'EOF' >>utils.js

export function lowercaseSafe(text) {
  return text?.toLowerCase() ?? "";
}
EOF

    log_step "Scenario ready: open PR with a review comment and an unstaged fix"
    log_info "Context: feat/utils-followup tracks origin, PR open with one review comment, unstaged null-guard addition"
    log_info "Action:  /git-followup"
    log_info "Expect:  stage -> commit -> push -> reply comment posted on the PR"
    ;;
  "no-pr-guard")
    git checkout -b feat/utils-followup -q
    git commit --allow-empty -m "chore: bootstrap branch" -q
    git push -u origin feat/utils-followup -q
    echo "// followup" >>utils.js

    log_step "Scenario ready: branch tracks origin but no open PR"
    log_info "Context: feat/utils-followup pushed, no PR opened, unstaged edit"
    log_info "Action:  /git-followup"
    log_info "Expect:  no-PR guard fires, suggests git-ship instead"
    ;;
  "main-guard")
    echo "// stray edit" >>utils.js

    log_step "Scenario ready: changes on main"
    log_info "Context: user is on main with unstaged changes"
    log_info "Action:  /git-followup"
    log_info "Expect:  guard fires, refuses to ship from main"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
