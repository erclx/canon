#!/usr/bin/env bash

# The sandbox tree lives outside the toolkit worktree. `sandbox/run.sh`
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
# (not `$(...)`) exports it into the caller's own shell, which is what lets
# `run.sh` mint once and have manage-sandbox.sh and the check it shells out to
# both inherit the same id as ordinary children. A call already carrying the
# variable, inherited from such a parent, reuses it rather than minting a new one.
#
# Twin of `mintSandboxRunId` in `src/commands/sandbox.ts`.
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

# Twin of `sandboxTree` in `src/commands/sandbox.ts`. The exec boundary rules out
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

# Collapses repeated separators, folds `.` and `..` segments, and strips every
# trailing separator, leaving a bare root as `/`. Every comparison below is a
# string test, so `//`, `$HOME//`, and `$HOME/../../usr` each read as a path no
# rule names until this runs, and an unresolved `..` defeats the allowlist and
# both directions of the repository test at once.
#
# The fold is lexical because the guard runs before provisioning creates the
# tree, which rules out `cd` with `pwd -P` and any resolution needing the path
# to exist. Nothing here follows a symlink, so a `..` below one resolves against
# the link's own path rather than its target. A `..` climbing past the root
# clamps to `/`, matching the kernel, which leaves the allowlist to refuse it
# under the rule that already covers every root path.
normalize_sandbox_path() {
  local path="$1"

  [ -n "$path" ] || return 0

  while [ "$path" != "${path//\/\//\/}" ]; do
    path="${path//\/\//\/}"
  done

  local root=""
  if [ "${path#/}" != "$path" ]; then
    root="/"
    path="${path#/}"
  fi

  # `resolved` carries each kept segment behind its own separator, so a pop is
  # one suffix removal and popping an empty stack is the no-op that clamps at
  # the root. `climbed` holds the leading `..` a relative path has no segment to
  # pop against, which dropping would change the directory it names.
  local resolved="" climbed="" segment
  local remaining=4096

  while [ -n "$path" ] && [ "$remaining" -gt 0 ]; do
    remaining=$((remaining - 1))

    segment="${path%%/*}"
    if [ "$segment" = "$path" ]; then
      path=""
    else
      path="${path#*/}"
    fi

    case "$segment" in
    "" | .) ;;
    ..)
      if [ -n "$resolved" ]; then
        resolved="${resolved%/*}"
      elif [ -z "$root" ]; then
        climbed="$climbed../"
      fi
      ;;
    *) resolved="$resolved/$segment" ;;
    esac
  done

  if [ -n "$root" ]; then
    path="${resolved:-/}"
  else
    path="${climbed}${resolved#/}"
    path="${path:-.}"
  fi

  while [ "${#path}" -gt 1 ] && [ "${path%/}" != "$path" ]; do
    path="${path%/}"
  done

  printf '%s' "$path"
}

# Whether `candidate` is `target` or a directory containing it. Removing the
# former removes the latter, which is what makes an ancestor as dangerous as an
# exact match.
is_at_or_above() {
  local candidate="$1"
  local target="$2"

  [ "$candidate" = "$target" ] || [ "${target#"$candidate"/}" != "$target" ]
}

# Prints the reason a location is unusable and returns non-zero, so the caller
# reports one message naming the path rather than a bare refusal.
#
# Provisioning runs `rm -rf` on this path at three sites before staging, so the
# test is an allowlist rather than a list of paths to refuse. A blocklist has to
# name every system directory to be right once and stays wrong as soon as one is
# missed, while requiring a strict descendant of the home directory or of the
# temp root admits the default and every reasonable override and refuses `/`,
# `/usr`, `/etc`, and `$HOME` itself without naming any of them.
#
# The repository test is separate and runs both ways. A path under the worktree
# restores the ancestor chain the relocation removed, and a path above it is one
# `rm -rf` away from deleting the repository. It resolves the main worktree root
# rather than trusting `$PROJECT_ROOT`, since a linked worktree is itself inside
# that root.
assert_sandbox_dir_safe() {
  local raw="$1"
  local root="${2:-${PROJECT_ROOT:-$PWD}}"

  if [ -z "$raw" ] || [ "${raw#/}" = "$raw" ]; then
    printf 'CANON_SANDBOX_DIR must be an absolute path, got: %s\n' "${raw:-<empty>}"
    return 1
  fi

  # `normalize_sandbox_path` stops at 4096 segments and drops the remainder,
  # which would hand the tests below an ancestor of the path provisioning
  # removes. Refusing past `PATH_MAX` keeps that bound out of reach, since a
  # segment costs at least two bytes and no syscall accepts the string anyway.
  if [ "${#raw}" -gt 4096 ]; then
    printf 'Refusing the sandbox path. It is %s characters, past the longest path any filesystem here accepts.\n' "${#raw}"
    return 1
  fi

  local dir home temp
  dir="$(normalize_sandbox_path "$raw")"
  home="$(normalize_sandbox_path "${HOME:-/root}")"
  temp="$(normalize_sandbox_path "${TMPDIR:-/tmp}")"

  # Every message below names `$raw`, which is what the operator set. The tests
  # compare `$dir`, so a path carrying `..` is refused for a location its own
  # spelling does not show.
  local resolution=""
  [ "$dir" = "$raw" ] || resolution=" It resolves to $dir."

  if ! is_at_or_above "$home" "$dir" && ! is_at_or_above "$temp" "$dir"; then
    printf 'Refusing %s as the sandbox. Provisioning removes the tree first, so the path has to sit under %s or %s.%s\n' "$raw" "$home" "$temp" "$resolution"
    return 1
  fi

  if [ "$dir" = "$home" ] || [ "$dir" = "$temp" ]; then
    printf 'Refusing %s as the sandbox. Provisioning removes the tree first, so the path has to sit under %s rather than be it.\n' "$raw" "$dir"
    return 1
  fi

  local main_root
  main_root="$(git -C "$root" worktree list --porcelain 2>/dev/null |
    grep -m 1 '^worktree ' | cut -d' ' -f2-)"
  main_root="$(normalize_sandbox_path "${main_root:-$root}")"

  if is_at_or_above "$dir" "$main_root"; then
    printf 'Refusing %s as the sandbox. Provisioning removes the tree first, and that path contains %s.%s\n' "$raw" "$main_root" "$resolution"
    return 1
  fi

  case "$dir" in
  "$main_root"/*)
    printf 'Sandbox at %s sits inside %s, which puts the toolkit CLAUDE.md back on the session ancestor chain.%s Point CANON_SANDBOX_DIR outside the repository.\n' "$raw" "$main_root" "$resolution"
    return 1
    ;;
  esac

  return 0
}
