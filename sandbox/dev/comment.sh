#!/usr/bin/env bash
set -e
set -o pipefail

stage_setup() {
  mkdir -p src/api

  cat <<'EOF' >src/api/orders.ts
import { db } from "../db";
import { notify } from "../notify";

const CANCELLABLE_STATUSES = ["pending", "processing"];
const MAX_BULK = 50;

export async function getOrder(id: string) {
  const order = await db.orders.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw new Error("not found");
  return order;
}

export async function bulkFulfil(ids: string[]) {
  if (ids.length > MAX_BULK) throw new Error("batch too large");

  const results: { id: string; ok: boolean }[] = [];
  for (const id of ids) {
    try {
      await db.orders.update({ where: { id }, data: { status: "fulfilled" } });
      results.push({ id, ok: true });
    } catch {
      results.push({ id, ok: false });
    }
  }
  return results;
}

export async function cancelOrder(id: string, reason?: string) {
  const order = await getOrder(id);

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new Error(`cannot cancel order in status: ${order.status}`);
  }

  const updated = await db.orders.update({
    where: { id },
    data: { status: "cancelled", cancelReason: reason ?? null },
  });

  await notify(order.userId, { type: "order_cancelled", orderId: id });

  return updated;
}
EOF

  log_step "Scenario ready: dev:comment above-block comments test"
  log_info "Context: 'src/api/orders.ts' has three functions, no existing comments"
  log_info "Action:  /dev:comment src/api/orders.ts"
  log_info "Expect:  comment added to MAX_BULK and bulkFulfil. getOrder and cancelOrder left clean"
}
