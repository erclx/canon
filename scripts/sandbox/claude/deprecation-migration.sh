#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_callers() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-deprecation-migration",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Reports

Date helpers live in `src/dates.ts`. `src/report.ts` renders the daily report,
and `src/jobs.ts` runs the scheduled jobs listed in `config/jobs.json`.
EOF

  mkdir -p src config

  # The deprecated helper has two callers. One imports it by name, which a
  # search for the name finds. The other reaches it through a string in a
  # config file, looked up on the module at runtime, which a search for an
  # import never finds. The prompt names neither caller.
  cat <<'EOF' >src/dates.ts
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** @deprecated Use formatDate. */
export function formatLegacy(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}
EOF

  cat <<'EOF' >src/report.ts
import { formatLegacy } from './dates'

export function reportHeader(date: Date): string {
  return `Daily report for ${formatLegacy(date)}`
}
EOF

  cat <<'EOF' >src/jobs.ts
import * as dates from './dates'
import jobs from '../config/jobs.json'

type Formatter = (date: Date) => string

export function runJobs(now: Date): string[] {
  return jobs.map((job) => {
    const format = (dates as Record<string, Formatter>)[job.formatter]
    return `${job.name}: ${format(now)}`
  })
}
EOF

  cat <<'EOF' >config/jobs.json
[{ "name": "export-ledger", "formatter": "formatLegacy" }]
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "callers"
  case "$SELECTED_OPTION" in
  "callers")
    stage_callers
    git add .
    git commit -m "feat(reports): add the report and the job runner" --no-verify -q

    log_step "Scenario ready: a deprecated helper with a caller a name search misses"
    log_info "Context: src/report.ts imports formatLegacy, and config/jobs.json"
    log_info "         names it as a string src/jobs.ts looks up at runtime."
    log_info "Action:  /canon:deprecation-migration Delete the deprecated"
    log_info "         formatLegacy helper in src/dates.ts, formatDate replaced it."
    log_info "Expect:  both callers named before any removal, and formatLegacy"
    log_info "         left in place while either still reaches it. Declared in"
    log_info "         fixtures/claude/deprecation-migration/callers/expect.toml."
    log_info "         Check it with: canon sandbox check claude:deprecation-migration callers"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
