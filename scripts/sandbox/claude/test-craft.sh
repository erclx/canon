#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
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
  log_info "         Declared in fixtures/claude/test-craft/expect.toml."
  log_info "         Check it with: canon sandbox check claude:test-craft"
  log_info ""
  log_info "Nothing installs, so no test can run. The arm asserts where each test"
  log_info "landed, not whether it passed."
}
