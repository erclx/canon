#!/usr/bin/env bash
set -euo pipefail

# Prints the base port, plus a per-worktree offset in a linked worktree, so
# two worktrees never share one. A folder its worktree left behind is refused,
# since every port it derives lands on the main checkout's.

base="${1:-0}"
band=50
worktrees_dir=".claude/worktrees"

refuse() {
  echo "worktree-port: $1 is a leftover worktree folder, because $2." >&2
  echo "worktree-port: a port derived here collides with the main checkout, so remove the folder, or set WORKTREE_PORT_OFFSET to serve from it anyway." >&2
}

offset() {
  if [[ -n "${WORKTREE_PORT_OFFSET:-}" ]]; then
    echo "$WORKTREE_PORT_OFFSET"
    return
  fi

  local here git_dir common_dir toplevel dir name
  here=$(pwd -P)

  if ! git_dir=$(git rev-parse --git-dir 2>/dev/null); then
    # Git refuses outright when a `.git` file names an administrative directory
    # that is gone, which is what removing a worktree by hand leaves behind.
    # Outside a repository there is no pointer at all and the base is correct.
    dir=$here
    while [[ "$dir" != / ]]; do
      if [[ -f "$dir/.git" ]]; then
        refuse "$dir" "its .git file names an administrative directory that is gone"
        return 1
      fi
      [[ -d "$dir/.git" ]] && break
      dir=$(dirname "$dir")
    done
    echo 0
    return
  fi

  common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || {
    echo 0
    return
  }
  toplevel=$(git rev-parse --show-toplevel 2>/dev/null) || {
    echo 0
    return
  }
  toplevel=$(cd "$toplevel" && pwd -P)

  if [[ "$(cd "$git_dir" && pwd -P)" == "$(cd "$common_dir" && pwd -P)" ]]; then
    # A folder whose worktree was removed also reads as the main checkout, since
    # the lookup walks up to the parent, so location under the worktrees folder
    # is the only signal separating the two.
    if [[ "$here/" == "$toplevel/$worktrees_dir/"?* ]]; then
      refuse "$here" "no worktree is registered for it"
      return 1
    fi
    echo 0
    return
  fi

  name=$(basename "$toplevel")
  echo $(($(printf '%s' "$name" | cksum | cut -d' ' -f1) % band + 1))
}

value=$(offset) || exit 1
echo $((base + value))
