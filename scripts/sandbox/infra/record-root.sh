#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

# A record tree at whichever root the caller names, built by hand so one seeder
# serves both sides of the fallback. The arms below differ only in that argument,
# which is what keeps a difference in outcome attributable to the resolution
# rather than to two fixtures that drifted apart.
#
seed_records() {
  local root=$1 scratch=$2

  mkdir -p "$root/plans/archive" "$root/tasks" "$root/memory" "$root/$scratch"

  cat <<'PLAN' >"$root/plans/feature-live-row.md"
# Feature: A staged plan

One paragraph of intro so the plan carries a body.

## Summary

- One bullet describing the change.

**Files to touch:**

- `src/thing.ts`: the surface this would edit.

**Risks:**

- One risk, stated.

**Questions:**

1. Does this ship here?
   - Suggested: yes, since the fixture needs an answerable question.
   - Answer: yes
PLAN

  cat <<'INDEX' >"$root/tasks/index.md"
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label
INDEX

  cat <<'TASK' >"$root/tasks/v1.1-staged-row.md"
---
title: 'v1.1: A staged row'
description: One line on what this task achieves
---

# v1.1: A staged row

Plan: [../plans/archive/feature-shipped-row.md](../plans/archive/feature-shipped-row.md)

Pull request: #1

## Outcomes

- [x] Outcome: it shipped

## Findings

- A note.
TASK

  # A second plan, already archived, is what the task points at. A live target
  # would have `tasks archive` carry the plan across as well, which moves a file
  # this arm is measuring the root of and answers nothing about where it resolved.
  # The live one beside it is what gives `records validate plans` a record to
  # count, since the walk skips the archive.
  cp "$root/plans/feature-live-row.md" "$root/plans/archive/feature-shipped-row.md"

  printf 'scratch\n' >"$root/$scratch/note.txt"
}

run_cli() {
  local status=0
  bun "$PROJECT_ROOT/src/cli.ts" "$@" || status=$?
  log_info "Exit code: $status"
}

