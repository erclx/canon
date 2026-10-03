#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
export PROJECT_ROOT

source "$PROJECT_ROOT/scripts/config.sh"
source "$PROJECT_ROOT/scripts/lib/ui.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-path.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

# Without this, git falls back to a terminal prompt when no helper supplies a
# credential, and an unauthenticated run blocks on /dev/tty instead of failing.
# The harness must never require a TTY.
export GIT_TERMINAL_PROMPT=0

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} canon sandbox [cat:cmd]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Arguments:${NC}"
  echo -e "${GREY}│${NC}    cat:cmd   ${GREY}# Scenario to provision (e.g. git:commit)${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Commands:${NC}"
  echo -e "${GREY}│${NC}    reset     ${GREY}# Reset sandbox to baseline${NC}"
  echo -e "${GREY}│${NC}    clean     ${GREY}# Wipe the sandbox${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Options:${NC}"
  echo -e "${GREY}│${NC}    -h, --help    ${GREY}# Show this help message${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Examples:${NC}"
  echo -e "${GREY}│${NC}    canon sandbox"
  echo -e "${GREY}│${NC}    canon sandbox git:commit"
  echo -e "${GREY}│${NC}    canon sandbox reset"
  echo -e "${GREY}│${NC}    canon sandbox clean"
  echo -e "${GREY}└${NC}"
  exit 0
}

ANCHOR_FIXTURE_DIR="$PROJECT_ROOT/sandbox/fixtures/anchor/create"

# Where an anchor scenario's tree comes from and where its remote points are two
# concerns, and only the remote needs a network. Taking the tree from a fixture
# stops an arm provisioning from whatever the previous arm force-pushed, which is
# what made two identical sweeps of the sixteen arms disagree on eleven.
stage_anchor_tree() {
  # The nine anchor scenarios configure a real remote from their own stage_setup,
  # and sandbox_anchor_url runs inside a command substitution there, where
  # log_error would exit only the subshell and leave an empty remote behind. The
  # guard has to fire here, in the main shell, before any of them run.
  require_sandbox_anchor_config

  log_step "Staging anchor tree from fixture"

  assert_fixtures_suffixed "$ANCHOR_FIXTURE_DIR"
  if [ "$(count_fixture_files "$ANCHOR_FIXTURE_DIR")" -eq 0 ]; then
    log_error "Anchor fixture provisions nothing: $ANCHOR_FIXTURE_DIR"
  fi

  if [ -d "$SANDBOX" ]; then
    rm -rf "$SANDBOX"
  fi
  mkdir -p "$SANDBOX"

  (
    cd "$SANDBOX"
    create_from_fixtures "$ANCHOR_FIXTURE_DIR"
    git init >/dev/null
    git add .
    git commit -m "feat(sandbox): initial sandbox setup from anchor" --no-verify >/dev/null
  )
  log_info "Anchor tree staged from fixture, remote stays $ANCHOR_REPO"
}

