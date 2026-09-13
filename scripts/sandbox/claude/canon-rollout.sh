#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

# One arm, so the declaration sits at the command root and reports as
# `(default)`. `stage_fixtures` takes a four-segment path ending in an arm name
# and there is no segment to pass, which is why the tree below is staged from
# heredocs the way `claude/review` and `claude/session-map` stage theirs.
stage_setup() {
  cat <<'EOF' >CLAUDE.md
# Toolkit

CLI toolkit for managing AI workflows across repositories.

## Commands

- `bun run check`: lint and typecheck
EOF

  git add . && git commit -m "docs(project): name the sandbox root as a toolkit checkout" --no-verify -q

  # Three repositories of their own, built after the outer commit so the outer
  # tree never records any of them as a gitlink, which is the shape
  # `infra:gov`'s `test-order` arm already runs. A clone's currency is a fact
  # about its history against a remote, so it cannot be expressed as files in a
  # directory and the fixture has to be real repositories.
  mkdir -p targets
  git init -q --bare --initial-branch=main targets/origin.git

  git init -q --initial-branch=main targets/seed
  git -C targets/seed config user.email "sandbox@example.com"
  git -C targets/seed config user.name "Sandbox"

  mkdir -p targets/seed/canon/config targets/seed/.claude/rules/canon/core
  cat <<'EOF' >targets/seed/canon/config/config.json
{
  "syncedAt": "2026-08-01T00:00:00.000Z",
  "domains": {
    "governance": {
      ".claude/rules/canon/core/000-constitution.md": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  }
}
EOF
  echo "# Role persona" >targets/seed/.claude/rules/canon/core/000-constitution.md
  echo "# Kestrel" >targets/seed/README.md

  git -C targets/seed add .
  git -C targets/seed commit -q -m "chore(agents): install the toolkit governance rules"
  git -C targets/seed remote add origin ../origin.git
  git -C targets/seed push -q origin main

  # Both clones are taken here, so the pair is identical at this point and the
  # divergence below is the one thing that separates them.
  git clone -q targets/origin.git targets/kestrel-a
  git clone -q targets/origin.git targets/kestrel-b

  for clone in kestrel-a kestrel-b; do
    git -C "targets/$clone" config user.email "sandbox@example.com"
    git -C "targets/$clone" config user.name "Sandbox"
  done

  # `kestrel-b` moves the remote forward and `kestrel-a` is left behind by
  # exactly that commit. `kestrel-a` sorts first and is the clone a run picking
  # by listing order takes, which is the wrong answer this arm exists to catch.
  #
  # Nothing fetches in `kestrel-a` afterwards, so its own `origin/main` stays
  # where the clone left it and both checkouts read level against their remote
  # until a run fetches. That is the property the arm turns on: a run reading
  # the pair as it sits cannot separate them at all, and the difference appears
  # only to a run that goes to the remote first.
  echo "# Kestrel, a habit tracker" >targets/kestrel-b/README.md
  git -C targets/kestrel-b add .
  git -C targets/kestrel-b commit -q -m "docs(readme): say what the project is"
  git -C targets/kestrel-b push -q origin main

  rm -rf targets/seed

  log_step "Scenario ready: a wave meets one target held in two clones"
  log_info "Context: targets/kestrel-a and targets/kestrel-b are two checkouts of one"
  log_info "         consuming project, sharing the bare origin at targets/origin.git."
  log_info "         kestrel-b is level with the origin's default branch. kestrel-a is"
  log_info "         one commit behind it and sorts first, so a run that picks by"
  log_info "         listing order rather than by currency takes the stale one."
  log_info ""
  log_info "The population is given rather than read. Say this in chat before invoking,"
  log_info "so no run reaches the machine's real target index or the projects in it:"
  log_info "  'These two directories under targets/ are the whole population for this"
  log_info "   wave. Read nothing outside this sandbox and dispatch no worker.'"
  log_info "  'Decide which clone a worker would branch from, then write the decision"
  log_info "   to .canon/tmp/rollout/dispatch.md as exactly two lines:'"
  log_info "  'Dispatch into: <path>'"
  log_info "  'Refused: <path>, because <reason>'"
  log_info ""
  log_info "Action:  /canon:canon-rollout"
  log_info "Expect:  picks kestrel-b, refuses kestrel-a as behind its remote, and"
  log_info "         creates no branch and no worktree in either clone"
  log_info "Assert:  declared in fixtures/claude/canon-rollout/expect.toml"
  log_info "         Check it with: canon sandbox check claude:canon-rollout"
  log_info "         Whether the run fetched before deciding, and whether the reason"
  log_info "         it gives is currency rather than sort order, need a reader."
}
