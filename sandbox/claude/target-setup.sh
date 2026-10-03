#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "fresh" "no-stack" "monorepo" "vite-react" "astro" "verify-pass" "verify-fail" "smoke-pass" "smoke-fail"

  case "$SELECTED_OPTION" in
  "fresh")
    stage_fixtures claude target-setup fresh 01-initial

    git add . && git commit -m "chore(sandbox): fresh empty project" --no-verify -q

    log_step "Scenario ready: setup skill on an empty repo"
    log_info "Context: package.json only, no framework evidence"
    log_info "Action:  /canon:target-setup"
    log_info "Expect:  stack resolves to 'base' and the preview marks it a fallback, canon init lands .claude/rules/ and stamps canon/config/config.json, tooling sync is skipped (tooling stack also 'base' = already synced), the verify phase finds no stack scripts and reports base scripts only, the indexes phase then runs and finds no candidate folder on the empty tree, and the report names repo-metadata and git-commit as outside the chain"
    ;;
  "no-stack")
    stage_fixtures claude target-setup no-stack 01-initial

    git add . && git commit -m "chore(sandbox): go project the toolkit ships no governance stack for" --no-verify -q

    log_step "Scenario ready: setup skill on a language with no governance stack"
    log_info "Context: go.mod and main.go, no package.json and no JavaScript evidence"
    log_info "Action:  /canon:target-setup"
    log_info "Expect:  the governance stack resolves to 'base' and the preview marks it a fallback, with the Go language rule passed through --add. The tooling stack resolves to 'go' on a canon whose catalog carries it, and the preview names it with no fallback mark. The chain runs rather than stopping, the indexes phase runs and finds no candidate folder, and the report names repo-metadata and git-commit as outside the chain."
    ;;
  "monorepo")
    stage_fixtures claude target-setup monorepo 01-initial

    git add . && git commit -m "chore(sandbox): monorepo with web, api, and svc language roots" --no-verify -q

    log_step "Scenario ready: setup skill on a monorepo with subfolder language roots"
    log_info "Context: root package.json with no dependencies, web/ holding react and vite, api/pyproject.toml, svc/go.mod"
    log_info "Action:  /canon:target-setup"
    log_info "Expect:  the preview lists one tooling row per language root (web, api, svc) with its path and command, the root row resolving to 'base' with no command of its own. Governance resolves once at the root to 'base' with the React, Python, and Go rules passed through --add. One canon init runs at the root, and each subfolder takes its own tooling sync with --skip base, so no subfolder carries .husky or .github."
    ;;
  "vite-react")
    log_step "Running bun create vite"
    bun create vite@latest _tmp_vite --template react-ts >/dev/null 2>&1
    rm -rf _tmp_vite/.git
    (
      shopt -s dotglob
      mv _tmp_vite/* .
    )
    rmdir _tmp_vite

    git add . && git commit -m "chore(sandbox): vite + react scaffold via bun create vite" --no-verify -q

    log_step "Scenario ready: setup skill on a Vite + React project"
    log_info "Context: real bunx create-vite output (index.html, public/, src/App.tsx, src/index.css)"
    log_info "Action:  /canon:target-setup"
    log_info "Expect:  governance stack 'react', tooling stack 'vite-react', canon init lands .claude/rules/ with 200-react.md and no 230-nextjs.md under .claude/rules/canon/framework/, tooling sync drops golden configs from tooling/web and tooling/vite-react, the verify phase runs lint/typecheck/check/test/build, the indexes phase then runs over the scaffold's own docs, and the report names repo-metadata and git-commit as outside the chain"
    ;;
  "astro")
    log_step "Running bun create astro"
    bun create astro@latest _tmp_astro -- --template minimal --typescript strict --no-install --no-git --skip-houston --yes >/dev/null 2>&1
    rm -rf _tmp_astro/.git
    (
      shopt -s dotglob
      mv _tmp_astro/* .
    )
    rmdir _tmp_astro

    git add . && git commit -m "chore(sandbox): astro scaffold via bun create astro" --no-verify -q

    log_step "Scenario ready: setup skill on an Astro project"
    log_info "Context: real bunx create-astro output (src/pages, astro.config.mjs, tsconfig.json)"
    log_info "Action:  /canon:target-setup"
    log_info "Expect:  governance stack 'astro', tooling stack 'astro', canon init lands .claude/rules/, tooling sync drops golden configs from tooling/web and tooling/astro, the verify phase runs lint/typecheck/check/test/build, the indexes phase then runs over the scaffold's own docs, and the report names repo-metadata and git-commit as outside the chain"
    ;;
  "verify-pass")
    stage_fixtures claude target-setup verify-pass 01-initial

    git add . && git commit -m "chore(sandbox): scaffolded project with passing scripts" --no-verify -q

    log_step "Scenario ready: setup verify phase, happy path"
    log_info "Context: package.json with lint:fix, typecheck, check, test:run, build all echoing ok"
    log_info "Action:  /canon:target-setup verify"
    log_info "Expect:  five green checks, summary 'Scaffold verified' naming the default depth"
    ;;
  "verify-fail")
    stage_fixtures claude target-setup verify-fail 01-initial

    git add . && git commit -m "chore(sandbox): scaffolded project with failing typecheck" --no-verify -q

    log_step "Scenario ready: setup verify phase, fail path"
    log_info "Context: package.json with typecheck that exits non-zero"
    log_info "Action:  /canon:target-setup verify"
    log_info "Expect:  lint passes, typecheck fails, run stops before check/test/build, failing output surfaced"
    ;;
  "smoke-pass")
    stage_fixtures claude target-setup smoke-pass 01-initial

    git add . && git commit -m "chore(sandbox): scaffolded project with passing smoke scripts" --no-verify -q

    log_step "Scenario ready: setup verify phase at deep depth, happy path"
    log_info "Context: package.json with dev, preview, test:e2e, screenshot all succeeding"
    log_info "Action:  /canon:target-setup verify deep"
    log_info "Expect:  four green checks, summary 'Scaffold verified' naming the deep depth"
    ;;
  "smoke-fail")
    stage_fixtures claude target-setup smoke-fail 01-initial

    git add . && git commit -m "chore(sandbox): scaffolded project with failing end-to-end suite" --no-verify -q

    log_step "Scenario ready: setup verify phase at deep depth, fail path"
    log_info "Context: package.json with test:e2e exiting non-zero"
    log_info "Action:  /canon:target-setup verify deep"
    log_info "Expect:  dev and preview pass, test:e2e fails, run stops before screenshot, failing output surfaced"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
