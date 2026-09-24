#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export PROJECT_ROOT

source "$PROJECT_ROOT/scripts/config.sh"
source "$PROJECT_ROOT/scripts/lib/ui.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-path.sh"
source "$PROJECT_ROOT/scripts/lib/sandbox-dispatch.sh"

# The agent pushes from inside the sandbox on its own, in a session this script
# spawns, so the guard has to reach that environment and not only provisioning.
export GIT_TERMINAL_PROMPT=0

MODEL="${CANON_SKILL_TEST_MODEL:-sonnet}"
ALLOWED_TOOLS="${CANON_SKILL_TEST_TOOLS:-Bash,Read,Glob,Grep,Edit,Write}"
# The only budget. `max_turns` in an arm's `expect.toml` is a ceiling asserted
# after the run, not a cap enforced during it, so a declaration cannot raise what
# it runs under. An arm needing more than this truncates, and a truncated run
# fails the same assertions a reasoning miss does with nothing to separate them.
MAX_TURNS="${CANON_SKILL_TEST_MAX_TURNS:-30}"

# `bypassPermissions` is the only mode that lets a run write under `.claude/`,
# which most arms need. The scoping the permission layer would have given comes
# from `write_scope` instead, asserted after the run rather than enforced during
# it, so a skill that writes where it should not still wrote there.
PERMISSION_MODE="${CANON_SKILL_TEST_PERMISSION_MODE:-bypassPermissions}"

# Records `hash<TAB>path` per file so the post-run comparison can name what the
# session wrote. A diff against `refs/sandbox/baseline` cannot stand in for this:
# an arm that sets SANDBOX_SKIP_AUTO_COMMIT leaves its last stage uncommitted, so
# the fixtures the harness staged would read as session writes.
snapshot_tree() {
  local dir="$1"
  local manifest="$2"
  (cd "$dir" && find . -type f -not -path "./.git/*" -exec sha1sum {} +) |
    sed "s|\./||" | sort -k2 >"$manifest"
}

# Reports both sides of a change, so a deletion is a write. Emitting only the
# after side would let a file removed outside the declared scope produce no
# assertion at all, which is the one way this check stayed weaker than the
# permission scoping it replaced. A modified file appears on both sides and
# collapses to one path once the hash field is stripped.
#
# `diff` exits 1 when the manifests differ, which is the normal case, so the
# pipeline swallows it or `set -e` kills the run before the verdict prints.
writes_between() {
  local before="$1"
  local after="$2"
  { diff --unchanged-group-format="" --old-group-format="%<" \
    --new-group-format="%>" --changed-group-format="%<%>" \
    "$before" "$after" || true; } |
    awk '{ $1=""; sub(/^ /, ""); print }' | sort -u
}

# The roots a run must not write shared session scratch to. `snapshot_tree` reads
# the sandbox alone, so before this a session that resolved that scratch against
# a toolkit root wrote where no manifest looked: the run reported success, the
# write list came back empty, and `write_scope` had nothing to assert against.
#
# It makes an escape visible rather than impossible. A session can write to a
# home directory, to a sibling worktree, or to any path outside these roots, and
# none of that is watched. The standing limits in
# `canon/context/sandbox/overview.md` carry what stays invisible.
escape_roots() {
  printf '%s\n' "$PROJECT_ROOT"

  # A linked worktree is the normal place to develop this repository, and the
  # rule an escaping session follows sends scratch to the main root rather than to
  # the worktree it was launched from. Watching only `$PROJECT_ROOT` would miss
  # the escape in exactly the case it was measured in.
  local main_root
  main_root="$(git -C "$PROJECT_ROOT" worktree list --porcelain 2>/dev/null |
    grep -m 1 '^worktree ' | cut -d' ' -f2-)"
  if [ -n "$main_root" ] && [ "$main_root" != "$PROJECT_ROOT" ]; then
    printf '%s\n' "$main_root"
  fi

  return 0
}

# The four directories the seed's shared-scratch rule names, and the whole of
# where an escape lands. A session that resolves that rule against a toolkit root
# writes here and nowhere else, so watching these rather than the whole root
# costs no detection.
#
# It buys the difference between a signal and noise. Nothing distinguishes the
# spawned session's writes from the operator's own, so a watch over the whole
# root reports ordinary editing during a run as an escape. Measured 2026-08-02:
# three runs against the relocated sandbox all wrote their report to the right
# place, and two of the three still reported an escape under the wide watch,
# naming a context entry being edited in the session that launched them.
# Narrowing to these four leaves the report readable without discarding any
# destination the failure reaches.
ESCAPE_SCRATCH_DIRS=(.canon/plans .canon/review .canon/memory .canon/tasks)

