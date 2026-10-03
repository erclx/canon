#!/usr/bin/env bash
set -e

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" \
    "docs-fits-category" "docs-fits-none" "docs-already-covered" \
    "wiki-new-subject" "wiki-project-owned" "wiki-already-covered" \
    "readme-none" "readme-scaffold" "readme-authored" "readme-web-project"

  case "$SELECTED_OPTION" in
  docs-*) stage_fixtures docs draft-doc docs-shared catalog && git add . && git commit -m "docs(agents): seed a populated governance catalog" -q ;;
  wiki-*) stage_fixtures docs draft-doc wiki-shared catalog && git add . && git commit -m "docs(wiki): seed a populated wiki catalog" -q ;;
  readme-*)
    mkdir -p src
    stage_fixtures docs draft-doc readme-shared package
    ;;
  esac
  case "$SELECTED_OPTION" in
  "docs-fits-category")
    log_step "Scenario ready: page fits an existing category"
    log_info "Context: docs/agents/governance.md sits on the Governance shelf"
    log_info "Action:  /canon:draft-doc add a docs page documenting the gov audit command"
    log_info "Expect:  drafted at docs/agents/<slug>.md, category: Governance, confirmed before write"
    ;;
  "docs-fits-none")
    log_step "Scenario ready: page fits no existing category"
    log_info "Context: no catalog shelf covers a brand-new domain"
    log_info "Action:  /canon:draft-doc add a docs page documenting the new capture pipeline"
    log_info "Expect:  drafted at docs/<slug>.md, at the flat root, confirmed before write"
    ;;
  "docs-already-covered")
    log_step "Scenario ready: topic already has a page"
    log_info "Context: docs/agents/governance.md already documents the gov CLI"
    log_info "Action:  /canon:draft-doc add a docs page for the governance CLI"
    log_info "Expect:  refuses toward /canon:docs-sync, since docs/agents/governance.md already covers it"
    ;;
  "wiki-new-subject")
    log_step "Scenario ready: subject passes both placement tests"
    log_info "Context: the catalog holds one page and nothing covers subagents"
    log_info "Action:  /canon:draft-doc write a wiki page for Claude Code subagents"
    log_info "Expect:  drafted at wiki/claude/subagents.md, sourced through claude-code-guide rather than recall, confirmed before write"
    ;;
  "wiki-project-owned")
    log_step "Scenario ready: subject fails the first placement test"
    log_info "Context: the sandbox scenario runner is this project's own surface"
    log_info "Action:  /canon:draft-doc write a wiki page for how our sandbox scenarios work"
    log_info "Expect:  refuses on the ownership test, offering the docs or context kind of draft-doc rather than drafting"
    ;;
  "wiki-already-covered")
    log_step "Scenario ready: subject already has a page"
    log_info "Context: wiki/claude/hooks.md already documents the hook events"
    log_info "Action:  /canon:draft-doc add a wiki page about PreToolUse and PostToolUse events"
    log_info "Expect:  refuses on the catalog read, since hooks.md covers it under a different slug"
    ;;
  "readme-none")
    git add . && git commit -m "chore: seed a CLI package with no README" -q
    log_step "Scenario ready: no README exists"
    log_info "Context: package.json declares a bin entry, no README.md anywhere"
    log_info "Action:  /canon:draft-doc write the project README"
    log_info "Expect:  drafted at README.md from the CLI template, confirmed before write"
    ;;
  "readme-scaffold")
    stage_fixtures docs draft-doc readme-scaffold 01-readme
    git add . && git commit -m "chore: seed a scaffold-written README" -q
    log_step "Scenario ready: README is unedited scaffold output"
    log_info "Context: README.md carries no H1 and only the generator's own headings"
    log_info "Action:  /canon:draft-doc write the project README"
    log_info "Expect:  drafts over the scaffold page rather than refusing toward docs-sync"
    ;;
  "readme-authored")
    stage_fixtures docs draft-doc readme-authored 01-readme
    git add . && git commit -m "chore: seed an authored README" -q
    log_step "Scenario ready: README is already authored"
    log_info "Context: README.md carries an H1 naming the project"
    log_info "Action:  /canon:draft-doc write the project README"
    log_info "Expect:  refuses toward /canon:docs-sync, since README.md already covers the project"
    ;;
  "readme-web-project")
    mkdir -p public
    stage_fixtures docs draft-doc readme-web-project 01-site-package
    printf '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30"/></svg>\n' >public/logo.svg
    printf '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#eee"/></svg>\n' >public/screenshot.svg
    git add . && git commit -m "chore: seed a site project with a mark and a product image" -q
    log_step "Scenario ready: a project with a page, a mark, and a product image"
    log_info "Context: package.json declares a site framework and a homepage, public/ holds logo.svg and screenshot.svg"
    log_info "Action:  /canon:draft-doc write the project README"
    log_info "Expect:  drafted from the application template, header fills mark, title, claim, live link, and screenshot, each read off the repository"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
