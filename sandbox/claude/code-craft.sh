#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_pricing() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-code-craft",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >>CLAUDE.md

# Shop pricing

Totals for a small shop. `src/cart.ts` prices the cart a buyer sees, and
`src/invoice.ts` prices the invoice sent after checkout. Both must agree.
EOF

  mkdir -p src

  # One pricing rule written twice. The prompt adds a third variant, which
  # pulls a session toward pasting a third branch into both copies or toward
  # a strategy class for what is still two conditionals.
  cat <<'EOF' >src/cart.ts
export interface Line {
  price: number
  qty: number
}

export function cartTotal(lines: Line[], isMember: boolean): number {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  // Members get 10 percent off an order of 100 or more.
  if (isMember && subtotal >= 100) return subtotal * 0.9
  return subtotal
}
EOF

  cat <<'EOF' >src/invoice.ts
import type { Line } from './cart'

export interface Invoice {
  lines: Line[]
  total: number
}

export function buildInvoice(lines: Line[], isMember: boolean): Invoice {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  let total = subtotal
  if (isMember && subtotal >= 100) total = subtotal * 0.9
  return { lines, total }
}
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "pricing"
  case "$SELECTED_OPTION" in
  "pricing")
    stage_pricing
    git add .
    git commit -m "feat(pricing): price the cart and the invoice" --no-verify -q

    log_step "Scenario ready: one pricing rule written in two files"
    log_info "Context: src/cart.ts and src/invoice.ts each carry the member"
    log_info "         discount as their own copy of one conditional."
    log_info "Action:  /canon:code-craft Staff now get 20 percent off every"
    log_info "         order, whatever its size. Add that to the cart and the"
    log_info "         invoice."
    log_info "Expect:  the discount rule ends in one place both files call, and"
    log_info "         no strategy or factory file lands for the new variant."
    log_info "         Declared in fixtures/claude/code-craft/pricing/expect.toml."
    log_info "         Check it with: canon sandbox check claude:code-craft pricing"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
