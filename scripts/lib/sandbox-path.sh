#!/usr/bin/env bash

# The sandbox tree lives outside the toolkit worktree. `canon sandbox run`
# sets cwd to it for `claude -p`, and every `CLAUDE.md` between that cwd and the
# filesystem root loads into the session. Under the repository the toolkit's own
# instructions join that chain beside the seeded copy the scenario installed,
# both carry the rule sending shared session scratch to the main worktree root,
# and nothing decides which root wins. A session picking the toolkit writes its
# output where no manifest reads it, so the run reports success while the verdict
# reports no writes at all. The retired eval runner kept its fixture outside the
# repository for the same reason.
#
# Mints a short random per-run identifier the first time it is asked for, then
# holds it in CANON_SANDBOX_RUN_ID for the rest of this process. A direct call
# (not `$(...)`) exports it into the caller's own shell. A call already carrying
# the variable, inherited from a parent such as `canon sandbox run`, reuses it
# rather than minting a new one, which is what keeps a hook on the parent's tree.
#
# Twin of `mintSandboxRunId` in `src/sandbox/tree.ts`.
mint_sandbox_run_id() {
  if [ -z "${CANON_SANDBOX_RUN_ID:-}" ]; then
    CANON_SANDBOX_RUN_ID="$(date +%s)-$$-$RANDOM"
  fi
  export CANON_SANDBOX_RUN_ID
}

# The base every per-run tree nests under, with no run id appended. Split out
# of `resolve_sandbox_dir` so a caller that needs to recognize any run's tree,
# such as `require_project_root` in `scripts/lib/ui.sh`, tests against this
# prefix instead of a single resolved path that changes on every call.
sandbox_dir_prefix() {
  printf '%s/canon/sandbox\n' "${XDG_STATE_HOME:-$HOME/.local/state}"
}

# Twin of `sandboxTree` in `src/sandbox/tree.ts`. The exec boundary rules out
# a shared constant, so a change to the default lands on both sides.
#
# A bare fall-through with no per-run component is one path per machine, so
# two sessions resolving the default at once would provision over each other
# with neither told. `mint_sandbox_run_id` is what makes two such sessions
# land on two different trees rather than one.
resolve_sandbox_dir() {
  if [ -n "${CANON_SANDBOX_DIR:-}" ]; then
    printf '%s\n' "$CANON_SANDBOX_DIR"
    return 0
  fi

  mint_sandbox_run_id
  printf '%s-%s\n' "$(sandbox_dir_prefix)" "$CANON_SANDBOX_RUN_ID"
}
