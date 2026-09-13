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

seed_base_tree() {
  find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

  printf 'node_modules\n.canon/plans/\n.canon/review/\n.canon/memory/\n.canon/tmp/\n' >.gitignore

  cat <<'EOF' >package.json
{
  "name": "sandbox-address-review",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "bash scripts/regen-index.sh && echo 'lint ok' && echo 'typecheck ok'"
  }
}
EOF

  cat <<'EOF' >CLAUDE.md
# My App

Task API. Route handlers live in `src/`.

## Commands

- `bun run check`: regenerate `canon/context/index.md`, then lint and typecheck

## Indexes

- Never hand-edit `canon/context/index.md`. `bun run check` regenerates it from sibling frontmatter.
EOF

  mkdir -p scripts
  cat <<'EOF' >scripts/regen-index.sh
#!/usr/bin/env bash
set -e

out="canon/context/index.md"

{
  printf -- '---\ntitle: Context\ndescription: Per-domain narrative loaded on demand\n---\n\n# Context\n\n'
  for entry in canon/context/*.md; do
    if [ "$entry" = "$out" ]; then
      continue
    fi
    title=$(grep -m1 '^title: ' "$entry" | cut -d' ' -f2-)
    description=$(grep -m1 '^description: ' "$entry" | cut -d' ' -f2-)
    printf -- '- [%s](%s): %s\n' "$title" "$(basename "$entry")" "$description"
  done
} >"$out"
EOF

  mkdir -p src
  cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}
EOF

  mkdir -p canon/context
  cat <<'EOF' >canon/context/api.md
---
title: API
description: Task creation endpoint and handlers in src/tasks.ts
---

# API

Route handlers live in `src/tasks.ts`. `handleCreate` builds a task from the request body and returns it. No input validation runs before creation.
EOF

  bash scripts/regen-index.sh
}

start_feature_branch() {
  git push origin --delete feat/create-endpoint -q 2>/dev/null || true
  git checkout -b feat/create-endpoint -q

  cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  return createTask(body.title);
}
EOF

  git add . && git commit -m "feat(api): add create handler" --no-verify -q
}

open_pull_request() {
  local body="${1:-Adds the POST /tasks handler for v0.1.}"

  git push --force origin HEAD -q

  pr_url=$(gh pr create --draft --title "feat(api): add create handler" \
    --body "$body" --head feat/create-endpoint --base main 2>/dev/null ||
    gh pr view feat/create-endpoint --json url -q .url 2>/dev/null)

  # Seed a review finding the worker must address.
  gh pr review "$pr_url" --comment \
    --body "1 should-fix. src/tasks.ts: handleCreate does not reject an empty title. Add a guard before createTask." ||
    log_info "Could not seed review; post one manually before testing."
}

stage_setup() {
  log_info "findings  : open PR with one should-fix finding, branch still merges"
  log_info "stale     : same PR, plus a sibling merged into main the branch conflicts with"
  log_info "body-sync : same PR, the fix invalidates a claim the body itself makes"
  log_info "stale-head: same PR, a commit pushed after it opened, so the object's head trails the tip"

  select_or_route_scenario "Which scenario?" "findings" "stale" "body-sync" "stale-head"

  log_step "Configuring address-review environment ($ANCHOR_REPO)"

  configure_sandbox_anchor_remote

  seed_base_tree

  git add . && git commit --allow-empty -m "feat(api): task list endpoint" --no-verify -q
  git push --force origin HEAD:main

  base_commit=$(git rev-parse HEAD)

  case "$SELECTED_OPTION" in
  "findings")
    start_feature_branch
    open_pull_request

    log_step "Scenario ready: worker addresses a posted PR review"
    log_info "Context: open PR on feat/create-endpoint with one should-fix review finding posted"
    log_info "Action:  /review-address"
    log_info "Expect:  reads the finding, adds the empty-title guard, verify passes"
    log_info "         refreshes the now-stale canon/context/api.md validation line"
    log_info "         pushes a follow-up commit, then posts a summary reply comment, does NOT merge"
    log_info "         once CI goes green, edits that reply in place for the closing confirmation"
    log_info "         rather than posting it as a second comment"
    ;;
  "stale")
    start_feature_branch

    cat <<'EOF' >canon/context/handlers.md
---
title: Handlers
description: Request shape each route handler in src/tasks.ts accepts
---

# Handlers

`handleCreate` takes a body carrying a `title` and returns the created task.
EOF

    bash scripts/regen-index.sh

    cat <<'EOF' >canon/context/api.md
---
title: API
description: Task creation endpoint and handlers in src/tasks.ts
---

# API

Route handlers live in `src/tasks.ts`. `handleCreate` builds a task from the request body and returns it, under the request shape described in `handlers.md`. No input validation runs before creation.
EOF

    git add . && git commit -m "docs(context): record the handler request shape" --no-verify -q

    open_pull_request

    # The sibling lands on main after the PR opens, which is what makes the branch stale.
    git checkout -q -B sibling "$base_commit"

    cat <<'EOF' >canon/context/limits.md
---
title: Limits
description: Per-client request ceiling the task endpoints enforce
---

# Limits

The task endpoints cap a client at 100 requests per minute.
EOF

    bash scripts/regen-index.sh

    cat <<'EOF' >canon/context/api.md
---
title: API
description: Task creation endpoint and handlers in src/tasks.ts
---

# API

Route handlers live in `src/tasks.ts`. `handleCreate` builds a task from the request body and returns it, behind the rate limiter described in `limits.md`. No input validation runs before creation.
EOF

    git add . && git commit -m "feat(api): rate limit the task endpoints" --no-verify -q
    git push --force origin HEAD:main
    git checkout feat/create-endpoint -q

    log_step "Scenario ready: worker rebases a branch that went stale during review"
    log_info "Context: open PR on feat/create-endpoint with one should-fix review finding posted"
    log_info "  A sibling landed on main after the PR opened, touching the same two files"
    log_info "  canon/context/api.md conflicts and both sides are content worth keeping"
    log_info "  canon/context/index.md conflicts and bun run check rebuilds it"
    log_info ""
    log_info "Action:  /review-address"
    log_info "Expect:  addresses the finding first, then detects the branch no longer merges"
    log_info "         rebases onto origin/main rather than merging main into the branch"
    log_info "         keeps both the handler and rate-limit sentences in api.md"
    log_info "         leaves index.md to bun run check, which lists api, handlers, and limits"
    log_info "         force-pushes once and names the rebase in the reply comment"
    ;;
  "body-sync")
    start_feature_branch

    stale_body=$(
      cat <<'BODY'
## Summary

Adds the POST /tasks handler for v0.1, taking any title with no validation.

## Testing

- [x] `bun run check` passes.
BODY
    )

    open_pull_request "$stale_body"

    log_step "Scenario ready: the review fix invalidates the PR body's own claim"
    log_info "Context: open PR body says the handler takes any title with no validation"
    log_info "  the posted finding asks for exactly the guard that claim says does not exist"
    log_info "Action:  /review-address"
    log_info "Expect:  adds the empty-title guard, verify passes"
    log_info "         git-followup syncs the PR body so it no longer claims no validation runs"
    log_info "         pushes a follow-up commit, then posts a summary reply comment, does NOT merge"
    ;;
  "stale-head")
    start_feature_branch
    open_pull_request

    object_head=$(git rev-parse HEAD)

    # A second commit pushed after the pull request opened. The object keeps
    # naming the commit it was created against for up to a minute, which is the
    # window every head-sensitive read here has to survive.
    cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  return createTask(body.title);
}

export function handleList() {
  return [];
}
EOF

    git add . && git commit -m "feat(api): add list handler" --no-verify -q
    git push --force origin HEAD -q

    log_step "Scenario ready: the pull request object's head trails the branch tip"
    log_info "Context: open PR on feat/create-endpoint with one should-fix review finding posted"
    log_info "  a second commit was pushed after the PR opened"
    log_info "  the object was created against $object_head and the remote now carries $(git rev-parse HEAD)"
    log_info ""
    log_info "Action:  /review-address"
    log_info "Expect:  reads CI with canon pr checks --json rather than gh pr checks"
    log_info "         the record's tip is the remote's head, not the object's headRefOid"
    log_info "         reports pending while the runs read belong to a different sha"
    log_info "         does NOT claim CI green off a run that belongs to the earlier commit"
    ;;
  esac
}
