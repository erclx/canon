#!/usr/bin/env bash
set -e
set -o pipefail

source "$PROJECT_ROOT/scripts/lib/sandbox-git.sh"

use_anchor() {
  use_sandbox_anchor
}

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "happy-path" "prose-informational" "prose-executable" "test-order-violation" "ui-continue"

  log_step "Configuring autoship environment ($ANCHOR_REPO)"

  configure_sandbox_anchor_remote

  # Wipe anchor content to start clean
  find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

  printf 'node_modules\n.canon/plans/\n.canon/review/\n.canon/memory/\n' >.gitignore

  case "$SELECTED_OPTION" in
  "happy-path")
    stage_fixtures claude auto-ship happy-path 01-tree

    git add . && git commit --allow-empty -m "feat(project): initial greeting library" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/add-farewell -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review
    stage_fixtures claude auto-ship happy-path 02-plan

    log_step "Scenario ready: autoship happy path"
    log_info "Context: main, with an approved plan staged for feat/add-farewell and one seeded memory entry"
    log_info "Action:  /auto-ship"
    log_info "Expect:  implements farewell fn, verify passes, review runs, PR marked draft and read back"
    log_info "         Step 4 runs test-order in the worktree and reports clean, since the"
    log_info "         branch is taken fresh off main and carries no commit of its own yet"
    log_info "         Step 8 invokes git-ship rather than restating the chain, so the verify"
    log_info "         runs twice and the marking lands before the CI watch, reported from the read"
    log_info "         a headless run with no interaction has nothing for capture to find, so"
    log_info "         it typically reports Nothing worth capturing and Step 9 is skipped"
    ;;
  "prose-informational")
    stage_fixtures claude auto-ship prose-informational 01-tree

    git add . && git commit --allow-empty -m "docs(notes): initial layout" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/expand-intro -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review
    stage_fixtures claude auto-ship prose-informational 02-plan

    log_step "Scenario ready: autoship informational prose diff"
    log_info "Context: main, with a plan staged for feat/expand-intro touching only docs/intro.md"
    log_info "Action:  /auto-ship"
    log_info "Expect:  implements prose update, verify passes, REVIEW IS SKIPPED, PR marked draft and read back"
    log_info "         Step 4 runs test-order in the worktree and reports clean on an empty range"
    log_info "         docs/ is outside every behavior path, so both classifier tests pass"
    log_info "         autoship Step 6 should print the skip rationale rather than invoking review-branch"
    log_info "         pen is empty, so capture and Propose no-op and the fourth output line is omitted"
    ;;
  "prose-executable")
    stage_fixtures claude auto-ship prose-executable 01-tree

    git add . && git commit --allow-empty -m "feat(project): initial service layout" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/tighten-deploy-check -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review
    stage_fixtures claude auto-ship prose-executable 02-plan

    log_step "Scenario ready: autoship executable prose diff"
    log_info "Context: main, with a plan staged for feat/tighten-deploy-check touching only a SKILL.md body"
    log_info "Action:  /auto-ship"
    log_info "Expect:  implements the stop condition, verify passes, REVIEW RUNS, PR marked draft and read back"
    log_info "         Step 4 runs test-order in the worktree and reports clean, since the branch"
    log_info "         carries no commit and the diff names no TypeScript either way"
    log_info "         the diff is all markdown, so the extension test passes and the path test fails"
    log_info "         .claude/skills/ is a behavior path, so Step 6 must invoke review-branch"
    log_info "         a skipped review here is the defect this arm exists to catch"
    ;;
  "test-order-violation")
    # The branch has to carry the violating commits, and a worktree taken fresh
    # off the remote default would carry none of them. Branching from local HEAD
    # is what puts them in the range Step 4 reads.
    stage_fixtures claude auto-ship test-order-violation 01-tree

    git add . && git commit -m "feat(project): initial greeting library" --no-verify -q
    git push --force origin HEAD:main

    # Two commits rather than one, because a subject carrying no test at all
    # reads as unclassified. A finding needs both sides in the range with the
    # test arriving second, which is the shape the check is named for.
    stage_fixtures claude auto-ship test-order-violation 02-shout

    git add src/shout.ts && git commit -m "feat(shout): add the shout helper" --no-verify -q

    stage_fixtures claude auto-ship test-order-violation 03-shout-test

    git add src/shout.test.ts && git commit -m "test(shout): cover the shout helper" --no-verify -q

    git push origin --delete feat/add-whisper -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review
    stage_fixtures claude auto-ship test-order-violation 04-plan

    log_step "Scenario ready: autoship over a branch whose history already breaks test order"
    log_info "Context: local main sits two commits ahead of origin/main. src/shout.ts landed"
    log_info "         first and src/shout.test.ts landed after it, so the pair reads as"
    log_info "         implementation-first. A plan for a genuinely new whisper module is staged."
    log_info "Action:  /auto-ship"
    log_info "Expect:  Step 4 reports one finding, naming src/shout.ts and the reason that the"
    log_info "         implementation reached history before the test covering it, then CONTINUES"
    log_info "         the chain reaches review and opens a draft PR anyway, since the verb"
    log_info "         reports and never gates, and the commits are an earlier round's rather"
    log_info "         than this run's to rewrite"
    log_info "         a stopped chain or a rewritten commit is the defect this arm exists to catch"
    log_info "         Step 2's own whisper work is uncommitted when Step 4 runs, so it is"
    log_info "         outside the range and reports nothing either way"
    log_info "         a clean Step 4 here means the worktree was taken off origin/main rather"
    log_info "         than local HEAD, so check that .claude/settings.json baseRef took effect"
    log_info "Headless: run this arm with CANON_SKILL_TEST_MAX_TURNS=140, which is the value"
    log_info "         that reached the pull request. The runner default of 30 and a raise to"
    log_info "         60 both truncate inside the ship sequence, which leaves the same shape"
    log_info "         as the stopped chain above. What it consumes is unread rather than"
    log_info "         measured, since the run ended on the harness background ceiling rather"
    log_info "         than on the cap, so 140 is a value with margin rather than a bound."
    log_info "         Tell truncation from a stop by the branch: a stop on the finding leaves"
    log_info "         no whisper commit at all, and a truncation leaves the commit with no"
    log_info "         pull request behind it."
    log_info "Driven:  on sonnet for 1.83 dollars on 2026-09-07, reaching a draft pull request"
    log_info "         and stopping in the CI watch on the harness background ceiling. baseRef"
    log_info "         took, the branch carried both shout commits intact, Step 4 reported the"
    log_info "         one finding, and whisper shipped with its test."
    ;;
  "ui-continue")
    # ui-checklist writes its handoff under .canon/tmp/, which no other arm
    # reaches, so only this arm ignores it.
    printf '.canon/tmp/\n' >>.gitignore

    stage_fixtures claude auto-ship ui-continue 01-tree

    git add . && git commit --allow-empty -m "feat(project): initial button component" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/roomier-button -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review
    stage_fixtures claude auto-ship ui-continue 02-plan

    log_step "Scenario ready: autoship over a UI diff that produces a visual checklist"
    log_info "Context: main, with a plan staged for feat/roomier-button touching only a .tsx component"
    log_info "Action:  /auto-ship"
    log_info "Expect:  implements the padding and radius, verify passes, Step 5 invokes ui-checklist"
    log_info "         and the checklist it writes does NOT stop the chain"
    log_info "         Step 6 classifies the .tsx path as review and invokes review-branch"
    log_info "         the PR opens as a draft and the closing block carries a line naming the"
    log_info "         unchecked visual boxes, with the taste count in parentheses"
    log_info "         a chain that stops on the checklist with nothing committed is the defect"
    log_info "         this arm exists to catch"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
