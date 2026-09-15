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

# Seeds the base repo, the feature branch, and the open PR both arms review.
# Sets PR_URL for callers that need to post to the thread.
seed_reviewable_pr() {
  configure_sandbox_anchor_remote

  find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

  printf 'node_modules\n.canon/plans/\n.canon/review/\n.canon/memory/\n.canon/tmp/\n' >.gitignore

  cat <<'EOF' >package.json
{
  "name": "sandbox-pr-review",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'lint ok' && echo 'typecheck ok'"
  }
}
EOF

  cat <<'EOF' >CLAUDE.md
# My App

Task API. Route handlers live in `src/`.

## Commands

- `bun run check`: lint and typecheck
EOF

  mkdir -p .claude
  cat <<'EOF' >canon/REQUIREMENTS.md
# Requirements

## MVP features

1. List tasks: GET /tasks returns all tasks
2. Create task: POST /tasks adds a task
EOF

  mkdir -p src
  cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}
EOF

  git add . && git commit --allow-empty -m "feat(api): task list endpoint" --no-verify -q
  git push --force origin HEAD:main

  git push origin --delete feat/create-endpoint -q 2>/dev/null || true
  git checkout -b feat/create-endpoint -q

  # Reviewable diff with a subtle defect: no validation, empty title accepted.
  cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  return createTask(body.title);
}
EOF

  git add . && git commit -m "feat(api): add create handler" --no-verify -q
  git push --force origin HEAD -q

  PR_URL=$(gh pr create --draft --title "feat(api): add create handler" \
    --body "Adds the POST /tasks handler for v0.1." --head feat/create-endpoint --base main 2>/dev/null ||
    gh pr view feat/create-endpoint --json url -q .url 2>/dev/null)
}

# Seeds a clean diff (the handler validates the title) so the only thing this
# pass has to report is the ## For the reviewer bullet, answered from the diff.
seed_reviewer_request_pr() {
  configure_sandbox_anchor_remote

  find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

  printf 'node_modules\n.canon/plans/\n.canon/review/\n.canon/memory/\n.canon/tmp/\n' >.gitignore

  cat <<'EOF' >package.json
{
  "name": "sandbox-pr-review",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'lint ok' && echo 'typecheck ok'"
  }
}
EOF

  cat <<'EOF' >CLAUDE.md
# My App

Task API. Route handlers live in `src/`.

## Commands

- `bun run check`: lint and typecheck
EOF

  mkdir -p .claude
  cat <<'EOF' >canon/REQUIREMENTS.md
# Requirements

## MVP features

1. List tasks: GET /tasks returns all tasks
2. Create task: POST /tasks adds a task
EOF

  mkdir -p src
  cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}
EOF

  git add . && git commit --allow-empty -m "feat(api): task list endpoint" --no-verify -q
  git push --force origin HEAD:main

  git push origin --delete feat/reviewer-request -q 2>/dev/null || true
  git checkout -b feat/reviewer-request -q

  cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title?: string } | undefined) {
  const title = body?.title?.trim() ?? "";
  if (!title) {
    throw new Error("title is required");
  }
  return createTask(title);
}
EOF

  git add . && git commit -m "feat(api): add create handler" --no-verify -q
  git push --force origin HEAD -q

  PR_URL=$(gh pr create --draft --title "feat(api): add create handler" \
    --body "Adds the POST /tasks handler for v0.1.

## For the reviewer

- Confirm handleCreate rejects a missing or empty title before it reaches createTask." \
    --head feat/reviewer-request --base main 2>/dev/null ||
    gh pr view feat/reviewer-request --json url -q .url 2>/dev/null)
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "first-pass" "close-out" "unchanged-head" "answered-head" "reviewer-request" "late-finding" "repeat-close-out" "marker-race"

  case "$SELECTED_OPTION" in
  "first-pass")
    log_step "Configuring pr-review environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    log_step "Scenario ready: PR review from an independent session"
    log_info "Context: open draft PR on feat/create-endpoint, project docs present"
    log_info "Action:  /review-pr"
    log_info "Expect:  reviews the PR diff against docs, posts findings to the PR via gh pr review --comment"
    log_info "         opens the comment with the ## Review heading"
    log_info "         writes the body to .canon/tmp/pr/review/body-<number>-<short-sha>.md"
    log_info "         flags the missing title validation, does NOT merge"
    ;;

  "close-out")
    log_step "Configuring pr-review close-out environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    # Seed the first pass against the pre-fix head, so its commit.oid bounds the delta.
    gh pr review "$PR_URL" --comment --body "## Review

