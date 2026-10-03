#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

seed_project() {
  stage_fixtures claude teach-workspace shared project
}

# Stubbed rather than left empty. The sandbox has no network, so the skill's
# research step cannot run, and an absent resources file would make every arm
# fail on the one behavior the scenario cannot exercise.
seed_workspace() {
  local dir="$1"

  mkdir -p "$dir/reference" "$dir/learning-records" "$dir/lessons" "$dir/assets"

  stage_fixtures claude teach-workspace shared workspace

}

# Split out of the workspace seed rather than written inside it. The lesson arm
# is the one that has to find this file absent, since writing it is what the
# first lesson in a workspace does and a seeded copy makes that step vacuous.
seed_stylesheet() {
  stage_fixtures claude teach-workspace shared stylesheet
}

# The promote arm alone. A project with no wiki folder gets a refusal from the
# skill rather than a scaffold, so the arm that drives a proposal has to seed
# one, and it seeds the `.claude/` spelling a scaffolded target carries. The
# wiki holds only Anthropic-owned subjects, so seeding it here is what gives
# the routing test something to correctly pass over: the regex page belongs to
# nobody, which routes it to docs instead.
seed_wiki() {
  mkdir -p .claude/wiki

  stage_fixtures claude teach-workspace promote 01-wiki
}

