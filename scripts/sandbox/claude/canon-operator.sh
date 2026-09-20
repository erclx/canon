#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-fixtures.sh"

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "fresh" "audits" "gitignore" "unclaimed"

  case "$SELECTED_OPTION" in
  "fresh")
    cat <<'EOF' >package.json
{
  "name": "sandbox-operator-fresh",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF
    git add . && git commit -m "chore(sandbox): fresh empty project for canon-operator" --no-verify -q

    log_step "Scenario ready: canon-operator skill on an empty repo"
    log_info "Context: package.json only, toolkit not yet installed"
    log_info "Action:  /canon:canon-operator then 'help me set up this project'"
    log_info "Expect:  orients via canon docs, routes first-time scaffold to setup"
    log_info "Assert:  declared in fixtures/claude/canon-operator/fresh/expect.toml"
    ;;
  "audits")
    mkdir -p canon/context .canon/plans
    cat <<'EOF' >canon/context/billing.md
---
title: Billing
description: Subscription state, the invoice job, and the two retry paths
---

# Billing

## Overview

Subscriptions renew nightly and the invoice job writes one row per renewal.
EOF
    cat <<'EOF' >canon/context/index.md
---
title: Context
description: Per-domain narrative loaded on demand
---

# Context

- [Billing](billing.md): subscription state and the invoice job
EOF
    cat <<'EOF' >.canon/plans/feature-invoice-retry.md
# Feature: Invoice retry

The invoice job drops a renewal when the payment provider times out.

## Summary

- Retry a timed-out renewal once before the job records it as failed.
EOF
    cat <<'EOF' >package.json
{
  "name": "sandbox-operator-audits",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    # The arm scores which audits are offered, so it stages the surfaces two of
    # the four read and none of the surface the third reads. A tree carrying
    # source anywhere would make an offer of every audit indistinguishable from
    # a correct one conditioned on what is present. The test matches the two
    # languages `canon comments scan` measures rather than a conventional source
    # folder, since the offer turns on the files rather than on their location.
    local sources
    sources=$(find . -path ./.git -prune -o -type f \( -name "*.ts" -o -name "*.sh" \) -print | wc -l | tr -d ' ')
    if [ "$sources" -ne 0 ]; then
      log_error "Fixture staged $sources source files. The arm cannot score a comments-scan offer it did not withhold."
      return 1
    fi

    git add . && git commit -m "chore(sandbox): context and plans without source for canon-operator" --no-verify -q

    log_step "Scenario ready: canon-operator skill on a target carrying two of four audit surfaces"
    log_info "Context: canon/context/ and .canon/plans/ present, no TypeScript or shell source"
    log_info "Action:  /canon:canon-operator then 'what can you measure about this project'"
    log_info "Expect:  names the setup handoff, then offers the context and records audits, withholds the comment scan"
    log_info "Assert:  declared in fixtures/claude/canon-operator/audits/expect.toml"
    ;;
  "gitignore")
    cat <<'EOF' >package.json
{
  "name": "sandbox-operator-gitignore",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF
    cp .gitignore .gitignore.pre
    CANON_NON_INTERACTIVE=1 bun "$PROJECT_ROOT/src/cli.ts" tooling inject base . >/dev/null

    # The row this arm scores reads the leaf off the recorded chain. Without the
    # stamp the operator correctly reports the chain as unrecorded, and the
    # failure would read as a defect in the skill rather than in the fixture.
    if ! grep -q '"chain"' canon/config/config.json 2>/dev/null; then
      log_error "Fixture recorded no stack chain. The arm would score a row with nothing to read."
      return 1
    fi

    # Restores the file to what provisioning wrote before the inject, which is
    # the drift the ignore-only mode exists to close. Truncating instead would
    # drop the sandbox's own entries too, leaving `node_modules` tracked. The
    # configs, seeds, and manifest edits stay, so a run reaching for a full sync
    # rewrites more than it was asked to.
    mv .gitignore.pre .gitignore

    git add . && git commit -m "chore(sandbox): stacked project with emptied gitignore for canon-operator" --no-verify -q

    log_step "Scenario ready: canon-operator skill on a stacked project missing its ignore entries"
    log_info "Context: base stack installed and stamped, .gitignore emptied"
    log_info "Action:  /canon:canon-operator then 'my gitignore is missing the toolkit entries'"
    log_info "Expect:  reads base off the recorded chain, routes to canon tooling inject --gitignore"
    log_info "Assert:  declared in fixtures/claude/canon-operator/gitignore/expect.toml"
    ;;
  "unclaimed")
    cat <<'EOF' >package.json
{
  "name": "sandbox-operator-unclaimed",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    # Every section including the reverse walk is gated on `isManagedTarget`,
    # which reads a `.claude/` directory, a `CLAUDE.md`, or an unmigrated domain.
    # This arm stages none of the three on its own, and the `.claude/skills/`
    # tree the harness injects lands after `stage_setup` returns, so the fixture
    # would inherit its managed status from a step that runs only when the branch
    # changed this skill. Kept short, since a file past 250 lines adds a
    # `migration-claude-md` candidate and the arm would score two decisions.
    cat <<'EOF' >CLAUDE.md
# Sandbox operator target

A project with one folder left over from a toolkit root that no longer ships.
EOF

    # The declaration names `prompts`, so the arm takes the preferred root rather
    # than whichever one history offers first. A root that has come back is a
    # live root the forward direction already covers, and the reverse walk would
    # report nothing while every assertion still named the folder.
    local root
    root=$(pick_dropped_root)
    if [ "$root" != "prompts" ]; then
      log_error "prompts/ is a live toolkit root again. The declaration names it, so the arm needs it dropped."
      return 1
    fi

    local staged
    if ! staged=$(restore_dropped_file "$root"); then
      log_error "Could not restore a published file under $root/. The arm would score the unattributed verdict instead."
      return 1
    fi

    # The router reads a field the CLI gained at 0.70.0, and a target on an older
    # binary gets a report with no `reverse` key at all. The run then answers
    # from a filesystem walk of its own, which reaches the same words by a route
    # the arm exists to rule out, so the premise is checked here rather than left
    # to a reply pin that passes either way.
    #
    # The report is captured whole rather than piped into a matcher. `pipefail`
    # is on and a matcher exiting at its first hit closes the pipe while the CLI
    # is still writing, so the pipeline returns SIGPIPE and the guard fires
    # against a report that carries the section.
    local report
    report=$(CANON_NON_INTERACTIVE=1 canon sync --check . --json 2>/dev/null) || true

    # Attribution rather than the bare key, so the guard proves the walk reached
    # the folder just staged instead of proving only that the field exists.
    case "$report" in
    *'"attribution"'*) ;;
    *)
      log_error "The canon on PATH attributes no unclaimed folder. Either the binary predates the reverse walk added at 0.70.0, or the walk ran and did not reach $root/. Check canon --version against the first, and the staged tree against the second."
      return 1
      ;;
    esac

    git add . && git commit -m "chore(sandbox): dropped root staged for canon-operator" --no-verify -q

    log_step "Scenario ready: canon-operator skill on a target holding a root the toolkit dropped"
    log_info "Context: $staged present at the bytes the toolkit published"
    log_info "Action:  /canon:canon-operator then 'what does this project have that the toolkit no longer ships'"
    log_info "Expect:  reports the folder as dropped and leaves the decision to the user, running nothing"
    log_info "Assert:  declared in fixtures/claude/canon-operator/unclaimed/expect.toml"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
