#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  log_info "matched-plan : branch foo + matching plan, skill picks foo without prompting"
  log_info "multi-plan   : default branch + two plans, skill falls to tier 3 and asks which plan"
  log_info "branch-only  : branch bar + no plans, skill uses bar"
  log_info "typed-branch : branch feat/baz + matching plan, target collides and the skill stops before entry"
  log_info "no-deps      : branch qux + matching plan + a manifest with nothing installed, skill reports the install command"
  log_info "dual-root    : branch quux + matching plan + both a node and a python manifest, skill reports both independently"
  log_info "port-offset  : branch corge + matching plan + the port helper installed, skill reports a derived offset"
  log_info "submodule    : run from inside the submodule, skill stops and names the superproject"
  log_info "submodule-root: the same tree run from the superproject root, skill proceeds"
  select_or_route_scenario "Which scenario?" "matched-plan" "multi-plan" "branch-only" "typed-branch" "no-deps" "dual-root" "port-offset" "submodule" "submodule-root"

  mkdir -p .canon/plans

  case "$SELECTED_OPTION" in
  "matched-plan")
    stage_fixtures claude session-worktree matched-plan 01-plan

    git add . && git commit -m "feat(plans): seed foo plan" --no-verify -q
    git checkout -b foo -q

    log_step "Scenario ready: matched-plan tier (Step 2, tier 1)"
    log_info "Branch: foo"
    log_info "Plan:   .canon/plans/feature-foo.md"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  skill derives foo from tier 1, no prompt"
    log_info "         worktree at .claude/worktrees/foo/, branch feat/foo post-rename"
    ;;
  "multi-plan")
    stage_fixtures claude session-worktree multi-plan 01-plan

    git add . && git commit -m "feat(plans): seed alpha and bravo plans" --no-verify -q

    log_step "Scenario ready: multi-plan tier (Step 2, tier 3)"
    log_info "Branch: default"
    log_info "Plans:  feature-alpha.md, feature-bravo.md"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  skill falls to tier 3 and asks which plan"
    log_info "         respond with alpha or bravo to pick the slug"
    ;;
  "branch-only")
    git checkout -b bar -q

    log_step "Scenario ready: branch-only tier (Step 2, tier 4)"
    log_info "Branch: bar"
    log_info "Plans:  none"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  skill falls to tier 4 and uses bar"
    log_info "         worktree at .claude/worktrees/bar/, branch feat/bar post-rename"
    ;;
  "typed-branch")
    stage_fixtures claude session-worktree typed-branch 01-plan

    git add . && git commit -m "feat(plans): seed baz plan" --no-verify -q
    git checkout -b feat/baz -q

    log_step "Scenario ready: target collision (Step 2)"
    log_info "Branch: feat/baz"
    log_info "Plan:   .canon/plans/feature-baz.md"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  slug transform drops the type, so tier 1 derives baz"
    log_info "         target feat/baz already exists, so Step 2 stops"
    log_info "         no worktree is created and the existing branch is left alone"
    ;;
  "no-deps")
    stage_fixtures claude session-worktree no-deps 01-plan

    git add . && git commit -m "feat(plans): seed qux plan and manifest" --no-verify -q
    git checkout -b qux -q

    log_step "Scenario ready: dependency report (Step 6)"
    log_info "Branch: qux"
    log_info "Plan:   .canon/plans/feature-qux.md"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  entry proceeds, then Step 6 reports two lines"
    log_info "         package.json present and node_modules missing, so it names bun install"
    log_info "         no scripts/worktree-port.sh here, so the port line names the stack default"
    log_info "         nothing is installed, since the step reports rather than runs"
    ;;
  "dual-root")
    stage_fixtures claude session-worktree dual-root 01-plan

    git add . && git commit -m "feat(plans): seed quux plan and both manifests" --no-verify -q
    git checkout -b quux -q

    log_step "Scenario ready: dual-root dependency report (Step 6)"
    log_info "Branch: quux"
    log_info "Plan:   .canon/plans/feature-quux.md"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  entry proceeds, then Step 6 reports both ecosystems"
    log_info "         package.json present and node_modules missing, so it names bun install"
    log_info "         pyproject.toml present and .venv missing, so it names the missing virtual environment"
    log_info "         no scripts/worktree-port.sh here, so the port line names the stack default"
    log_info "Headless: sandbox/run.sh claude:session-worktree \"/canon:session-worktree\" dual-root"
    ;;
  "port-offset")
    stage_fixtures claude session-worktree port-offset 01-plan

    mkdir -p scripts
    cp "$PROJECT_ROOT/tooling/web/configs/scripts/worktree-port.sh" scripts/worktree-port.sh
    chmod +x scripts/worktree-port.sh
    echo ".claude/worktrees/" >>.gitignore

    git add . && git commit -m "feat(scripts): seed corge plan and the port helper" --no-verify -q
    git checkout -b corge -q

    # A folder left behind after its worktree was removed, which is the state
    # the helper refuses. It is a sibling rather than the entry target, since
    # Step 4 registers whatever it creates and a fresh entry never lands on one.
    stage_fixtures claude session-worktree port-offset 02-stale

    log_step "Scenario ready: port report (Step 6)"
    log_info "Branch: corge"
    log_info "Plan:   .canon/plans/feature-corge.md"
    log_info "Action:  /canon:session-worktree"
    log_info "Expect:  declared in fixtures/claude/session-worktree/port-offset/expect.toml"
    ;;
  "submodule" | "submodule-root")
    stage_fixtures claude session-worktree shared 01-plan

    # The origin the submodule is added from stays on disk for later fetches
    # and is ignored, since an untracked nested repository inside the fixture
    # shows up in every status read and enters the index as a gitlink on the
    # next git add.
    echo ".sandbox-submodule-origin/" >>.gitignore

    git add . && git commit -m "feat(plans): seed grault plan" --no-verify -q
    git checkout -b grault -q

    # An absorbed submodule returns one identical path from --git-dir and
    # --git-common-dir, so the linked-worktree guard passes here and the
    # superproject read is the only one that separates the two states.
    git init -q .sandbox-submodule-origin
    git -C .sandbox-submodule-origin config user.email sandbox@example.com
    git -C .sandbox-submodule-origin config user.name Sandbox
    echo 'export const VALUE = 1;' >.sandbox-submodule-origin/lib.js
    git -C .sandbox-submodule-origin add -A
    git -C .sandbox-submodule-origin commit -m "chore(lib): init" -q

    git -c protocol.file.allow=always submodule add -q ./.sandbox-submodule-origin vendor
    git commit -m "chore(vendor): add submodule" --no-verify -q

    # Both arms stage one tree and differ only in where the session is told to
    # run. The expectation format carries no prompt field, so each arm's
    # `expect.toml` names the prompt it was written against and the two would
    # silently swap verdicts if a caller crossed them.
    if [ "$SELECTED_OPTION" = "submodule" ]; then
      log_step "Scenario ready: submodule guard (Guards)"
      log_info "Branch: grault"
      log_info "Plan:   .canon/plans/feature-grault.md at the superproject root"
      log_info "Action:  cd vendor, then /canon:session-worktree"
      log_info "Expect:  both rev-parse reads return one path, so the linked-worktree guard passes"
      log_info "         the superproject read resolves, so the skill stops and names this root"
      log_info "         no worktree is created and no .claude/ is written under vendor"
      log_info "Headless: sandbox/run.sh claude:session-worktree \"cd vendor, then /canon:session-worktree\" submodule"
    else
      log_step "Scenario ready: submodule control (Guards)"
      log_info "Branch: grault"
      log_info "Plan:   .canon/plans/feature-grault.md at the superproject root"
      log_info "Action:  /canon:session-worktree from this root"
      log_info "Expect:  the superproject read is empty here, so the guard stays silent"
      log_info "         entry derives grault from the plan and creates the worktree"
      log_info "Headless: sandbox/run.sh claude:session-worktree \"/canon:session-worktree\" submodule-root"
    fi
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac

  log_info ""
  log_info "Cleanup: run 'canon sandbox clean' after the test to wipe the worktree and its branch refs."
}
