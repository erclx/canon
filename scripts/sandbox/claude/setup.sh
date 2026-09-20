#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "fresh" "no-stack" "vite-react" "astro" "verify-pass" "verify-fail" "smoke-pass" "smoke-fail"

  case "$SELECTED_OPTION" in
  "fresh")
    cat <<'EOF' >package.json
{
  "name": "sandbox-fresh",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    git add . && git commit -m "chore(sandbox): fresh empty project" --no-verify -q

    log_step "Scenario ready: setup skill on an empty repo"
    log_info "Context: package.json only, no framework evidence"
    log_info "Action:  /canon:setup"
    log_info "Expect:  stack resolves to 'base' and the preview marks it a fallback, canon init lands .claude/rules/ and stamps canon/config/config.json, tooling sync is skipped (tooling stack also 'base' = already synced), the verify phase finds no stack scripts and reports base scripts only, the indexes phase then runs and finds no candidate folder on the empty tree, and the report names repo-metadata and git-commit as outside the chain"
    ;;
  "no-stack")
    cat <<'EOF' >go.mod
module example.com/sandbox

go 1.23
EOF

    cat <<'EOF' >main.go
package main

func main() {}
EOF

    git add . && git commit -m "chore(sandbox): go project the toolkit ships no stack for" --no-verify -q

    log_step "Scenario ready: setup skill on a language with no stack"
    log_info "Context: go.mod and main.go, no package.json and no JavaScript evidence"
    log_info "Action:  /canon:setup"
    log_info "Expect:  both stacks resolve to 'base' and the preview marks each a fallback, naming what lands with no package.json present: configs, seeds, and gitignore entries, but no dev dependencies, scripts, or hook activation. The chain runs on that default rather than stopping, and names the gov phase as where a project declining it takes the language-neutral rule layer. The indexes phase runs and finds no candidate folder, and the report names repo-metadata and git-commit as outside the chain."
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
    log_info "Action:  /canon:setup"
    log_info "Expect:  governance stack 'react', tooling stack 'vite-react', canon init lands .claude/rules/, tooling sync drops golden configs from tooling/web and tooling/vite-react, the verify phase runs lint/typecheck/check/test/build, the indexes phase then runs over the scaffold's own docs, and the report names repo-metadata and git-commit as outside the chain"
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
    log_info "Action:  /canon:setup"
    log_info "Expect:  governance stack 'astro', tooling stack 'astro', canon init lands .claude/rules/, tooling sync drops golden configs from tooling/web and tooling/astro, the verify phase runs lint/typecheck/check/test/build, the indexes phase then runs over the scaffold's own docs, and the report names repo-metadata and git-commit as outside the chain"
    ;;
  "verify-pass")
    cat <<'EOF' >package.json
{
  "name": "sandbox-verify-pass",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint:fix": "echo lint ok",
    "typecheck": "echo typecheck ok",
    "check": "echo check ok",
    "test:run": "echo tests ok",
    "build": "echo build ok"
  }
}
EOF

    git add . && git commit -m "chore(sandbox): scaffolded project with passing scripts" --no-verify -q

    log_step "Scenario ready: setup verify phase, happy path"
    log_info "Context: package.json with lint:fix, typecheck, check, test:run, build all echoing ok"
    log_info "Action:  /canon:setup verify"
    log_info "Expect:  five green checks, summary 'Scaffold verified' naming the default depth"
    ;;
  "verify-fail")
    cat <<'EOF' >package.json
{
  "name": "sandbox-verify-fail",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint:fix": "echo lint ok",
    "typecheck": "echo typecheck error >&2 && exit 1",
    "check": "echo check ok",
    "test:run": "echo tests ok",
    "build": "echo build ok"
  }
}
EOF

    git add . && git commit -m "chore(sandbox): scaffolded project with failing typecheck" --no-verify -q

    log_step "Scenario ready: setup verify phase, fail path"
    log_info "Context: package.json with typecheck that exits non-zero"
    log_info "Action:  /canon:setup verify"
    log_info "Expect:  lint passes, typecheck fails, run stops before check/test/build, failing output surfaced"
    ;;
  "smoke-pass")
    cat <<'EOF' >package.json
{
  "name": "sandbox-smoke-pass",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "mkdir -p .smoke && touch .smoke/dev-started && sleep 15",
    "preview": "mkdir -p .smoke && touch .smoke/preview-started && sleep 15",
    "test:e2e": "mkdir -p .smoke && touch .smoke/e2e-ran && echo e2e ok",
    "screenshot": "mkdir -p .smoke && touch .smoke/screenshot-ran && echo screenshot ok"
  }
}
EOF

    git add . && git commit -m "chore(sandbox): scaffolded project with passing smoke scripts" --no-verify -q

    log_step "Scenario ready: setup verify phase at deep depth, happy path"
    log_info "Context: package.json with dev, preview, test:e2e, screenshot all succeeding"
    log_info "Action:  /canon:setup verify deep"
    log_info "Expect:  four green checks, summary 'Scaffold verified' naming the deep depth"
    ;;
  "smoke-fail")
    cat <<'EOF' >package.json
{
  "name": "sandbox-smoke-fail",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "mkdir -p .smoke && touch .smoke/dev-started && sleep 15",
    "preview": "mkdir -p .smoke && touch .smoke/preview-started && sleep 15",
    "test:e2e": "mkdir -p .smoke && touch .smoke/e2e-ran && echo e2e error >&2 && exit 1",
    "screenshot": "mkdir -p .smoke && touch .smoke/screenshot-ran && echo screenshot ok"
  }
}
EOF

    git add . && git commit -m "chore(sandbox): scaffolded project with failing end-to-end suite" --no-verify -q

    log_step "Scenario ready: setup verify phase at deep depth, fail path"
    log_info "Context: package.json with test:e2e exiting non-zero"
    log_info "Action:  /canon:setup verify deep"
    log_info "Expect:  dev and preview pass, test:e2e fails, run stops before screenshot, failing output surfaced"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
