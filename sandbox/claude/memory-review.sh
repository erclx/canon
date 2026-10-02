#!/usr/bin/env bash
set -e
set -o pipefail

# No project copy of the corpus, matching `claude/review-branch.sh` and
# `claude/ui-checklist.sh`. The absent project copy forces `memory-review` onto
# the `${CLAUDE_SKILL_DIR}/../../standards/skill.md` fallback, and the branch
# staged below turns that citation into a proposal filename a reader can check by
# eye. `expect.toml` carries that claim as a manual entry rather than an
# assertion, because the proposal lands at a root no run determines.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >>CLAUDE.md

# Sample Project

Task API used as the fixture for /canon:memory-review.

## Behavior

- Run `bun run check` before opening a PR.

## Memory

- Write all memory files to `.canon/memory/`, not `~/.claude/projects/`.
- Save a feedback memory only when the same mistake happens twice or when the user explicitly corrects you.
- Keep feedback memories to 3 lines: the rule, a one-line Why, and a one-line How to apply.

## Tasks

- Track work in `.canon/tasks/`, one file per task.
EOF

  mkdir -p .claude/skills/canon-sample
  cat <<'EOF' >.claude/skills/canon-sample/SKILL.md
---
name: canon-sample
description: Guide edits under src/.
---

# Sample skill

## When to load

When editing anything under `src/`.

## Conventions

- Route handlers live in `src/routes/`.
EOF

  mkdir -p .canon/memory

  cat <<'EOF' >.canon/memory/feedback-confirm-destructive-commands.md
---
title: Confirm destructive commands before running
description: Pause for user approval before rm, force-push, or branch deletion
category: Feedback
---

Before running a destructive shell command, state the command and wait for user approval.

**Why:** User lost work last session when a `git reset --hard` ran without confirmation.

**How to apply:** On any command that deletes data or rewrites shared history, print the exact command in chat and pause.
EOF

  cat <<'EOF' >.canon/memory/feedback-zod-in-src-routes.md
---
title: Use Zod for request validation in src/routes
description: Parse request bodies with Zod schemas at the handler boundary
category: Feedback
---

Route handlers in `src/routes/` must parse request bodies with Zod before touching the db layer.

**Why:** A past incident landed unchecked input into SQLite and corrupted the tasks table.

**How to apply:** When editing or adding a handler under `src/routes/`, co-locate the Zod schema in the same file and parse before any db call.
EOF

  cat <<'EOF' >.canon/memory/feedback-no-obvious-comments.md
---
title: Do not add obvious comments
description: Skip comments that restate what the code already says
category: Feedback
---

Do not write comments that describe what the code does when the identifiers already state it.

**Why:** Obvious comments rot as code evolves and create review noise.

**How to apply:** Before writing a comment, ask whether removing it would confuse a reader. If no, skip it.
EOF

  cat <<'EOF' >.canon/memory/feedback-comments-explain-why.md
---
title: Comments should explain why, not what
description: Reserve comments for non-obvious rationale, hidden constraints, and workarounds
category: Feedback
---

When a comment is warranted, it explains why the code is shaped this way, not what it does.

**Why:** "What" comments duplicate code. "Why" comments capture invariants the code cannot express.

**How to apply:** If a comment starts with a verb describing the code's action, rewrite it to name the constraint or reason instead.
EOF

  cat <<'EOF' >.canon/memory/feedback-memory-location.md
---
title: Write memories to .canon/memory/
description: Memory files belong under .canon/memory/, not ~/.claude/projects/
category: Feedback
---

All memory files land in `.canon/memory/` at the project root, never in `~/.claude/projects/`.

**Why:** Per-project memory must be tracked alongside the repo it applies to.

**How to apply:** Before writing a memory file, verify the path starts with `.canon/memory/`.
EOF

  cat <<'EOF' >.canon/memory/feedback-be-careful.md
---
title: Be careful
description: Think before acting
category: Feedback
---

Be thoughtful about changes.

**Why:** Mistakes are costly.

**How to apply:** Consider impact before editing.
EOF

  # Cites a file the fixture never holds, so `canon records stale memory` lists
  # it first and the batch has to open on it.
  cat <<'EOF' >.canon/memory/feedback-legacy-handlers-own-auth.md
---
title: Auth checks live in the legacy handler module
description: Put every auth check in the legacy handler module before a route runs
category: Feedback
---

Run every auth check in `src/legacy/handlers.ts` before a route handler executes.

**Why:** Two routes once shipped with no auth check because each assumed the other layer ran it.

**How to apply:** When adding a route, call the legacy auth guard first.
EOF

  # Reviewed today, so the verb reads it as not due and a correct batch leaves
  # it out whatever room remains.
  cat <<EOF >.canon/memory/feedback-small-pull-requests.md
