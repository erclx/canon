#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  # Every sentence in docs/cache.md clears the ban scan. The defect is
  # distribution: nine sentences within a few words of each other, four openings
  # on the same shape, two verbless fragments standing as sentences, one triad,
  # one thing named four ways, and two adverbs standing in for a measurement. A
  # run that reports a clean audit here has read the words rather than the
  # passage.
  stage_fixtures claude write-human shared 01-initial

  git add . && git commit -m "docs(cache): describe the response cache" --no-verify -q

  log_step "Scenario ready: prose that clears the ban scan and still reads machine-written"
  log_info "Context: docs/cache.md, committed, carrying six tells no closed word set matches:"
  log_info "  1. Uniform cadence: every sentence within a few words of the last"
  log_info "  2. Repeated openings: four sentences opening on the same shape"
  log_info "  3. Fragments: two verbless clauses standing as sentences"
  log_info "  4. Rule of three: an invented triad, and a three-bullet Configuration block"
  log_info "  5. Synonym cycling: cache, store, buffer, layer for one thing"
  log_info "  6. Adverb propping and a false range, with no measurement behind either"
  log_info "Action:  /canon:write-human, asking for a revision of docs/cache.md"
  log_info "Expect:  a rewrite varying sentence length and opening structure, with the"
  log_info "         fragments given verbs, one name per thing, and the triad cut to what"
  log_info "         the subject holds. Read the result against the rhythm rules rather"
  log_info "         than against the ban list, which the seeded passage already passes."
}