0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **should-fix**: \`handleCreate\` does not reject an empty title, so a blank task is created. Guard the title before calling \`createTask\`.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the first pass. Post one manually before testing."

    # The worker's response: one commit, which is the entire delta the close-out reads.
    cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  if (!body.title.trim()) {
    throw new Error("title is required");
  }
  return createTask(body.title);
}
EOF

    git add . && git commit -m "fix(api): reject an empty task title" --no-verify -q
    git push origin HEAD -q

    log_step "Scenario ready: close-out on a PR that already carries a review"
    log_info "Context: open PR on feat/create-endpoint with a posted ## Review and one commit since"
    log_info "Action:  /review-pr"
    log_info "Expect:  finds the prior review's commit via gh pr view --json reviews"
    log_info "         reads only fix(api) reject an empty task title, not the whole change"
    log_info "         confirms the empty-title finding landed"
    log_info "         posts under ## Review closed, since the delta raises no findings of its own"
    log_info "         names the commit and the count read in the summary line"
    log_info "         writes a new body file rather than overwriting the first pass, does NOT merge"
    ;;

  "unchanged-head")
    log_step "Configuring pr-review unchanged-head environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    # A pass carrying a finding at any severity takes the open heading, so the
    # seed models the state a conforming minors-only pass leaves. Both headings
    # are in the family the next pass matches, so its commit.oid is still the
    # head that pass reads.
    gh pr review "$PR_URL" --comment --body "## Review

0 critical, 0 should-fix, 1 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **minor**: \`handleCreate\` returns the created task without a status field. Nothing consumes one yet.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the first pass. Post one manually before testing."

    # The worker accepts the minor as recorded, so nothing is committed and the head stays put.
    gh pr comment "$PR_URL" --body "## Review response

Accepted as recorded. No status field is added, since nothing consumes one and the shape is settled by v0.1.

🤖 Addressed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the response. Post one manually before testing."

    log_step "Scenario ready: a second pass at a head the first pass already covered"
    log_info "Context: open PR with a posted ## Review, a ## Review response, and no commit since"
    log_info "Action:  /review-pr"
    log_info "Expect:  finds the prior review's commit and sees it equal to headRefOid"
    log_info "         reads the ## Review response rather than a delta, which spans nothing"
    log_info "         names the body body-<number>-<short-sha>-r<comment-id>.md, id off the comment url"
    log_info "         posts under ## Review closed, treating the accepted minor as closed"
    log_info "         does NOT reuse the first pass name, invent a suffix, or merge"
    ;;

  "answered-head")
    log_step "Configuring pr-review answered-head environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    gh pr review "$PR_URL" --comment --body "## Review

0 critical, 0 should-fix, 1 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **minor**: \`handleCreate\` returns the created task without a status field. Nothing consumes one yet.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the first pass. Post one manually before testing."

    gh pr comment "$PR_URL" --body "## Review response

Accepted as recorded. No status field is added, since nothing consumes one and the shape is settled by v0.1.

🤖 Addressed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the response. Post one manually before testing."

    # The close-out the unchanged-head arm produces, so the newest pass post-dates
    # every response and the thread has nothing left to answer.
    gh pr review "$PR_URL" --comment --body "## Review closed

✅ Prior findings addressed. Re-reviewed the response, no commits since the prior pass.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the close-out. Post one manually before testing."

    log_step "Scenario ready: a re-run after a close-out already answered the thread"
    log_info "Context: open PR whose newest pass is ## Review closed, with no response after it"
    log_info "Action:  /review-pr"
    log_info "Expect:  sees the prior commit equal to headRefOid and scopes responses to the prior pass"
    log_info "         derives nothing, since every response pre-dates the close-out"
    log_info "         stops in Step 2, before reading a diff or writing a body, with"
    log_info "         'The head is unchanged since the prior pass', posting no comment"
    log_info "         does NOT reuse the close-out body name, re-derive its comment id, or post a second close-out"
    ;;

  "reviewer-request")
    log_step "Configuring pr-review reviewer-request environment ($ANCHOR_REPO)"
    seed_reviewer_request_pr

    log_step "Scenario ready: a body carrying ## For the reviewer, no other finding"
    log_info "Context: open draft PR on feat/reviewer-request, one confirmable bullet, clean diff"
    log_info "Action:  /review-pr"
    log_info "Expect:  reads ## For the reviewer bounded to its own bullets, answers it from the diff"
    log_info "         posts a **For the reviewer** block carrying the answer"
    log_info "         posts under ## Review closed, since the bullet is answered and nothing else is owed"
    log_info "         writes the body to .canon/tmp/pr/review/body-<number>-<short-sha>.md, does NOT merge"
    ;;

  "late-finding")
    log_step "Configuring pr-review late-finding environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    gh pr review "$PR_URL" --comment --body "## Review

0 critical, 0 should-fix, 1 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **minor**: \`handleCreate\` returns the created task without a status field. Nothing consumes one yet.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the first pass. Post one manually before testing."

    # A finding a worker produces after the close-out rather than in answer to
    # one already on the thread, with no commit behind it. The head stays put,
    # so this is what the widened reply-family query has to reach instead of
    # refusing ahead of it.
    gh pr comment "$PR_URL" --body "## Post-review findings

\`handleCreate\` also accepts a title of unbounded length, so nothing caps what reaches storage.

🤖 Addressed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the late finding. Post one manually before testing."

    log_step "Scenario ready: a late finding under a reply heading outside ## Review response"
    log_info "Context: open PR with a posted ## Review and a ## Post-review findings reply, no commit since"
    log_info "Action:  /review-pr"
    log_info "Expect:  finds the prior review's commit and sees it equal to headRefOid"
    log_info "         reads the ## Post-review findings comment rather than refusing in Step 2"
    log_info "         names the body body-<number>-<short-sha>-r<comment-id>.md, id off the comment url"
    log_info "         posts a review addressing the late finding rather than stopping with nothing to add"
    ;;

  "repeat-close-out")
    log_step "Configuring pr-review repeat-close-out environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    # The first pass, against the pre-fix head, so its commit.oid bounds the delta.
    gh pr review "$PR_URL" --comment --body "## Review

0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **should-fix**: \`handleCreate\` does not reject an empty title, so a blank task is created. Guard the title before calling \`createTask\`.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the first pass. Post one manually before testing."

    cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  if (!body.title.trim()) {
    throw new Error("title is required");
  }
  return createTask(body.title);
}
EOF

    git add . && git commit -m "fix(api): reject an empty task title" --no-verify -q
    git push origin HEAD -q

    # The standing verdict. Posting it here rather than after the next commit is
    # what pins its commit.oid to this head, which is the state the guard reads
    # back and the field a PUT rewrite cannot move.
    CLOSED_SHA=$(git rev-parse --short HEAD)
    gh pr review "$PR_URL" --comment --body "## Review closed

✅ Prior findings addressed. Re-reviewed $CLOSED_SHA, 1 commit since the prior pass.

🤖 Reviewed by Claude Code" 2>/dev/null ||
      log_info "Could not seed the close-out. Post one manually before testing."

    # The producing shape, written out. The close-out above left nothing owed,
    # the author makes a change that was their own call, and the delta reaching
    # the next pass has nothing to say by construction. A conforming pass has to
    # rewrite the standing close-out rather than post a second one beside it.
    cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  const title = body.title.trim();
  if (!title) {
    throw new Error("title is required");
  }
  return createTask(title);
}
EOF

    git add . && git commit -m "refactor(api): read the trimmed title once" --no-verify -q
    git push origin HEAD -q

    log_step "Scenario ready: a moved head whose standing verdict is already a close-out"
    log_info "Context: open PR carrying ## Review, then ## Review closed, then one commit raising nothing"
    log_info "Action:  /review-pr"
    log_info "Expect:  sees the prior commit reach the head, so the unchanged-head stop does not fire"
    log_info "         reads the refactor commit alone and raises no finding on it"
    log_info "         reads the standing verdict as ## Review closed and rewrites that comment"
    log_info "         through gh api -X PUT rather than posting a second close-out beside it"
    log_info "         leaves the thread with one ## Review closed, does NOT merge"
    ;;

  "marker-race")
    log_step "Configuring pr-review marker-race environment ($ANCHOR_REPO)"
    seed_reviewable_pr

    # What the seeded pass read, captured before the push below. Everything
    # between these two lines is the compose window, which is the stretch the
    # real race lives in and the one nothing about GitHub's own stamps records.
    READ_SHA=$(git rev-parse HEAD)
    READ_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # The push that lands inside that window. It is the same fix the close-out
    # arm seeds, so what the delta raises is the pass's own call and this arm
    # asserts only that the pass reached the delta at all.
    cat <<'EOF' >src/tasks.ts
export function createTask(title: string) {
  return { id: crypto.randomUUID(), title };
}

export function handleCreate(body: { title: string }) {
  if (!body.title.trim()) {
    throw new Error("title is required");
  }
  return createTask(body.title);
}
EOF

    git add . && git commit -m "fix(api): reject an empty task title" --no-verify -q
    git push origin HEAD -q

    # Posted after that push, so GitHub stamps commit.oid with the new head
    # while the marker names the commit the pass actually read. That is the
    # race reproduced exactly rather than waited for, and it is why this arm
    # needs no timing.
    gh pr review "$PR_URL" --comment --body "## Review

0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.

**\`src/tasks.ts\`**

- **should-fix**: \`handleCreate\` does not reject an empty title, so a blank task is created. Guard the title before calling \`createTask\`.

🤖 Reviewed by Claude Code
<!-- review-pr: commit=$READ_SHA read-at=$READ_AT -->" 2>/dev/null ||
      log_info "Could not seed the raced pass. Post one manually before testing."

    log_step "Scenario ready: a pass whose stamp and whose marker name different commits"
    log_info "Context: open PR whose only review carries commit.oid at the head and a marker one commit behind"
    log_info "Action:  /review-pr"
    log_info "Expect:  reads the covered commit off the marker via canon pr review-state"
    log_info "         sees it behind the head, so the unchanged-head stop does NOT fire"
    log_info "         reads fix(api) reject an empty task title as the delta"
    log_info "         writes a body carrying its own commit= read-at= marker on the last line"
    log_info "         a pass reading commit.oid instead stops with 'The head is unchanged' and posts nothing"
    log_info "Assert:  declared in fixtures/claude/review-pr/marker-race/expect.toml"
    ;;

  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