select_sandbox_category() {
  local categories=()
  if ls -d "$SANDBOX_DIR"/*/ >/dev/null 2>&1; then
    # Twin of FIXTURES_DIR in src/commands/sandbox.ts. The exec boundary rules out
    # a shared constant, so a new exclusion has to land on both sides.
    mapfile -t categories < <(find "$SANDBOX_DIR" -mindepth 1 -maxdepth 1 -type d -not -name fixtures -exec basename {} \; | sort)
  fi

  if [ ${#categories[@]} -eq 0 ]; then
    log_error "No sandbox categories found in $SANDBOX_DIR"
  fi

  select_option "Select category:" "${categories[@]}"
  _CATEGORY=$SELECTED_OPTION
}

select_sandbox_command() {
  local commands=()
  if ls "$SANDBOX_DIR/$_CATEGORY/"*.sh >/dev/null 2>&1; then
    mapfile -t commands < <(find "$SANDBOX_DIR/$_CATEGORY" -maxdepth 1 -name '*.sh' -exec basename {} .sh \; | sort)
  fi

  if [ ${#commands[@]} -eq 0 ]; then
    log_error "No sandbox scripts found in $_CATEGORY"
  fi

  select_option "Select command:" "${commands[@]}"
  _COMMAND=$SELECTED_OPTION
}

prompt_for_category_and_command() {
  select_sandbox_category
  select_sandbox_command
}

parse_command_argument() {
  local input_arg="$1"

  if [[ "$input_arg" != *":"* ]]; then
    log_error "Invalid format. Use <category>:<command>, 'reset', 'clean', or --help"
  fi
  IFS=':' read -r _CATEGORY _COMMAND <<<"$input_arg"
}

resolve_command_and_category() {
  local input_arg="$1"
  if [ -z "$input_arg" ]; then
    prompt_for_category_and_command
  else
    parse_command_argument "$input_arg"
  fi
}

validate_environment() {
  local current_category="$1"
  local current_command="$2"

  if [ ! -d "$SANDBOX_DIR" ]; then
    log_error "Sandbox directory not found at: $SANDBOX_DIR"
  fi

  if [[ "$PWD" == "$SANDBOX" || "$PWD" == "$SANDBOX"/* ]]; then
    log_warn "Detected execution inside the sandbox. Switching to project root..."
    cd "$PROJECT_ROOT" || log_error "Failed to switch to project root."
  fi
}

load_sandbox_script() {
  local current_category="$1"
  local current_command="$2"

  local sandbox_file="$SANDBOX_DIR/$current_category/$current_command.sh"

  if [ ! -f "$sandbox_file" ]; then
    log_error "Sandbox script not found: $current_category/$current_command"
  fi

  # shellcheck source=/dev/null
  source "$sandbox_file"
}

init_empty_sandbox() {
  if [ -d "$SANDBOX" ]; then
    rm -rf "$SANDBOX"
  fi
  mkdir -p "$SANDBOX"

  cat <<EOF >"$SANDBOX/.gitignore"
.canon/tmp/
node_modules
EOF
  (
    cd "$SANDBOX"
    git init >/dev/null
    git add .gitignore >/dev/null 2>/dev/null
    git commit -m "feat(sandbox): initial empty sandbox setup" --no-verify >/dev/null
  )
}

provision_sandbox() {
  log_step "Provisioning $1:$2"

  if [[ "$(type -t use_anchor)" == "function" ]]; then
    use_anchor
    stage_anchor_tree
  else
    init_empty_sandbox
  fi

  # Scoped to the throwaway sandbox repo so the operator's global git config is
  # never written. Covers both the scenario pushes and the ones the agent makes
  # itself once it is running inside the sandbox.
  (cd "$SANDBOX" && configure_sandbox_git_credentials)
}

# Runs the real installer rather than copying the source tree. The copies these
# replaced, for gov rules and for seeds, each reimplemented an installer's
# selection rules, so a change to what install produces left the sandbox
# provisioning the old shape and no scenario could observe the difference.
run_sandbox_install() {
  local label="$1"
  shift

  local install_log
  install_log="$(mktemp)"

  # The installer's own frame would bury the provisioning timeline, so it stays
  # captured unless it fails, where it is the only thing naming the cause.
  if ! CANON_NON_INTERACTIVE=1 bun "$PROJECT_ROOT/src/cli.ts" "$@" \
    >/dev/null 2>"$install_log"; then
    cat "$install_log" >&2
    rm -f "$install_log"
    log_error "Could not install $label into the sandbox."
  fi

  rm -f "$install_log"
}

# The stack decides which rules land. `base` carries the language-agnostic core,
# which is what a scenario asserting on rule behavior reads. A scenario needing a
# framework's rules overrides the variable in `use_config`.
inject_gov_rules() {
  [ ! -d "$PROJECT_ROOT/governance/rules" ] && return

  run_sandbox_install "gov rules" gov install "${SANDBOX_GOV_STACK:-base}" "$SANDBOX"
}

inject_seeds() {
  [ ! -d "$PROJECT_ROOT/tooling/claude/seeds" ] && return

  run_sandbox_install "seeds" claude init "$SANDBOX"
}

commit_environment_setup() {
  (
    cd "$SANDBOX"
    git add .
    if ! git diff --cached --quiet; then
      git commit -m "chore(sandbox): initial environment setup" --no-verify >/dev/null
    fi
  )
}

# No standards injection. The corpus installs into no target, so a sandbox
# without one is the shape a scaffolded project has, and a scenario driving a
# skill that reads a standard exercises the `canon standards <name>` path a real
# project takes.
setup_sandbox_assets() {
  [ -n "$SANDBOX_INJECT_SEEDS" ] && inject_seeds
  [ -n "$SANDBOX_INJECT_GOV" ] && inject_gov_rules
  commit_environment_setup
}

initialize_sandbox_environment() {
  local current_category="$1"
  local current_command="$2"

  load_sandbox_script "$current_category" "$current_command"
  [[ "$(type -t use_config)" == "function" ]] && use_config
  validate_environment "$current_category" "$current_command"
  provision_sandbox "$current_category" "$current_command"
  setup_sandbox_assets
}

commit_sandbox_changes() {
  if [ -z "$SANDBOX_SKIP_AUTO_COMMIT" ]; then
    log_step "Staging environment changes"
    (
      cd "$SANDBOX"
      git add . >/dev/null 2>/dev/null
      git commit -m 'chore(sandbox): apply scenario specific setup' --no-verify >/dev/null
    )
    log_info "Git state clean after setup"
  else
    log_info "Skipping auto-commit"
  fi
}

tag_sandbox_baseline() {
  (
    cd "$SANDBOX"
    git update-ref refs/sandbox/baseline HEAD >/dev/null 2>&1
    git write-tree | xargs -I {} git update-ref refs/sandbox/baseline-index {} >/dev/null 2>&1
  )
}

inject_changed_skills() {
  local base
  base=$(resolve_sandbox_skill_diff_base)
  base="${base:-main}"

  local changed untracked
  changed=$(git -C "$PROJECT_ROOT" diff "$base" --name-only -- 'claude/skills/**/SKILL.md' 2>/dev/null)
  untracked=$(git -C "$PROJECT_ROOT" ls-files --others --exclude-standard -- 'claude/skills/**/SKILL.md' 2>/dev/null)

  local combined
  combined=$(printf '%s\n%s\n' "$changed" "$untracked" | awk 'NF && !seen[$0]++')

  [ -z "$combined" ] && return

  while IFS= read -r skill_path; do
    # The diff against the base lists a deleted skill alongside a changed one,
    # and there is nothing left to inject for a name this branch removed.
    [ -f "$PROJECT_ROOT/$skill_path" ] || continue

    local skill_name
    skill_name=$(basename "$(dirname "$skill_path")")
    local target_dir="$SANDBOX/.claude/skills/$skill_name"
    mkdir -p "$target_dir"
    cp "$PROJECT_ROOT/$skill_path" "$target_dir/SKILL.md"
    if [ -n "$SANDBOX_SKIP_AUTO_COMMIT" ]; then
      echo ".claude/skills/$skill_name/SKILL.md" >>"$SANDBOX/.git/info/exclude"
    fi
    log_info "Injected dev skill: $skill_name"
  done <<<"$combined"
}