# The scope stated for an arm author rather than left to infer from the name
# above. `escape_roots` times two, `ESCAPE_SCRATCH_DIRS` times four: this watch
# reaches nothing past those eight destinations, so a nested run's own escape,
# such as a live session record `canon sandbox check` cannot see, is invisible
# here whether or not an arm declares `escape_scope`.
#
# A nested background dispatch is the one such escape this run now reports, and
# it reports through `sessions` rather than through here. Folding a process fact
# into a key defined against a file-write watch would make it mean two things and
# would silently widen the empty declaration `claude:canon-rollout` already
# carries into covering something it was not written for.
#
# An arm whose skill is meant to reach past the sandbox tree declares
# `escape_scope` in its `expect.toml`, a set of globs matched against this
# watch's own findings the way `write_scope` matches the write list. A declared
# scope turns what was an unattributed warning into a mechanical result: a
# write matching a glob passes as expected, anything else fails, and `claude:
# canon-rollout` is the first arm to declare one, at an empty list, since its
# only tested path is the refusal that must leave this watch's roots untouched.
#
# It bounds a legitimate write, not the run. Nothing here stops a session from
# writing outside these eight destinations, and nothing separates this run's
# writes from a sibling's within them, so a scoped pass says the declared
# destinations held and nothing more. Read `canon/context/sandbox/isolation.md`
# and `canon/context/sandbox/coverage/arms.md` before writing a claim past that.

# Set whenever any watched root holds at least one of the four directories,
# across every call this run makes. A root with none of them contributes no
# manifest and no diff, which reads identically to a watch that ran clean, so
# `checkEscapeScope` needs this to tell "watched and clean" from "nothing to
# watch" apart.
escape_watched=0

snapshot_root() {
  local dir="$1"
  local manifest="$2"

  local -a targets=()
  local sub
  for sub in "${ESCAPE_SCRATCH_DIRS[@]}"; do
    [ -d "$dir/$sub" ] && targets+=("./$sub")
  done

  : >"$manifest"
  [ ${#targets[@]} -eq 0 ] && return 0
  escape_watched=1

  (cd "$dir" && find "${targets[@]}" -type f -exec sha1sum {} +) |
    sed "s|\./||" | sort -k2 >"$manifest"
}

# Keeps what re-scoring needs. `canon sandbox check` recovers the tree assertions
# from surviving sandbox state, but `max_turns` reads the envelope and
# `write_scope` reads the writes list, both of which die with the temp files.
#
# Writes to stderr and disk only, since `docs/agents/output-shape.md` makes stdout the data
# contract, so a failure here warns and lets the verdict print regardless.
record_run() {
  local target="$1"
  local scenario="$2"
  local merged="$3"
  local writes="$4"

  local runs_dir record stamp
  runs_dir="$PROJECT_ROOT/.canon/tmp/runs/sandbox"
  stamp="$(date +%Y%m%dT%H%M%S)"
  record="$runs_dir/$(printf '%s' "${target}${scenario:+-$scenario}" | tr ':' '-')-$stamp.json"

  if ! mkdir -p "$runs_dir" 2>/dev/null; then
    log_warn "Could not create $runs_dir. The run was not recorded."
    return 0
  fi

  if printf '%s' "$merged" |
    jq --argjson writes "$(jq -R -s 'split("\n") | map(select(length > 0))' "$writes")" \
      '. + {writes: $writes}' >"$record" 2>/dev/null; then
    log_info "Run recorded at ${record#"$PROJECT_ROOT"/}"
  else
    rm -f "$record"
    log_warn "Could not record the run at $record."
  fi
}

# The record `record_run` never gets to write. A session that exits non-zero
# takes the branch that logs and exits before the JSON parse `record_run`'s
# caller runs, so the reason sat in a shell variable nothing persisted and
# recovering it meant re-invoking the session by hand against the same
# already-provisioned tree. `$out` is stamped as text rather than as a parsed
# envelope, since a dying session's stdout can be partial or not JSON at all,
# which is exactly why this run has no verdict to attach it to.
record_dead_run() {
  local target="$1"
  local scenario="$2"
  local exit_code="$3"
  local raw_output="$4"

  local runs_dir record stamp
  runs_dir="$PROJECT_ROOT/.canon/tmp/runs/sandbox"
  stamp="$(date +%Y%m%dT%H%M%S)"
  record="$runs_dir/$(printf '%s' "${target}${scenario:+-$scenario}" | tr ':' '-')-$stamp.json"

  if ! mkdir -p "$runs_dir" 2>/dev/null; then
    log_warn "Could not create $runs_dir. The dead run was not recorded."
    return 0
  fi

  if jq -n --argjson code "$exit_code" --arg raw "$raw_output" \
    '{is_error: true, exit_code: $code, raw_output: $raw}' \
    >"$record" 2>/dev/null; then
    log_info "Dead run recorded at ${record#"$PROJECT_ROOT"/}"
  else
    rm -f "$record"
    log_warn "Could not record the dead run at $record."
  fi
}

# The one place that decides whether a group is safe to signal, so the ordinary
# path and the trap below cannot disagree about it. Sets `reap_state` for the
# merged record and reports on stderr, and runs at most once per run.
#
# Every read is guarded because the trap can fire before the session started, or
# before `main` declared any of these. An absent group is `no-session` rather
# than a clean reap, since the two mean opposite things.
reap_session_group() {
  if [ "${reap_done:-0}" -eq 1 ]; then
    return 0
  fi
  reap_done=1

  if [ -z "${session_pgid:-}" ]; then
    reap_state=no-session
    return 0
  fi

  if [ "$session_pgid" = "${harness_pgid:-}" ]; then
    reap_state=inherited
    log_warn "The session ran in this shell's own process group, so nothing was signalled."
    return 0
  fi

  reap_state="$(reap_process_group "$session_pgid")"

  case "$reap_state" in
  reaped-term | reaped-kill)
    log_warn "The session left a process behind. Reaped its group ($reap_state)."
    ;;
  survived)
    log_warn "A process in the session's group survived SIGKILL. Check pgid $session_pgid by hand."
    ;;
  refused-own-group)
    log_warn "The reap refused a group matching this shell's own. Nothing was signalled."
    ;;
  esac
  return 0
}

