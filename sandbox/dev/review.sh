#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  mkdir -p src/api

  git checkout -b feat/orders >/dev/null 2>&1

  cat <<'EOF' >src/api/orders.ts
export async function getOrders(userId: string) {
  const res = await fetch(`/api/orders?user=${userId}`);
  if (res.status !== 200) throw new Error("fetch failed");
  const data = await res.json();
  return data.orders;
}

export async function cancelOrder(id: string) {
  const res = await fetch(`/api/orders/${id}/cancel`, { method: "POST" });
  const data = await res.json();
  return data;
}

export function applyDiscount(price: number, pct: number) {
  return price - (price * pct / 100);
}
EOF

  git add src/api/orders.ts
  git commit -m "feat(api): add orders API" --no-verify >/dev/null

  log_step "Scenario ready: branch diff review"
  log_info "Context: on feat/orders, one commit ahead of main with three reviewable bugs"
  log_info "Action:  /canon:review-branch"
  log_info "Expect:  findings report against branch diff, no args needed"
}