execute_sandbox_and_commit() {
  pushd "$SANDBOX" >/dev/null
  stage_setup
  popd >/dev/null

  inject_changed_skills
  commit_sandbox_changes
  tag_sandbox_baseline
}

finalize_sandbox_run() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  trap - EXIT
  close_timeline
  echo "" >&2
  echo -e "${GREEN}✓ Sandbox Ready${NC}" >&2
}

cmd_clean() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  log_step "Removing sandbox"
  rm -rf "$SANDBOX"
  log_rem "$SANDBOX"
  trap - EXIT
  close_timeline
  echo "" >&2
  echo -e "${GREEN}✓ Sandbox clean${NC}" >&2
}

reset_sandbox() {
  local GREEN RED YELLOW WHITE GREY NC
  set_palette 2
  if [ ! -d "$SANDBOX/.git" ]; then
    log_error "No sandbox found. Run \`canon sandbox\` first."
  fi

  log_step "Sandbox state"

  local has_baseline=0
  (cd "$SANDBOX" && git rev-parse refs/sandbox/baseline >/dev/null 2>&1) && has_baseline=1

  if [ "$has_baseline" -eq 0 ]; then
    log_error "No baseline found. Re-provision with \`canon sandbox <cat>:<cmd>\`."
  fi

  local is_dirty=0
  (
    cd "$SANDBOX"
    if [ "$(git rev-parse HEAD)" != "$(git rev-parse refs/sandbox/baseline)" ]; then
      exit 1
    fi
    local current_index baseline_index
    current_index=$(git write-tree)
    baseline_index=$(git rev-parse refs/sandbox/baseline-index 2>/dev/null || echo "")
    if [ -n "$baseline_index" ] && [ "$current_index" != "$baseline_index" ]; then
      exit 1
    fi
    if ! git diff --quiet 2>/dev/null; then
      exit 1
    fi
    if [ -n "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
      exit 1
    fi
  ) || is_dirty=1

  if [ "$is_dirty" -eq 0 ]; then
    log_info "At baseline"
    trap - EXIT
    close_timeline
    echo "" >&2
    echo -e "${GREEN}✓ Sandbox at baseline${NC}" >&2
    exit 0
  fi

  log_warn "Uncommitted changes detected"

  select_option "Reset sandbox to initial state?" "Yes" "No"
  if [ "$SELECTED_OPTION" == "No" ]; then
    log_warn "Reset cancelled"
    exit 0
  fi

  log_step "Resetting sandbox"
  (
    cd "$SANDBOX"
    git reset --hard refs/sandbox/baseline --quiet
    git clean -fd --quiet
    local baseline_index
    baseline_index=$(git rev-parse refs/sandbox/baseline-index 2>/dev/null || echo "")
    if [ -n "$baseline_index" ] && [ "$baseline_index" != "$(git write-tree)" ]; then
      git read-tree "$baseline_index"
      git checkout-index -a -f
    fi
  )
  log_info "Sandbox reset to baseline"

  trap - EXIT
  close_timeline
  echo "" >&2
  echo -e "${GREEN}✓ Sandbox reset complete${NC}" >&2
}

main() {
  local no_header=0
  if [[ "$1" == "--no-header" ]]; then
    no_header=1
    shift
  fi

  if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
  fi

  if [[ "$no_header" -eq 0 ]]; then
    open_timeline "canon sandbox"
  fi
  trap close_timeline EXIT

  if [[ "$PWD" != "$PROJECT_ROOT"* ]]; then
    log_error "Context error: you must run this command from inside the toolkit repository."
  fi

  SANDBOX="$(resolve_sandbox_dir)"
  SANDBOX_DIR="$PROJECT_ROOT/sandbox"

  local unsafe
  if ! unsafe="$(assert_sandbox_dir_safe "$SANDBOX" "$PROJECT_ROOT")"; then
    log_error "$unsafe"
  fi

  if [[ "$1" == "reset" ]]; then
    reset_sandbox
    exit 0
  fi

  if [[ "$1" == "clean" ]]; then
    cmd_clean
    exit 0
  fi

  resolve_command_and_category "$1"
  local category="$_CATEGORY"
  local command="$_COMMAND"

  if [ -n "${2:-}" ]; then
    export SANDBOX_SCENARIO="$2"
    export CANON_NON_INTERACTIVE="1"
  fi

  initialize_sandbox_environment "$category" "$command"
  execute_sandbox_and_commit

  finalize_sandbox_run
}

main "$@"
