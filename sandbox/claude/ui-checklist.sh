#!/usr/bin/env bash
set -e
set -o pipefail

# cspell:ignore esbuild

# No project copy of the corpus, for the same reason `claude/review-branch.sh` carries
# none. The absent project copy forces `ui-checklist` onto the
# `${CLAUDE_SKILL_DIR}/../../standards/skill.md` fallback, and the branch name
# below turns that citation into a checklist filename `expect.toml` asserts by
# exact path. It sat in `manual` while the skill could correctly write no
# checklist at all, which is the escape the shrink closed: the checklist is the
# skill's whole output now, so a run producing none has produced nothing.
use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  cat <<'EOF' >package.json
{
  "name": "sandbox-ui-checklist",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^25.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.26.0",
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

  cat <<'EOF' >>CLAUDE.md

# Sample app

Vite and React task board. UI lives in `src/components/`.

## Commands

- `bun run test`: Vitest component and unit tests
- `bun run test:e2e`: Playwright end to end tests
EOF

  mkdir -p src/components e2e

  cat <<'EOF' >vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
})
EOF

  cat <<'EOF' >src/components/TaskList.tsx
export function TaskList({ tasks }: { tasks: string[] }) {
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task}>{task}</li>
      ))}
    </ul>
  )
}
EOF

  cat <<'EOF' >e2e/task-list.spec.ts
import { expect, test } from '@playwright/test'

test('task list renders the seeded tasks', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('listitem')).toHaveCount(2)
})
EOF

  git add . && git commit -m "feat(ui): task list" --no-verify -q

  git checkout -b feat/task-filter -q

  # The diff the skill classifies. `TaskList` gains an empty state, a loading
  # state, a filter input, and a link to an archive route. The states belong to a
  # component test and the route change to an end to end spec, which is the
  # routing this arm asserts. A spacing and color change is the visual half. All
  # three kinds have to be present or the skill takes its all-automatable branch
  # and writes no checklist, which is the file the fallback claim is about.
  #
  # The input stays mounted alongside the empty state. Returning the paragraph
  # alone would unmount it and strand a user who filtered to no matches with no
  # way to clear the filter, and a skill reading that diff reviews the fixture's
  # own defect instead of the change under test.
  cat <<'EOF' >src/components/TaskList.tsx
import { useState } from 'react'

export function TaskList({
  tasks,
  isLoading = false,
}: {
  tasks: string[]
  isLoading?: boolean
}) {
  const [filter, setFilter] = useState('')
  const visible = tasks.filter((task) => task.includes(filter))

  if (isLoading) {
    return <p className="task-list-loading">Loading tasks</p>
  }

  return (
    <div>
      <a href="/archive">View archive</a>
      <input
        aria-label="Filter tasks"
        onChange={(event) => setFilter(event.target.value)}
        value={filter}
      />
      {visible.length === 0 ? (
        <p className="task-list-empty">No tasks match that filter.</p>
      ) : (
        <ul className="task-list">
          {visible.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
EOF

  cat <<'EOF' >src/components/task-list.css
.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.task-list-empty {
  color: #6b7280;
  padding: 24px 16px;
}
EOF

  cat <<'EOF' >src/App.tsx
import { Route, Routes } from 'react-router-dom'

import { TaskList } from './components/TaskList'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<TaskList tasks={['write', 'review']} />} />
      <Route path="/archive" element={<h1>Archive</h1>} />
    </Routes>
  )
}
EOF

  git add . && git commit -m "feat(ui): filter tasks and handle the empty state" --no-verify -q

  log_step "Scenario ready: UI change with an automatable and a visual half"
  log_info "Context: feat/task-filter, one commit ahead of main"
  log_info "  component   : loading state, empty state, list count after filtering"
  log_info "  end to end  : the route change to /archive"
  log_info "  visual only : 12px gap, 16px padding, muted empty-state color"
  log_info ""
  log_info "This arm also checks the standards citation, not the skill alone."
  log_info "  .claude/standards/ is absent, so the skill must reach the plugin copy"
  log_info "  the slug transform lives only in standards/skill.md, never in the skill body"
  log_info "  so .canon/tmp/handoff/ui-checklist/task-filter.md is evidence it resolved"
  log_info "  expect.toml asserts that exact path, so the checker reads it for you"
  log_info ""
  log_info "The Playwright and vitest scaffold stays in the fixture on purpose."
  log_info "The skill writes no test now, so a run that installs a runner or adds"
  log_info "a spec has gone past its job. The write scope is what catches that:"
  log_info "e2e/ and the component test glob are outside it, so either write"
  log_info "reports as a violation rather than as coverage."
  log_info ""
  log_info "Action:  /canon:ui-checklist I added a filter input, a loading state, an empty state, and a link to the archive route to TaskList, and restyled its spacing"
  log_info "Expect:  declared in fixtures/claude/ui-checklist/expect.toml"
  log_info "         Check it with: canon sandbox check claude:ui-checklist"
}
