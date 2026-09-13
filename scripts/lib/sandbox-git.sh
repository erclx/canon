#!/usr/bin/env bash

# The sandbox reaches GitHub over HTTPS with the gh token so a headless run needs
# no SSH key and no agent. `gh auth login` authenticates the CLI but leaves git
# itself without a credential, so the harness supplies the helper rather than
# assuming the machine carries one.
SANDBOX_GIT_CREDENTIAL_HELPER='!gh auth git-credential'

# Call from the main shell before any scenario runs. sandbox_anchor_url is used
# inside command substitutions, where log_error would exit only the subshell and
# leave the caller building an empty remote, so the run has to stop here instead.
require_sandbox_anchor_config() {
  if [ -z "${GITHUB_ORG:-}" ]; then
    log_error "GITHUB_ORG is empty. Export GITHUB_ORG=<org>, or run from a clone whose remote.origin.url points at GitHub."
  fi
}

resolve_sandbox_anchor_repo() {
  printf '%s\n' "${1:-${ANCHOR_REPO:-}}"
}

sandbox_anchor_url() {
  local repo_name
  repo_name="$(resolve_sandbox_anchor_repo "$@")"

  if [ -z "$repo_name" ] || [ -z "${GITHUB_ORG:-}" ]; then
    log_error "sandbox_anchor_url needs GITHUB_ORG and a repository name. Call require_sandbox_anchor_config first."
  fi

  printf 'https://github.com/%s/%s.git\n' "$GITHUB_ORG" "$repo_name"
}

# credential.helper is multi-valued and git concatenates it across system, global,
# and local, trying each in order until one returns a credential. A plain set
# leaves an operator's existing helper ahead of this one, so a stale token wins
# and gh never runs. The empty value resets the inherited list first.
configure_sandbox_git_credentials() {
  git config credential.helper ""
  git config --add credential.helper "$SANDBOX_GIT_CREDENTIAL_HELPER"
}

resolve_sandbox_git_identity() {
  SANDBOX_GIT_NAME="${SANDBOX_GIT_NAME:-$(git config --global user.name 2>/dev/null || true)}"
  SANDBOX_GIT_EMAIL="${SANDBOX_GIT_EMAIL:-$(git config --global user.email 2>/dev/null || true)}"

  : "${SANDBOX_GIT_NAME:=aitk-sandbox}"
  : "${SANDBOX_GIT_EMAIL:=sandbox@example.com}"

  export SANDBOX_GIT_NAME SANDBOX_GIT_EMAIL
}

configure_sandbox_git_identity() {
  resolve_sandbox_git_identity
  git config user.name "$SANDBOX_GIT_NAME"
  git config user.email "$SANDBOX_GIT_EMAIL"
}

# Every scenario that needs a remote points at the same throwaway repository, so
# the name lives here rather than in each one.
SANDBOX_ANCHOR_REPO="aitk-sandbox"

# A scenario calls this from its own use_anchor hook rather than this file
# defining the hook. manage-sandbox.sh keys off `type -t use_anchor`, so
# declaring it here would hand an anchor to the scenarios that source this file
# for the identity helpers alone.
use_sandbox_anchor() {
  export ANCHOR_REPO="${1:-$SANDBOX_ANCHOR_REPO}"
}

# gh answers an absent repository and an unreachable host with the same exit
# status, so the 404 is the only thing separating them. Anything else is a
# network or credential fault, where creating a repository would be the wrong
# answer and would fail for the same reason the read did.
ensure_sandbox_anchor_repo() {
  local repo_name gh_error

  repo_name="$(resolve_sandbox_anchor_repo "$@")"

  if [ -z "$repo_name" ] || [ -z "${GITHUB_ORG:-}" ]; then
    log_error "ensure_sandbox_anchor_repo needs GITHUB_ORG and a repository name. Call require_sandbox_anchor_config first."
  fi

  if gh_error="$(gh api "repos/${GITHUB_ORG}/${repo_name}" --silent 2>&1)"; then
    return 0
  fi

  case "$gh_error" in
  *"HTTP 404"*) ;;
  *) log_error "Cannot reach ${GITHUB_ORG}/${repo_name}: ${gh_error}" ;;
  esac

  # An absent anchor is nearly always a wrong GITHUB_ORG or a rename nobody
  # performed, and provisioning stages a fixture rather than cloning while every
  # scenario force-pushes to main, so a repository created here would carry all
  # nine to a pass against something that is not the anchor. Refusing is the safe
  # default and creating is the opt-in, the shape `canon tooling sync --write`
  # already sets. `canon records push` refuses outright for the reason
  # `canon/context/development/scratch.md` records, so the two still differ.
  # The sibling SANDBOX_ flags are presence tests, so any non-empty value turns
  # them on. This one allowlists instead, because a presence test would have
  # SANDBOX_ANCHOR_CREATE=false provisioning a repository. Both spellings are
  # accepted so the `true` those siblings are set to does not land on a refusal.
  case "${SANDBOX_ANCHOR_CREATE:-}" in
  1 | true) ;;
  *) log_error "${GITHUB_ORG}/${repo_name} does not exist. Check GITHUB_ORG and whether a rename is pending, then create it with 'gh repo create ${GITHUB_ORG}/${repo_name} --private' or re-run with SANDBOX_ANCHOR_CREATE=true." ;;
  esac

  log_warn "${GITHUB_ORG}/${repo_name} does not exist and SANDBOX_ANCHOR_CREATE is set. Creating it as private."
  if ! gh_error="$(gh repo create "${GITHUB_ORG}/${repo_name}" --private 2>&1)"; then
    log_error "Could not create ${GITHUB_ORG}/${repo_name}: ${gh_error}"
  fi
  log_info "Created ${GITHUB_ORG}/${repo_name} as a private repository."
}

# Mirrors the merge-base resolution the diff-baseline port already carries
# across five skill bodies, so a checkout whose local main trails origin/main
# does not pull in skill bodies other merged branches changed.
resolve_sandbox_skill_diff_base() {
  git -C "$PROJECT_ROOT" merge-base HEAD origin/main 2>/dev/null ||
    git -C "$PROJECT_ROOT" merge-base HEAD main 2>/dev/null
}

# A remote is useless without an author, so the scenarios that reach one always
# configure both. configure_sandbox_git_identity stays callable on its own for
# the scenarios that never push. The probe runs first so an absent remote is
# reported before the scenario stages anything. The remove keeps this idempotent
# against a sandbox tree that already carries an origin.
configure_sandbox_anchor_remote() {
  ensure_sandbox_anchor_repo "$@"
  configure_sandbox_git_identity
  git remote remove origin 2>/dev/null || true
  git remote add origin "$(sandbox_anchor_url "$@")"
}
