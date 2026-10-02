#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_rename() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-api-design",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "bin": { "orders": "src/cli.ts" }
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Orders

A small order store with a command line. The library lives in `src/orders.ts`,
the command in `src/cli.ts`, and `scripts/nightly-report.sh` is one of several
scripts other teams run against the command's JSON output.

## Commands

- `bun src/cli.ts show <id>`: print one order as JSON on stdout
EOF

  mkdir -p src scripts

  # The exported function hands back the stored row, so its storage column
  # names are already part of what a caller sees. The command copies one of
  # them, `buyer`, straight into its JSON, and the nightly script parses it.
  # A rename in place breaks that script, which the prompt never mentions.
  cat <<'EOF' >src/orders.ts
export interface OrderRow {
  id: string
  buyer: string
  total_cents: number
  _rev: number
}

const rows: Record<string, OrderRow> = {
  'A-1': { id: 'A-1', buyer: 'c-42', total_cents: 1999, _rev: 3 },
}

export function getOrder(id: string): OrderRow | undefined {
  return rows[id]
}
EOF

  cat <<'EOF' >src/cli.ts
#!/usr/bin/env bun
import { getOrder } from './orders'

const [command, id] = process.argv.slice(2)

if (command !== 'show' || id === undefined) {
  console.error('usage: orders show <id>')
  process.exit(2)
}

const order = getOrder(id)
if (order === undefined) {
  console.error(`no order ${id}`)
  process.exit(1)
}

console.log(JSON.stringify({ id: order.id, buyer: order.buyer, total: order.total_cents }))
EOF

  cat <<'EOF' >scripts/nightly-report.sh
#!/usr/bin/env bash
set -euo pipefail

for id in "$@"; do
  bun src/cli.ts show "$id" | jq -r '"\(.id) \(.buyer) \(.total)"'
done
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "rename"
  case "$SELECTED_OPTION" in
  "rename")
    stage_rename
    git add .
    git commit -m "feat(orders): add the show command" --no-verify -q

    log_step "Scenario ready: a command whose JSON a script outside it parses"
    log_info "Context: src/cli.ts prints { id, buyer, total }, and"
    log_info "         scripts/nightly-report.sh reads .buyer out of it with jq."
    log_info "Action:  /canon:api-design Rename the buyer field in the JSON that"
    log_info "         orders show prints to customerId."
    log_info "Expect:  customerId added beside buyer rather than replacing it, and"
    log_info "         the nightly script left reading .buyer. Declared in"
    log_info "         fixtures/claude/api-design/rename/expect.toml."
    log_info "         Check it with: canon sandbox check claude:api-design rename"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