---
title: Keep pull requests under one concern
description: Split a change touching two concerns into two pull requests
category: Feedback
reviewed: $(date +%F)
---

Open one pull request per concern, even when both changes are small.

**Why:** A reviewer approving one concern waved through the second unread.

**How to apply:** Before opening a pull request, list its concerns and split when there are two.
EOF

  # Padding past one batch of 25. Named to sort after every entry above, so the
  # verb's by-name tiebreak puts the last two outside the batch.
  local pad
  for pad in $(seq -w 1 20); do
    cat <<EOF >".canon/memory/feedback-zz-pad-${pad}.md"
---
title: Padding habit ${pad}
description: Stay mindful of habit ${pad}
category: Feedback
---

Keep habit ${pad} in mind while working.

**Why:** It seemed useful once.

**How to apply:** Remember it.
EOF
  done

  # Seeded in the shape `canon indexes regen` produces, so the fixture matches
  # what the memory-index hook would have written. A hand-shaped index here
  # would drift from the renderer and teach the arm the wrong contract.
  cat <<'EOF' >.canon/memory/index.md
---
title: Memory
subtitle: Session facts with no owning surface, grouped by kind.
---

# Memory

Session facts with no owning surface, grouped by kind.

## Feedback

- [Be careful](feedback-be-careful.md): Think before acting
- [Comments should explain why, not what](feedback-comments-explain-why.md): Reserve comments for non-obvious rationale, hidden constraints, and workarounds
- [Confirm destructive commands before running](feedback-confirm-destructive-commands.md): Pause for user approval before rm, force-push, or branch deletion
- [Auth checks live in the legacy handler module](feedback-legacy-handlers-own-auth.md): Put every auth check in the legacy handler module before a route runs
- [Write memories to .canon/memory/](feedback-memory-location.md): Memory files belong under .canon/memory/, not ~/.claude/projects/
- [Do not add obvious comments](feedback-no-obvious-comments.md): Skip comments that restate what the code already says
- [Keep pull requests under one concern](feedback-small-pull-requests.md): Split a change touching two concerns into two pull requests
- [Use Zod for request validation in src/routes](feedback-zod-in-src-routes.md): Parse request bodies with Zod schemas at the handler boundary
EOF
  for pad in $(seq -w 1 20); do
    echo "- [Padding habit ${pad}](feedback-zz-pad-${pad}.md): Stay mindful of habit ${pad}" >>.canon/memory/index.md
  done

  # An explicit branch rather than whatever `git init` inherited. The proposal
  # filename carries the slug, so leaving it on the machine's `init.defaultBranch`
  # would make the expectation pass or fail by local git config.
  git checkout -b chore/memory-sweep -q

  git add . && git commit -m "chore(memory): seed review fixtures" --no-verify -q

  log_step "Scenario ready: memory review with mixed classification"
  log_info "Fixtures seeded in .canon/memory/:"
  log_info "  confirm-destructive-commands  : promote to an always-loaded rule (cross-domain)"
  log_info "  zod-in-src-routes             : promote to .claude/skills/canon-sample/SKILL.md (path-scoped)"
  log_info "  no-obvious-comments + comments-explain-why : consolidate into one promote"
  log_info "  memory-location               : already absorbed in CLAUDE.md Memory, should retire"
  log_info "  be-careful                    : crisp-fail, should retire"
  log_info "  legacy-handlers-own-auth      : cites a missing path, opens the batch"
  log_info "  small-pull-requests           : reviewed today, not due, stays out"
  log_info "  zz-pad-01..20                 : padding, 27 due against a batch of 25"
  log_info "  so zz-pad-19 and zz-pad-20 fall outside the batch"
  log_info ""
  log_info ""
  log_info "This arm also checks the standards citation, not the skill alone."
  log_info "  .claude/standards/ is absent, so the skill must reach the plugin copy"
  log_info "  the slug transform lives only in standards/skill.md, never in the skill body"
  log_info "  so memory-review-memory-sweep.md is evidence the fallback resolved"
  log_info "  read that filename yourself, the checker cannot assert it yet"
  log_info ""
  log_info "Action:  /canon:memory-review"
  log_info "Expect:  declared in fixtures/claude/memory-review/expect.toml"
  log_info "         Check it with: canon sandbox check claude:memory-review"
  log_info "         Interactively, respond 'all' to exercise the apply path, after"
  log_info "         which each handled entry sits in .canon/memory/archive/"
  log_info "         rather than deleted, and index.md has lost its rows. The"
  log_info "         declaration covers the propose pass alone, which is where a"
  log_info "         headless run stops."
}