stage_setup() {
  log_step "Record root sandbox"
  log_info "migrated        : records staged at .canon/, every verb resolves there"
  log_info "unmigrated      : the same records at .claude/, the fallback's other branch"
  log_info "refusal         : neither root carries the folder, so both are named"
  log_info "migrate         : the verb moving an unmigrated tree, then re-running clean"
  log_info "migrate-refusal : the same tree with no .canon/ ignore entry to land under"
  log_info "record-tree     : the sweep inside the records, live against archive and trail"
  log_info "records-push    : push and pull across the moved history, and the split-root refusal"

  select_or_route_scenario "Which scenario?" \
    "migrated" "unmigrated" "refusal" "migrate" "migrate-refusal" "record-tree" \
    "records-push"

  case "$SELECTED_OPTION" in
  "migrated")
    seed_records .canon tmp
    log_step "Running: canon records validate plans --root ."
    run_cli records validate plans --root . --json
    log_info "Expect: 1 record read, the live plan under .canon/plans"
    log_info "Expect: ok true rather than a no-folder refusal, which is the resolution"
    log_step "Running: canon records size --root . --json"
    run_cli records size --root . --json
    log_info "Expect: plans, tasks, and memory present, read under .canon/"
    log_info "Expect: the .tmp entry present, read from .canon/tmp"
    log_step "Running: canon tasks archive v1.1-staged-row --root ."
    run_cli tasks archive v1.1-staged-row --root . --json
    log_info "Expect: from and to both spelling .canon/tasks/, not a flat sibling"
    log_step "Reading the tree back"
    # `find` exits non-zero on an absent argument and the scenario runs under
    # `set -o pipefail`, so naming a directory this arm expects to be missing
    # would abort the run on the very fact it is asserting.
    find . -not -path './.git/*' | sort
    log_info "Expect: no .claude/ directory, since nothing on this branch creates one"
    ;;
  "unmigrated")
    seed_records .claude .tmp
    log_step "Running: canon records validate plans --root ."
    run_cli records validate plans --root . --json
    # This arm asserts the fallback, so the old root is the answer it checks for.
    # A sweep rewriting it leaves the branch reading as covered while checking
    # the migrated case twice.
    # canon-keep-record-root
    log_info "Expect: 1 record read, the live plan under .claude/plans"
    log_step "Running: canon tasks archive v1.1-staged-row --root ."
    run_cli tasks archive v1.1-staged-row --root . --json
    # canon-keep-record-root
    log_info "Expect: from and to both spelling .claude/tasks/, behavior unchanged"
    ;;

  "migrate")
    seed_records .claude .tmp
    printf '.canon/\n' >.gitignore

    # A record carrying a citation, which nothing else in this fixture has. The
    # ignore file above names the new root alone, which is what the documented
    # first-run order produces, so every record still at the old root is visible
    # to the sweep as though it were source. Without the record-root skip this
    # one file is what the verb reports and rewrites.
    #
    # The seeding line spells the old root twice and is protected for it, so the
    # arm demonstrates the defect it measures rather than becoming an instance.
    # canon-keep-record-root
    printf 'The row is at .claude/plans/feature-live-row.md\n' >.claude/memory/pen-entry.md

    log_step "Running: canon migrate records --root ."
    run_cli migrate records --root . --json
    log_info "Expect: 12 entries considered, the 4 on disk named as folders to move"
    log_info "Expect: exit 2 and nothing written, since --write was not passed"
    log_info "Expect: the pen entry in neither paths nor files, and records counting it"
    log_step "Running: canon migrate records --root . --write"
    run_cli migrate records --root . --write --json
    log_step "Reading the tree back"
    find . -not -path './.git/*' | sort
    # canon-keep-record-root
    log_info "Expect: plans, tasks, and memory now under .canon/, and .claude/.tmp as .canon/tmp"
    # canon-keep-record-root
    log_info "Expect: no .claude/ directory left, since every seeded entry moved"
    log_step "Running: canon records validate plans --root ."
    run_cli records validate plans --root . --json
    log_info "Expect: 1 record read, resolved at the root the move produced"
    log_step "Reading the pen entry back"
    cat .canon/memory/pen-entry.md
    # canon-keep-record-root
    log_info "Expect: the citation still spelling .claude/plans, since a record is never swept"
    log_step "Running: canon migrate records --root ."
    run_cli migrate records --root . --json
    log_info "Expect: 0 folders and 0 citations, which is the idempotence check"
    ;;

  "migrate-refusal")
    seed_records .claude .tmp
    printf 'node_modules/\n' >.gitignore
    log_step "Running: canon migrate records --root ."
    run_cli migrate records --root . --json
    log_info "Expect: exit 1 refusing, since this project does not ignore .canon/"
    log_info "Expect: the repair names canon tooling sync rather than an edit by hand"
    # canon-keep-record-root
    log_info "Expect: the records still under .claude/, untouched by a refused run"
    find . -not -path './.git/*' | sort
    ;;
  "record-tree")
    seed_records .canon tmp
    mkdir -p .canon/groundwork/01-closed-trail

    # One citation of each class the scope has to separate: a live pointer, an
    # archived one, one inside a closed trail, one in scratch, and one a marker
    # protects. Every seeding line spells the old root on purpose and is
    # protected for it, so the tracked sweep leaves this fixture building the
    # state the arm is about rather than turning it into an instance of the
    # defect.
    # canon-keep-record-root
    printf 'Origin: .claude/groundwork/01-closed-trail/notes.md\n' >>.canon/tasks/v1.1-staged-row.md
    # canon-keep-record-root
    printf 'Superseded by .claude/plans/feature-old.md\n' >.canon/plans/archive/feature-shipped-row.md
    # canon-keep-record-root
    printf 'Measured in .claude/memory/entry.md\n' >.canon/groundwork/01-closed-trail/notes.md
    # canon-keep-record-root
    printf 'Scratch names .claude/tasks/priority.md\n' >.canon/tmp/note.txt
    printf '<!-- canon-keep-record-root -->\nThe defect landed in .claude/tasks/ back then.\n' >.canon/memory/dated.md

    log_step "Running: canon migrate record-tree --root ."
    run_cli migrate record-tree --root . --json
    log_info "Expect: exit 2, 1 file to change and 1 citation, named with its line text"
    log_info "Expect: groundwork, tmp, and plans/archive each a count rather than a path list"
    log_info "Expect: 1 citation marked to keep the old root, which is the dated memory entry"
    log_step "Running: canon migrate record-tree --root . --write"
    run_cli migrate record-tree --root . --write --json
    log_step "Running: canon migrate record-tree --root ."
    run_cli migrate record-tree --root . --json
    log_info "Expect: exit 0 and 0 citations, which is the idempotence check"
    log_step "Reading the five seeded citations back"
    cat .canon/tasks/v1.1-staged-row.md
    cat .canon/plans/archive/feature-shipped-row.md
    cat .canon/groundwork/01-closed-trail/notes.md
    cat .canon/tmp/note.txt
    cat .canon/memory/dated.md
    log_info "Expect: only the task line at the new root, the other four unchanged"
    ;;

  "records-push")
    seed_records .claude .tmp
    printf '.canon/\n' >.gitignore

    # A bare repository on this disk stands in for the private records remote.
    # The gate this has to clear compares the records origin against every
    # remote of the project, and a sandbox project has none, so a local path
    # passes it the way a real private repository would.
    origin="$PWD/../records-origin.git"
    rm -rf "$origin"
    git init --quiet --bare "$origin"

    # A push lands on one branch per project, named from the project's own
    # origin or directory, so the read follows whichever branch the push made
    # rather than naming one.
    origin_tree() {
      local branch
      branch=$(git -C "$origin" for-each-ref --count=1 --format='%(refname:short)' refs/heads)
      git -C "$origin" ls-tree -r --name-only "$branch" | sort
    }

    # The history is opened at the old root because this arm builds an
    # unmigrated tree, which is what gives the split-root refusal below
    # something to refuse. A sweep rewriting either line would have the arm
    # push a tree that was never split.
    # canon-keep-record-root
    git --git-dir=.claude/.records.git init --quiet
    # canon-keep-record-root
    git --git-dir=.claude/.records.git remote add origin "$origin"

    log_step "Running: canon records push --root ."
    run_cli records push --root . --json
    log_info "Expect: ok true, the three seeded folders, and a commit on the bare origin"
    log_step "Reading the origin back"
    origin_tree
    log_info "Expect: bare paths such as tasks/index.md, with no record root in any of them"

    # Half a move is what a failed rename leaves, and it is the state the push
    # guard exists for. Moving one folder is enough: `recordRoot` then answers
    # `.canon` for the whole tree while the index still names the eight left
    # behind, so an unguarded `add -A` would stage every one of them as deleted.
    log_step "Half-migrating the tree, one folder moved"
    mkdir -p .canon
    # canon-keep-record-root
    mv .claude/memory .canon/memory
    log_step "Running: canon records push --root ."
    run_cli records push --root . --json
    log_info "Expect: ok false with reason split-roots, naming the two left at .claude/"
    log_step "Reading the origin back"
    origin_tree
    log_info "Expect: unchanged, so the refusal is what kept the folders on the remote"
    log_step "Running: canon records pull --root ."
    run_cli records pull --root . --json
    log_info "Expect: ok false with reason split-roots, the same reading from the other verb"

    log_step "Finishing the move"
    run_cli migrate records --root . --write --json
    log_step "Running: canon records push --root ."
    run_cli records push --root . --json
    log_info "Expect: ok true again, the work tree now resolving at .canon/"
    log_step "Reading the origin back"
    origin_tree
    log_info "Expect: the same paths and changed 0, since the history stores none of the root"
    ;;

  "refusal")
    seed_records .canon tmp
    rm -rf .canon/memory
    log_step "Running: canon records validate memory --root ."
    run_cli records validate memory --root . --json
    # canon-keep-record-root
    log_info "Expect: no-folder naming .canon/memory or .claude/memory"
    log_info "Expect: the creation default named second, which is where a write lands"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
