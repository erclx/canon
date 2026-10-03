#!/usr/bin/env bash
set -e
set -o pipefail

# A research question in a field nothing in the toolkit touches, so a run can
# only scope its search to authorities it derives rather than ones it recalls
# from the toolkit's own stacks. The project asks for notes at a fixed path and a
# link per source, and says nothing about where to search, which is the judgment
# `search-craft` carries.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >>CLAUDE.md

# Housing brief

A policy brief on local housing. Research lives in `notes/`, and the brief is
drafted from it later.

## Research notes

- Write research notes to `notes/research.md`, one section per question.
- Link every source a claim rests on.
EOF

  mkdir -p notes
  cat <<'EOF' >notes/README.md
# Notes

Research notes for the housing brief. `research.md` holds one section per
question, each claim linked to its source.
EOF

  git add . && git commit -m "docs(notes): set up the research notes folder" --no-verify -q

  log_step "Scenario ready: a research question in a field the toolkit never touches"
  log_info "Context: a housing policy brief whose CLAUDE.md asks for linked research"
  log_info "  notes at notes/research.md and says nothing about where to search."
  log_info "Action:  Find me the strongest evidence on whether rent control reduces"
  log_info "         housing supply, and write it up in the research notes."
  log_info "Tools:   sandbox/run.sh allows no search by default, so drive it with"
  log_info "         CANON_SKILL_TEST_TOOLS=Bash,Read,Glob,Grep,Edit,Write,Skill,WebSearch,WebFetch"
  log_info "Expect:  declared in fixtures/claude/search-craft/expect.toml"
  log_info "         Check it with: canon sandbox check claude:search-craft"
}
