#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_shop_config() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-test-craft",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
EOF

  cat <<'EOF' >playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
})
EOF

  cat <<'EOF' >vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
})
EOF

  cat <<'EOF' >>CLAUDE.md

# Sample shop

Vite and React storefront. Routes live in `src/App.tsx`, components in `src/components/`, and pure helpers in `src/lib/`.

## Commands

- `bun run test`: Vitest unit and component tests, beside their subject
- `bun run test:e2e`: Playwright end to end tests under `e2e/`
EOF
}

stage_layers() {
  mkdir -p src/lib src/components src/pages e2e

  # One behavior per layer, so a correct run has exactly one right home for
  # each. The helper is pure, which makes it a unit test. The list's loading,
  # empty, and error states render without leaving the component, which makes
  # them a component test however much the diff looks like UI. The checkout
  # crosses three routes, which is the one journey here that earns a browser.
  cat <<'EOF' >src/lib/price.ts
export function formatPrice(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Invalid price: ${cents}`)
  }
  const dollars = Math.floor(cents / 100)
  const rest = String(cents % 100).padStart(2, '0')
  return `$${dollars.toLocaleString('en-US')}.${rest}`
}
EOF

  cat <<'EOF' >src/components/OrderList.tsx
import { useEffect, useState } from 'react'

import { formatPrice } from '../lib/price'

interface Order {
  id: string
  totalCents: number
}

export function OrderList({ load }: { load: () => Promise<Order[]> }) {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    load().then(setOrders, () => setFailed(true))
  }, [load])

  if (failed) return <p role="alert">Orders could not be loaded.</p>
  if (orders === null) return <p role="status">Loading orders…</p>
  if (orders.length === 0) return <p>No orders yet.</p>

  return (
    <ul aria-label="Orders">
      {orders.map((order) => (
        <li key={order.id}>
          {order.id}: {formatPrice(order.totalCents)}
        </li>
      ))}
    </ul>
  )
}
EOF

  cat <<'EOF' >src/pages/Cart.tsx
import { Link } from 'react-router-dom'

export function Cart() {
  return (
    <main>
      <h1>Cart</h1>
      <Link to="/checkout">Check out</Link>
    </main>
  )
}
EOF

  cat <<'EOF' >src/pages/Checkout.tsx
import { useNavigate } from 'react-router-dom'

export function Checkout() {
  const navigate = useNavigate()
  return (
    <main>
      <h1>Checkout</h1>
      <form onSubmit={(event) => { event.preventDefault(); navigate('/confirmation') }}>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <button type="submit">Place order</button>
      </form>
    </main>
  )
}
EOF

  cat <<'EOF' >src/pages/Confirmation.tsx
export function Confirmation() {
  return (
    <main>
      <h1>Order placed</h1>
    </main>
  )
}
EOF

  cat <<'EOF' >src/App.tsx
import { Route, Routes } from 'react-router-dom'

import { Cart } from './pages/Cart'
import { Checkout } from './pages/Checkout'
import { Confirmation } from './pages/Confirmation'

export function App() {
  return (
    <Routes>
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/confirmation" element={<Confirmation />} />
    </Routes>
  )
}
EOF
}

stage_pull() {
  mkdir -p src/pages e2e

  # The page already carries an end to end spec, which is the pull. A session
  # adding to a page with a spec beside it is tempted to extend that spec. The
  # loading state renders without leaving the component, so the right home is
  # a component test, and the spec must stay free of it.
  cat <<'EOF' >src/pages/Orders.tsx
import { useEffect, useState } from 'react'

interface Order {
  id: string
  label: string
}

export function Orders({ load }: { load: () => Promise<Order[]> }) {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    load().then(setOrders)
  }, [load])

  return (
    <main>
      <h1>Orders</h1>
      <ul aria-label="Orders">
        {orders.map((order) => (
          <li key={order.id}>{order.label}</li>
        ))}
      </ul>
    </main>
  )
}
EOF

  cat <<'EOF' >src/App.tsx
import { Route, Routes } from 'react-router-dom'

import { Orders } from './pages/Orders'

const loadOrders = () => fetch('/api/orders').then((response) => response.json())

export function App() {
  return (
    <Routes>
      <Route path="/orders" element={<Orders load={loadOrders} />} />
    </Routes>
  )
}
EOF

  cat <<'EOF' >e2e/orders.spec.ts
import { expect, test } from '@playwright/test'

test('the orders page lists each order the API returns', async ({ page }) => {
  await page.route('**/api/orders', (route) =>
    route.fulfill({ json: [{ id: 'A-1', label: 'Order A-1' }] }),
  )
  await page.goto('/orders')
  await expect(page.getByRole('list', { name: 'Orders' })).toContainText('Order A-1')
})
EOF
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "layers" "pull"

  stage_shop_config

  case "$SELECTED_OPTION" in
  "layers")
    stage_layers
    git add .
    git commit -m "feat(shop): add prices, the order list, and checkout" --no-verify -q

    log_step "Scenario ready: three untested behaviors, one per layer"
    log_info "Context: src/lib/price.ts is pure, src/components/OrderList.tsx has a"
    log_info "         loading, empty, and error state, and src/App.tsx routes a checkout"
    log_info "         from /cart through /checkout to /confirmation. Nothing is tested."
    log_info "Action:  /canon:test-craft Write the tests formatPrice, the OrderList"
    log_info "         states, and the checkout flow need."
    log_info "Expect:  a unit test beside price.ts, a component test beside OrderList"
    log_info "         covering its three states, and one Playwright spec under e2e/"
    log_info "         walking the checkout. No browser test asserts the loading state."
    log_info "         Declared in fixtures/claude/test-craft/layers/expect.toml."
    log_info "         Check it with: canon sandbox check claude:test-craft layers"
    log_info ""
    log_info "Nothing installs, so no test can run. The arm asserts where each test"
    log_info "landed, not whether it passed."
    ;;
  "pull")
    stage_pull
    git add .
    git commit -m "feat(shop): add the orders page and its spec" --no-verify -q

    log_step "Scenario ready: a page under end to end coverage, a state to add"
    log_info "Context: src/pages/Orders.tsx has no loading state, and"
    log_info "         e2e/orders.spec.ts already covers the list in a browser."
    log_info "Action:  /canon:test-craft Add a loading state to the Orders page and"
    log_info "         write the tests it needs."
    log_info "Expect:  a component test beside Orders asserting the loading state,"
    log_info "         and no mention of it in e2e/orders.spec.ts."
    log_info "         Declared in fixtures/claude/test-craft/pull/expect.toml."
    log_info "         Check it with: canon sandbox check claude:test-craft pull"
    log_info ""
    log_info "Naming an arm is what makes the check assert anything. Without one,"
    log_info "canon sandbox check claude:test-craft reports clean with nothing read."
    log_info "The without arm is a hand run against a scratch plugin dir lacking"
    log_info "skills/test-craft, since run.sh hardcodes --plugin-dir claude, and it"
    log_info "is scored by reading the files it wrote, not by this check."
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