# Reaps and cleans up on every path out of `main`, which is what the ordinary
# path alone could not do. A session that dispatches a child and then exits
# non-zero is the ordinary shape of a run going wrong, and before this it took an
# early exit that never reached the reap, leaving the child running. The trap
# also collects the shim directory on any `set -e` failure between the install
# and the verdict.
run_cleanup() {
  reap_session_group

  if [ -n "${shim_dir:-}" ]; then
    rm -rf "$shim_dir"
    shim_dir=""
  fi

  close_timeline
}

show_help() {
  echo -e "${GREY}┌${NC}"
  echo -e "${GREY}├${NC} ${WHITE}Usage:${NC} run.sh <cat:cmd> <prompt> [scenario]"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Arguments:${NC}"
  echo -e "${GREY}│${NC}    cat:cmd   ${GREY}# Scenario to provision (e.g. git:commit)${NC}"
  echo -e "${GREY}│${NC}    prompt    ${GREY}# Skill invocation (e.g. \"/canon:git-commit\")${NC}"
  echo -e "${GREY}│${NC}    scenario  ${GREY}# Optional named scenario arm${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Env overrides:${NC}"
  echo -e "${GREY}│${NC}    CANON_SKILL_TEST_MODEL      ${GREY}# default sonnet${NC}"
  echo -e "${GREY}│${NC}    CANON_SKILL_TEST_TOOLS      ${GREY}# default Bash,Read,Glob,Grep,Edit,Write${NC}"
  echo -e "${GREY}│${NC}    CANON_SKILL_TEST_MAX_TURNS  ${GREY}# default 30${NC}"
  echo -e "${GREY}│${NC}    CANON_SKILL_TEST_PERMISSION_MODE ${GREY}# default bypassPermissions${NC}"
  echo -e "${GREY}│${NC}"
  echo -e "${GREY}│${NC}  ${WHITE}Examples:${NC}"
  echo -e "${GREY}│${NC}    run.sh git:commit \"/canon:git-commit\""
  echo -e "${GREY}│${NC}    run.sh claude:plan-feature \"/canon:plan-feature add a widget\" small"
  echo -e "${GREY}└${NC}"
  exit 0
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || -z "${1:-}" ]]; then
    show_help
  fi

  open_timeline "canon skill-test"
  trap run_cleanup EXIT

  # Declared here rather than where they are first written, so the trap reads
  # them under `main`'s own scope on every path out, including one taken before
  # the session started.
  local reap_state=no-session reap_done=0 shim_dir="" session_pgid="" harness_pgid=""

  if [[ "$PWD" != "$PROJECT_ROOT"* ]]; then
    log_error "Run this from inside the toolkit repository."
  fi
  command -v claude >/dev/null 2>&1 || log_error "claude CLI not found on PATH."

  local target="$1"
  local prompt="${2:-}"
  local scenario="${3:-}"

  [[ "$target" != *":"* ]] && log_error "Invalid target. Use <category>:<command>, e.g. git:commit."
  [ -z "$prompt" ] && log_error "Missing prompt. Pass the skill invocation, e.g. \"/canon:git-commit\"."

  # Minted here, in this shell rather than inside a `$(...)` capture, so the
  # export survives into the two children below: manage-sandbox.sh resolves
  # the same tree during provisioning, and the `sandbox check` at the end
  # resolves it again to score what that provisioning produced.
  mint_sandbox_run_id

  local sandbox
  sandbox="$(resolve_sandbox_dir)"
  log_step "Sandbox: $sandbox"

  log_step "Provisioning $target"
  local provision_code=0
  bash "$PROJECT_ROOT/scripts/manage-sandbox.sh" --no-header "$target" "$scenario" >&2 || provision_code=$?
  if [ "$provision_code" -ne 0 ]; then
    log_warn "Provisioning exited $provision_code before the session could start."
    exit "$provision_code"
  fi

  local before after envelope writes escapes
  before="$(mktemp)"
  after="$(mktemp)"
  envelope="$(mktemp)"
  writes="$(mktemp)"
  escapes="$(mktemp)"
  snapshot_tree "$sandbox" "$before"

  local -a escape_dirs=() escape_manifests=()
  local root manifest
  while IFS= read -r root; do
    [ -d "$root" ] || continue
    manifest="$(mktemp)"
    snapshot_root "$root" "$manifest"
    escape_dirs+=("$root")
    escape_manifests+=("$manifest")
  done < <(escape_roots)

  # Taken after provisioning, so a scenario that stages a live session record of
  # its own is already in the before manifest rather than reported as a dispatch
  # this run made. `canon/context/sandbox/isolation.md` carries why such a
  # scenario writes to the real registry at all.
  local sessions_before sessions_after session_records session_concurrent
  sessions_before="$(mktemp)"
  sessions_after="$(mktemp)"
  session_records="$(mktemp)"
  session_concurrent="$(mktemp)"
  snapshot_sessions "$sessions_before"

  # The harness calls the real binary by its resolved path and puts the shim on
  # the PATH the session inherits, so a `claude --bg` from inside the run meets
  # the refusal and this invocation does not. Routing the harness through the
  # shim too was the alternative and it reads the arm's own prompt as arguments,
  # so a prompt naming `--bg` would refuse the run the shim exists to allow.
  local real_claude
  real_claude="$(command -v claude)"
  shim_dir="$(mktemp -d)"
  install_dispatch_shim "$shim_dir" "$real_claude"

  log_step "Running $prompt on $MODEL"

  # Started in a process group of its own, which is what lets the reap after the
  # verdict signal a group this run created rather than the one it inherited from
  # the operator's shell. `set -m` is what puts a background job in its own
  # group, so stdout goes to a file: a command substitution would leave the
  # session in this shell's group and there would be nothing safe to signal.
  # Stdin comes from `/dev/null`, since no command here may wait on a terminal.
  local session_out session_pid session_code=0
  session_out="$(mktemp)"
  set -m
  (
    cd "$sandbox" || exit 1
    export PATH="$shim_dir:$PATH"
    exec "$real_claude" -p "$prompt" \
      --plugin-dir "$PROJECT_ROOT/claude" \
      --model "$MODEL" \
      --output-format json \
      --permission-mode "$PERMISSION_MODE" \
      --allowedTools "$ALLOWED_TOOLS" \
      --max-turns "$MAX_TURNS"
  ) >"$session_out" </dev/null &
  session_pid=$!
  set +m

  # Read rather than assumed. `set -m` makes the job lead a group of its own, so
  # this equals its pid, and a shell where that did not happen would leave the
  # session in the group the harness itself runs in. Comparing the two before
  # signalling is what keeps the reap off the operator's terminal.
  harness_pgid="$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ' || true)"
  session_pgid="$(ps -o pgid= -p "$session_pid" 2>/dev/null | tr -d ' ' || true)"
  [ -n "$session_pgid" ] || session_pgid="$session_pid"

  wait "$session_pid" 2>/dev/null || session_code=$?

  local out
  out="$(cat "$session_out")"
  rm -f "$session_out"

  # `set -e` took this exit for the run while the invocation sat in a command
  # substitution, and a backgrounded job reports through `wait` instead, so the
  # same failure now has to be spelled out or it passes unnoticed. A session that
  # dispatched a child and then died is the ordinary shape of this, so the reap
  # and the shim both go out through the trap rather than being skipped here.
  if [ "$session_code" -ne 0 ]; then
    log_warn "The session exited $session_code before a verdict could be taken."
    record_dead_run "$target" "$scenario" "$session_code" "$out"
    exit "$session_code"
  fi

  local is_error result cost turns denials
  is_error="$(printf '%s' "$out" | jq -r '.is_error' 2>/dev/null || echo "unknown")"
  result="$(printf '%s' "$out" | jq -r '.result' 2>/dev/null || echo "")"
  cost="$(printf '%s' "$out" | jq -r '.total_cost_usd' 2>/dev/null || echo "?")"
  turns="$(printf '%s' "$out" | jq -r '.num_turns' 2>/dev/null || echo "?")"
  denials="$(printf '%s' "$out" | jq -r '.permission_denials | length' 2>/dev/null || echo "?")"

  log_step "Result: error=$is_error turns=$turns cost=\$$cost denials=$denials"
  printf '%s\n' "$result" >&2

  snapshot_tree "$sandbox" "$after"
  writes_between "$before" "$after" >"$writes"
  printf '%s' "$out" >"$envelope"

  # Taken before the verdict runs, since `canon sandbox check` and `record_run`
  # both write under a watched root themselves.
  local index=0 after_manifest
  : >"$escapes"
  for root in "${escape_dirs[@]}"; do
    after_manifest="$(mktemp)"
    snapshot_root "$root" "$after_manifest"
    writes_between "${escape_manifests[$index]}" "$after_manifest" |
      sed "s|^|${root%/}/|" >>"$escapes"
    rm -f "${escape_manifests[$index]}" "$after_manifest"
    index=$((index + 1))
  done

  # Beside the escape snapshot and ahead of the reap, so a session that outlived
  # the run is recorded as what it was before anything signals it.
  local record
  snapshot_sessions "$sessions_after"
  : >"$session_records"
  while IFS= read -r record; do
    [ -n "$record" ] || continue
    describe_session "$record" >>"$session_records"
  done < <(sessions_between "$sessions_before" "$sessions_after")
  : >"$session_concurrent"
  while IFS= read -r record; do
    [ -n "$record" ] || continue
    describe_session "$record" >>"$session_concurrent"
  done < <(sessions_concurrent "$sessions_before" "$sessions_after")
  rm -f "$sessions_before" "$sessions_after"

  # The verdict decides the outcome. The envelope can only fail a run the
  # expectations would otherwise have passed, never pass one on its own.
  local -a watched_flag=()
  [ "$escape_watched" -eq 1 ] && watched_flag=(--escapes-watched)

  local verdict_code=0 verdict_json
  verdict_json="$(bun "$PROJECT_ROOT/src/cli.ts" sandbox check "$target" "$scenario" \
    --envelope "$envelope" --writes "$writes" --escapes "$escapes" \
    --concurrent-sessions "$session_concurrent" \
    "${watched_flag[@]}" --json)" || verdict_code=$?

  # After the verdict, which is the last thing that reads what the run left
  # behind, and ahead of the trap so the outcome reaches the merged record.
  # Nothing here fails the run: a survivor is a fact about the machine rather
  # than a claim about the skill, and the verdict is already taken.
  reap_session_group
  rm -rf "$shim_dir"
  shim_dir=""

  # The envelope stays on stdout so existing readers keep working, with the
  # verdict merged in. An agent reads the verdict here rather than parsing the
  # framed stderr, per the stream contract in `docs/agents/output-shape.md`. A run that
  # returned output that does not parse still emits its verdict rather than both
  # to a jq error, since a silent stdout would read as a run that never happened.
  #
  # An escape rides alongside the verdict rather than inside it. The verdict
  # answers what the sandbox contains, and a file the session put somewhere else
  # is not in that tree to be asserted over.
  #
  # It reports without failing, which is the same relationship `write_scope` has
  # to the writes it names. Nothing here distinguishes the spawned session's
  # writes from the operator's own, and on a machine running parallel sessions
  # the watched directories are rarely quiet: of five runs on 2026-08-02, three
  # reported an escape and every one named a file another session was writing.
  # Failing on that would trade the silence this replaced for a red verdict that
  # says nothing about the skill, which is the flaky arm the whole task exists to
  # avoid. What enforces the scope is that the sandbox now sits outside the
  # repository, so a correct run has nothing to escape with.
  local escapes_json
  escapes_json="$(jq -R -s 'split("\n") | map(select(length > 0))' "$escapes")"

  if [ -s "$escapes" ]; then
    log_warn "Shared scratch changed under a toolkit root during this run:"
    while IFS= read -r path; do
      [ -n "$path" ] && log_rem "$path"
    done <"$escapes"
    if [ -s "$session_concurrent" ]; then
      log_warn "A session was live throughout the run and may account for these:"
      while IFS= read -r record; do
        [ -n "$record" ] && log_rem "$record"
      done <"$session_concurrent"
    fi
    log_warn "No assertion covers these. Check them against what else was running."
  fi

  # One field rather than a second key beside it, so a reader gets the four
  # facts together: whether the registry was there to watch, which records
  # appeared while the run was in flight, which were already running throughout
  # it, and what the reap found. `watched` false means the registry was absent,
  # which makes an empty `new` say nothing at all rather than say the run
  # dispatched nothing.
  #
  # `concurrent` is a witness rather than a verdict. A record present before and
  # after the run rules that session out as this run's own dispatch and rules it
  # in as a candidate explanation for a file `escapes` names with no attribution
  # of its own, never a claim that it, rather than something else, made the
  # write.
  #
  # `reap` carries `clear` for a group that was already empty, `reaped-term` or
  # `reaped-kill` for one this run signalled, `survived` for one that outlived
  # `SIGKILL`, `inherited` for a session that never led a group of its own, and
  # `no-session` for a run that stopped before the session began.
  local sessions_watched_json=false
  if [ "$sessions_watched" -eq 1 ]; then
    sessions_watched_json=true
  fi

  local sessions_json
  sessions_json="$(jq -n \
    --argjson watched "$sessions_watched_json" \
    --argjson new "$(jq -R -s 'split("\n") | map(select(length > 0))' "$session_records")" \
    --argjson concurrent "$(jq -R -s 'split("\n") | map(select(length > 0))' "$session_concurrent")" \
    --arg reap "$reap_state" \
    '{watched: $watched, new: $new, concurrent: $concurrent, reap: $reap}')"

  if [ -s "$session_records" ]; then
    log_warn "A session record appeared while this run was in flight:"
    while IFS= read -r record; do
      [ -n "$record" ] || continue
      log_rem "$record"
    done <"$session_records"
    log_warn "No arm dispatches a session. Read these against what else started."
  fi

  local merged
  if ! merged="$(printf '%s' "$out" |
    jq --argjson verdict "${verdict_json:-null}" \
      --argjson escapes "$escapes_json" \
      --argjson sessions "$sessions_json" \
      '. + {verdict: $verdict, escapes: $escapes, sessions: $sessions}' 2>/dev/null)"; then
    log_warn "Envelope was not valid JSON. Emitting the verdict alone."
    merged="$(printf '{"is_error":true,"verdict":%s,"escapes":%s,"sessions":%s}' \
      "${verdict_json:-null}" "$escapes_json" "$sessions_json")"
    verdict_code=1
  fi

  record_run "$target" "$scenario" "$merged" "$writes"
  rm -f "$before" "$after" "$envelope" "$writes" "$escapes" "$session_records" \
    "$session_concurrent"

  trap - EXIT
  close_timeline

  printf '%s\n' "$merged"

  return "$verdict_code"
}

main "$@"