stage_setup() {
  log_step "Teach sandbox"
  log_info "open   : no workspace folder yet, one has to be opened from nothing"
  log_info "resume : a live workspace at 01-regex with one record carrying two wrong answers"
  log_info "promote: the same workspace beside a wiki, with one reference page to route"
  log_info "lesson : the same workspace with no stylesheet, so the next lesson writes one"
  log_info ""
  log_info "Invoke the prefixed form. The dev-skill injection copies SKILL.md alone,"
  log_info "so the unprefixed copy cannot resolve the bundled standards/teach.md."
  log_info "Launch with: claude --plugin-dir <worktree-root>/claude --model sonnet"

  select_or_route_scenario "Which scenario?" "open" "resume" "promote" "lesson"

  case "$SELECTED_OPTION" in
  "open")
    seed_project

    mkdir -p .canon/teach

    git add . && git commit -m "feat(cli): slugify helper" --no-verify -q

    log_step "Scenario ready: teach opens the first workspace"
    log_info "Context: .canon/teach/ exists and holds no workspace"
    log_info "  The invocation carries the starting point, because the skill"
    log_info "  settles it by asking and a headless run has nobody to answer."
    log_info "  A prompt without it leaves the session waiting and writing nothing,"
    log_info "  which is correct behavior and asserts none of the workspace shape."
    log_info ""
    log_info "Action:  /canon:teach-workspace regex, and I know character classes and"
    log_info "         anchors but have never written a capture group"
    log_info "Expect:  declared in fixtures/claude/teach-workspace/open/expect.toml"
    log_info "         Check it with: canon sandbox check claude:teach-workspace open"
    log_info "         A folder at .canon/teach/01-regex/ carrying MISSION.md"
    log_info "         with a date and a success list, RESOURCES.md, and"
    log_info "         GLOSSARY.md. Nothing written outside .canon/teach/."
    log_info "         The session asks what the learner already knows."
    ;;
  "resume")
    seed_project
    seed_workspace ".canon/teach/01-regex"
    seed_stylesheet

    git add . && git commit -m "feat(cli): slugify helper" --no-verify -q

    log_step "Scenario ready: teach resumes a live workspace"
    log_info "Context: .canon/teach/01-regex/ holds a mission, resources, a glossary,"
    log_info "  one reference page, one lesson, and one learning record"
    log_info "  That record names two wrong answers: a lazy quantifier read as two"
    log_info "  tokens, and a capture group believed to hold every repetition"
    log_info "  The mission carries four success lines and one is already met"
    log_info "  The invocation answers the first miss and repeats the second, since"
    log_info "  the skill opens on retrieval and stops for an answer that never"
    log_info "  arrives in a headless run"
    log_info ""
    log_info "Action:  /canon:teach-workspace regex. On the retrieval from last time:"
    log_info "         a+? matches a single a, because the lazy quantifier takes as"
    log_info "         few as it can. For (ab)* over ababab I still think group 1"
    log_info "         holds ababab."
    log_info "         Run this arm with CANON_SKILL_TEST_MAX_TURNS=60. It needs 28"
    log_info "         turns and the runner default of 30 leaves no margin."
    log_info "Expect:  declared in fixtures/claude/teach-workspace/resume/expect.toml"
    log_info "         Check it with: canon sandbox check claude:teach-workspace resume"
    log_info "         Resume detected from the folder rather than asked about."
    log_info "         The next lesson opens on the two recorded wrong answers"
    log_info "         before anything new, and lands at 0002 in both lessons/"
    log_info "         and learning-records/. No second workspace is opened."
    ;;
  "promote")
    seed_project
    seed_workspace ".canon/teach/01-regex"
    seed_stylesheet
    seed_wiki

    git add . && git commit -m "feat(cli): slugify helper" --no-verify -q

    # An explicit branch rather than whatever `git init` inherited. The handoff
    # file takes its name from the branch slug, so an arm asserting that file by
    # name has to fix the branch the slug comes off.
    git checkout -b feat/promote-regex -q

    log_step "Scenario ready: teach proposes where a durable page belongs"
    log_info "Context: .canon/teach/01-regex/ holds one reference page, one lesson,"
    log_info "  and a glossary. The project carries .claude/wiki/ with a stub index,"
    log_info "  but the wiki holds only Anthropic-owned subjects, so the routing test"
    log_info "  has to notice a regex reference page belongs to nobody and route it"
    log_info "  to the project's docs instead of the wiki sitting right there"
    log_info "  The invocation confirms the proposal in advance, because the step"
    log_info "  proposes and waits and a headless run has nobody to confirm"
    log_info ""
    log_info "Action:  /canon:teach-workspace promote regex. Confirm whatever you propose"
    log_info "         for the reference page, I approve it in advance."
    log_info "Expect:  declared in fixtures/claude/teach-workspace/promote/expect.toml"
    log_info "         Check it with: canon sandbox check claude:teach-workspace promote"
    log_info "         A handoff at .canon/tmp/handoff/teach-promotion/promote-regex.md"
    log_info "         carrying one heading"
    log_info "         naming a path under docs/ and the source page under it."
    log_info "         Nothing written into .claude/wiki/ or docs/ themselves, and the"
    log_info "         lesson neither proposed nor carried across."
    ;;
  "lesson")
    seed_project
    seed_workspace ".canon/teach/01-regex"

    git add . && git commit -m "feat(cli): slugify helper" --no-verify -q

    log_step "Scenario ready: teach writes the rendered layer"
    log_info "Context: .canon/teach/01-regex/ holds the same workspace the resume arm"
    log_info "  seeds, with one difference: assets/ is empty, so the shared stylesheet"
    log_info "  is absent and the next lesson is the one that has to write it"
    log_info "  The seeded lesson sits at 0001, so a correct derivation lands on 0002"
    log_info "  The invocation answers the recorded retrieval, since the skill opens"
    log_info "  on it and a headless run has nobody to answer"
    log_info ""
    log_info "Action:  /canon:teach-workspace regex. On the retrieval from last time:"
    log_info "         a+? matches a single a, because the lazy quantifier takes as"
    log_info "         few as it can. For (ab)* over ababab, group 1 holds only the"
    log_info "         last ab."
    log_info "Expect:  declared in fixtures/claude/teach-workspace/lesson/expect.toml"
    log_info "         Check it with: canon sandbox check claude:teach-workspace lesson"
    log_info "         A lesson at lessons/0002-*.html carrying the four marker"
    log_info "         pairs with the stylesheet and the stepper spliced into the"
    log_info "         style one, a quiz written as radio inputs, and a stylesheet"
    log_info "         at assets/course.css that the run wrote."
    log_info "         The reply reports progress against the mission success lines."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
