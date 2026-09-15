#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

source "$PROJECT_ROOT/scripts/lib/ui.sh"
source "$PROJECT_ROOT/scripts/lib/tooling.sh"

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} canon tooling verify <stack> [options]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Options:${NC}"
  echo -e "${GREY}│${NC}    --keep       ${GREY}# Keep tmp dir after run for inspection${NC}"
  echo -e "${GREY}│${NC}    -h, --help   ${GREY}# Show this help message${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  Scaffolds <stack> into .canon/tmp/runs/verify-<stack>/, syncs the full"
  echo -e "${GREY}│${NC}  layer chain, and runs check + test:e2e + screenshot."
  echo -e "${GREY}└${NC}"
  exit 0
}

read_manifest_field() {
  local toml="$1"
  local section="$2"
  local field="$3"
  awk -v s="$section" -v f="$field" '
    $0 == "[" s "]" { in_section = 1; next }
    in_section && /^\[/ { exit }
    in_section && match($0, "^" f "[[:space:]]*=") {
      val = substr($0, RLENGTH + 1)
      sub(/^[[:space:]]+/, "", val)
      sub(/^"/, "", val)
      sub(/"$/, "", val)
      print val
      exit
    }
  ' "$toml"
}

run_phase() {
  local name="$1"
  shift
  log_step "$name"
  if "$@" >/tmp/verify-phase.log 2>&1; then
    log_info "$name passed"
    RESULTS+=("$name:pass")
    return 0
  fi
  log_warn "$name failed"
  tail -20 /tmp/verify-phase.log >&2
  RESULTS+=("$name:fail")
  FAILED=1
  return 1
}

main() {
  local stack=""
  local keep=0

  while [[ $# -gt 0 ]]; do
    case "$1" in
    -h | --help) show_help ;;
    --keep)
      keep=1
      shift
      ;;
    -*)
      log_error "Unknown option: $1"
      ;;
    *)
      if [ -z "$stack" ]; then
        stack="$1"
        shift
      else
        log_error "Unexpected argument: $1"
      fi
      ;;
    esac
  done

  [ -z "$stack" ] && log_error "Stack required. See --help."

  export CI=1

  if is_tooling_stack_excluded "$stack"; then
    log_error "Stack '$stack' is excluded from tooling."
  fi

  local manifest="$PROJECT_ROOT/tooling/$stack/manifest.toml"
  [ ! -f "$manifest" ] && log_error "No manifest at $manifest"

  local scaffold
  scaffold=$(read_manifest_field "$manifest" "stack" "scaffold")
  [ -z "$scaffold" ] && log_error "Stack '$stack' has no scaffold command in manifest."

  local prepare
  prepare=$(read_manifest_field "$manifest" "verify" "prepare")

  open_timeline "canon tooling verify $stack"
  trap close_timeline EXIT

  local tmp_root="$PROJECT_ROOT/.canon/tmp/runs"
  local tmp_dir="$tmp_root/verify-$stack"

  mkdir -p "$tmp_root"
  rm -rf "$tmp_dir"

  local project_name="verify-$stack"
  local scaffold_cmd="${scaffold//\{\{name\}\}/$project_name}"

  RESULTS=()
  FAILED=0

  log_step "Scaffolding $stack"
  (cd "$tmp_root" && eval "$scaffold_cmd") >/tmp/verify-scaffold.log 2>&1 || {
    log_warn "Scaffold failed"
    tail -20 /tmp/verify-scaffold.log >&2
    FAILED=1
  }

  if [ ! -d "$tmp_dir" ]; then
    log_error "Scaffold did not produce $tmp_dir"
  fi

  (cd "$tmp_dir" && git init -q && git add . && git commit -m "chore: verify scaffold" -q --no-verify)

  if [ -n "$prepare" ]; then
    run_phase "Prepare" bash -c "cd '$tmp_dir' && $prepare"
  fi

  log_info "Sync resolves via bun $PROJECT_ROOT/src/cli.ts, not PATH canon"
  run_phase "Sync" bash -c "cd '$tmp_dir' && CANON_NON_INTERACTIVE=1 bun '$PROJECT_ROOT/src/cli.ts' tooling sync $stack . --write"

  if [ -f "$tmp_dir/package.json" ]; then
    run_phase "lint:fix" bash -c "cd '$tmp_dir' && bun run lint:fix"
    run_phase "check" bash -c "cd '$tmp_dir' && bun run check"

    if grep -q '"test:e2e"' "$tmp_dir/package.json"; then
      run_phase "test:e2e" bash -c "cd '$tmp_dir' && bun run test:e2e"
    fi

    if grep -q '"screenshot"' "$tmp_dir/package.json"; then
      if run_phase "screenshot" bash -c "cd '$tmp_dir' && timeout 60 bun run screenshot"; then
        local shots
        shots=$(find "$tmp_dir/screenshots" -type f -name '*.png' 2>/dev/null | wc -l)
        if [ "$shots" -eq 0 ]; then
          log_warn "screenshot produced no png files"
          RESULTS+=("screenshot-artifacts:fail")
          FAILED=1
        else
          RESULTS+=("screenshot-artifacts:pass")
        fi
      fi
    fi
  fi

  log_step "Results"
  for r in "${RESULTS[@]}"; do
    local name="${r%:*}"
    local status="${r##*:}"
    if [ "$status" = "pass" ]; then
      log_info "$name"
    else
      log_warn "$name"
    fi
  done

  if [ "$keep" -eq 0 ] && [ "$FAILED" -eq 0 ]; then
    rm -rf "$tmp_dir"
  else
    log_info "Kept $tmp_dir"
  fi

  if [ "$FAILED" -ne 0 ]; then
    exit 1
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
