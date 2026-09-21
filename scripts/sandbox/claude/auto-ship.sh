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
  select_or_route_scenario "Which scenario?" "happy-path" "prose-informational" "prose-executable" "test-order-violation" "skill-arrival"

  log_step "Configuring autoship environment ($ANCHOR_REPO)"

  configure_sandbox_anchor_remote

  # Wipe anchor content to start clean
  find . -maxdepth 1 ! -name '.git' ! -name '.' -exec rm -rf {} +

  printf 'node_modules\n.canon/plans/\n.canon/review/\n.canon/memory/\n' >.gitignore

  case "$SELECTED_OPTION" in
  "happy-path")
    cat <<'EOF' >package.json
{
  "name": "sandbox-autoship",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'lint ok' && echo 'typecheck ok'"
  }
}
EOF

    cat <<'EOF' >CLAUDE.md
# My App

Greeting utility library.

## Commands

- `bun run check`: lint and typecheck
EOF

    mkdir -p src
    cat <<'EOF' >src/index.ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
EOF

    git add . && git commit --allow-empty -m "feat(project): initial greeting library" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/add-farewell -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review

    cat <<'EOF' >.canon/plans/feature-add-farewell.md
# Feature: add farewell utility

Add a `farewell` function to `src/index.ts` that returns a goodbye message, and export it alongside `greet`.

**Files to touch:**

- `src/index.ts`: add `farewell` function

**Risks:**

None identified.

**Questions:**

None identified.
EOF

    mkdir -p .canon/memory
    cat <<'EOF' >.canon/memory/feedback-export-from-index.md
---
title: Export utilities from src/index.ts
description: Public helpers re-export from the package entry point
category: Feedback
---

Every public helper in `src/` re-exports from `src/index.ts` so callers import from one entry point.

**Why:** A past session shipped a helper that callers could not import because it was never re-exported.

**How to apply:** When adding a public function under `src/`, add its `export` to `src/index.ts` in the same change.
EOF
    cat <<'EOF' >.canon/memory/index.md
---
title: Memory
subtitle: Session facts with no owning surface, grouped by kind.
---

# Memory

Session facts with no owning surface, grouped by kind.

## Feedback

- [Export utilities from src/index.ts](feedback-export-from-index.md): Public helpers re-export from the package entry point
EOF

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
    cat <<'EOF' >package.json
{
  "name": "sandbox-autoship-prose",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'format ok'"
  }
}
EOF

    cat <<'EOF' >CLAUDE.md
# My Notes

Personal notes repo. Mostly markdown.

## Commands

- `bun run check`: format check
EOF

    mkdir -p docs
    cat <<'EOF' >docs/intro.md
# Intro

Project overview goes here.
EOF

    cat <<'EOF' >README.md
# My Notes

Notes repo.
EOF

    git add . && git commit --allow-empty -m "docs(notes): initial layout" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/expand-intro -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review

    cat <<'EOF' >.canon/plans/feature-expand-intro.md
# Feature: expand intro doc

Replace the placeholder intro with two short paragraphs covering scope and structure.

**Files to touch:**

- `docs/intro.md`: replace placeholder with real intro prose

**Risks:**

None identified.

**Questions:**

None identified.
EOF

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
    cat <<'EOF' >package.json
{
  "name": "sandbox-autoship-skill",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'format ok'"
  }
}
EOF

    cat <<'EOF' >CLAUDE.md
# My App

Service repo carrying its own project-local skills.

## Commands

- `bun run check`: format check
EOF

    mkdir -p docs
    cat <<'EOF' >docs/intro.md
# Intro

Project overview goes here.
EOF

    mkdir -p .claude/skills/deploy-check
    cat <<'EOF' >.claude/skills/deploy-check/SKILL.md
---
name: deploy-check
description: Verifies a release candidate before promotion. Use when asked to "check the deploy" or "verify the candidate".
---

# Deploy check

## Step 1: read the candidate

Read the tag the release job wrote.

## Step 2: report

Report the tag and stop. Do not promote.
EOF

    git add . && git commit --allow-empty -m "feat(project): initial service layout" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/tighten-deploy-check -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review

    cat <<'EOF' >.canon/plans/feature-tighten-deploy-check.md
# Feature: tighten the deploy-check skill

Give `deploy-check` a stop condition when no tag resolves, so the skill reports the miss rather than reading an empty value as a pass.

**Files to touch:**

- `.claude/skills/deploy-check/SKILL.md`: add the stop condition to Step 1

**Risks:**

None identified.

**Questions:**

