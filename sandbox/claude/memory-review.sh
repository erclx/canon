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
  # `feedback-legacy-handlers-own-auth` cites a file the stage never holds, so
  # `canon records stale memory` lists it first and the batch has to open on it.
  # The index is stored in the shape `canon indexes regen` produces, so it
  # matches what the memory-index hook would have written. A hand-shaped index
  # would drift from the renderer and teach the arm the wrong contract.
  stage_fixtures claude memory-review shared 01-initial

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
