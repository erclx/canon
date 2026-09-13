#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "fresh" "no-stack" "vite-react" "astro"

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

    log_step "Scenario ready: setup-init skill on an empty repo"
    log_info "Context: package.json only, no framework evidence"
    log_info "Action:  /canon:setup-init"
    log_info "Expect:  stack resolves to 'base' and the preview marks it a fallback, canon init lands .claude/rules/ and stamps canon/config/config.json, tooling sync is skipped (tooling stack also 'base' = already synced), setup-verify finds no stack scripts and reports base scripts only, setup-indexes then runs as step 5 and finds no candidate folder on the empty tree, and the report names repo-metadata and git-commit as outside the chain"
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

    log_step "Scenario ready: setup-init skill on a language with no stack"
    log_info "Context: go.mod and main.go, no package.json and no JavaScript evidence"
    log_info "Action:  /canon:setup-init"
    log_info "Expect:  both stacks resolve to 'base' and the preview marks each a fallback, naming what lands with no package.json present: configs, seeds, and gitignore entries, but no dev dependencies, scripts, or hook activation. The chain runs on that default rather than stopping, and names setup-gov as where a project declining it takes the language-neutral rule layer. setup-indexes runs as step 5 and finds no candidate folder, and the report names repo-metadata and git-commit as outside the chain."
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

    log_step "Scenario ready: setup-init skill on a Vite + React project"
    log_info "Context: real bunx create-vite output (index.html, public/, src/App.tsx, src/index.css)"
    log_info "Action:  /canon:setup-init"
    log_info "Expect:  governance stack 'react', tooling stack 'vite-react', canon init lands .claude/rules/, tooling sync drops golden configs from tooling/web and tooling/vite-react, setup-verify runs lint/typecheck/check/test/build, setup-indexes then runs as step 5 over the scaffold's own docs, and the report names repo-metadata and git-commit as outside the chain"
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

    log_step "Scenario ready: setup-init skill on an Astro project"
    log_info "Context: real bunx create-astro output (src/pages, astro.config.mjs, tsconfig.json)"
    log_info "Action:  /canon:setup-init"
    log_info "Expect:  governance stack 'astro', tooling stack 'astro', canon init lands .claude/rules/, tooling sync drops golden configs from tooling/web and tooling/astro, setup-verify runs lint/typecheck/check/test/build, setup-indexes then runs as step 5 over the scaffold's own docs, and the report names repo-metadata and git-commit as outside the chain"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