None identified.
EOF

    log_step "Scenario ready: autoship executable prose diff"
    log_info "Context: main, with a plan staged for feat/tighten-deploy-check touching only a SKILL.md body"
    log_info "Action:  /auto-ship"
    log_info "Expect:  implements the stop condition, verify passes, REVIEW RUNS, PR marked draft and read back"
    log_info "         Step 4 runs test-order in the worktree and reports clean, since the branch"
    log_info "         carries no commit and the diff names no TypeScript either way"
    log_info "         the diff is all markdown, so the extension test passes and the path test fails"
    log_info "         .claude/skills/ is a behavior path, so Step 6 must invoke review-branch"
    log_info "         a skipped review here is the defect this arm exists to catch"
    log_info "         Step 3 reads the skill arrival check as no arrivals, since the body was"
    log_info "         edited in place, so no creation-time questions are asked"
    ;;
  "test-order-violation")
    cat <<'EOF' >package.json
{
  "name": "sandbox-autoship-test-order",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'lint ok' && echo 'typecheck ok'"
  }
}
EOF

    cat <<'EOF' >CLAUDE.md
# My App

Greeting utility library.

## Commands

- `bun run check`: lint and typecheck
EOF

    # The branch has to carry the violating commits, and a worktree taken fresh
    # off the remote default would carry none of them. Branching from local HEAD
    # is what puts them in the range Step 4 reads.
    mkdir -p .claude
    cat <<'EOF' >.claude/settings.json
{
  "worktree": {
    "baseRef": "head"
  }
}
EOF

    mkdir -p src
    cat <<'EOF' >src/index.ts
export function greet(name: string): string {
  return `Hello, ${name}!`
}
EOF

    cat <<'EOF' >src/index.test.ts
import { describe, expect, it } from 'bun:test'

import { greet } from './index'

describe('greet', () => {
  it('should address the name it was given', () => {
    expect(greet('Ada')).toBe('Hello, Ada!')
  })
})
EOF

    git add . && git commit -m "feat(project): initial greeting library" --no-verify -q
    git push --force origin HEAD:main

    # Two commits rather than one, because a subject carrying no test at all
    # reads as unclassified. A finding needs both sides in the range with the
    # test arriving second, which is the shape the check is named for.
    cat <<'EOF' >src/shout.ts
export function shout(name: string): string {
  return `HELLO, ${name.toUpperCase()}!`
}
EOF

    git add src/shout.ts && git commit -m "feat(shout): add the shout helper" --no-verify -q

    cat <<'EOF' >src/shout.test.ts
import { describe, expect, it } from 'bun:test'

import { shout } from './shout'

describe('shout', () => {
  it('should upper-case the name it was given', () => {
    expect(shout('Ada')).toBe('HELLO, ADA!')
  })
})
EOF

    git add src/shout.test.ts && git commit -m "test(shout): cover the shout helper" --no-verify -q

    git push origin --delete feat/add-whisper -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review

    cat <<'EOF' >.canon/plans/feature-add-whisper.md
# Feature: add whisper utility

Add a `whisper` function returning a lower-cased greeting, in its own module beside the others, and cover it with a test.

**Files to touch:**

- `src/whisper.ts`: new `whisper` function returning `hello, <name>.`
- `src/whisper.test.ts`: the case covering it

**Risks:**

None identified.

**Questions:**

None identified.
EOF

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
  "skill-arrival")
    cat <<'EOF' >package.json
{
  "name": "sandbox-autoship-arrival",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "echo 'format ok'"
  }
}
EOF

    cat <<'EOF' >CLAUDE.md
# My App

Service repo carrying its own project-local skills.

## Commands

- `bun run check`: format check
EOF

    mkdir -p docs
    cat <<'EOF' >docs/intro.md
# Intro

Project overview goes here.
EOF

    git add . && git commit --allow-empty -m "feat(project): initial service layout" --no-verify -q
    git push --force origin HEAD:main

    git push origin --delete feat/merge-release-checks -q 2>/dev/null || true

    mkdir -p .canon/plans .canon/review

    # The plan calls the work a merge on purpose. The trigger is the diff, so
    # the framing must not decide whether the questions are asked.
    cat <<'EOF' >.canon/plans/feature-merge-release-checks.md
# Feature: merge the release checks

Merge the two ad hoc release checks into one project-local skill so the steps live in one place.

**Files to touch:**

- `.claude/skills/release-check/SKILL.md`: new, one step per former check

**Risks:**

None identified.

**Questions:**

None identified.
EOF

    log_step "Scenario ready: autoship over a plan framed as a merge that adds a skill body"
    log_info "Context: main, with a plan staged for feat/merge-release-checks adding one SKILL.md"
    log_info "Action:  /auto-ship"
    log_info "Expect:  Step 3 runs canon claude skills audit --arrivals --json, which lists"
    log_info "         .claude/skills/release-check/SKILL.md, then the chain loads create-skill's"
    log_info "         questions and records the answers for the pull request description"
    log_info "         an unasked question here is the defect this arm exists to catch"
    log_info "         the edit-only counterpart is prose-executable, which reports no arrivals"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
