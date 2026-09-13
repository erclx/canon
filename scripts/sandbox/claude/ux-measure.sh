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
  "name": "sandbox-ux-measure",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
EOF

  cat <<'EOF' >vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [react()] });
EOF

  cat <<'EOF' >>CLAUDE.md

# My App

Vite + React task list served by vite preview on port 4173.

## Commands

- `bun run dev`: start vite dev server
- `bun run preview`: serve the production build on port 4173
EOF

  cat <<'EOF' >playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:4173" },
});
EOF

  mkdir -p e2e
  cat <<'EOF' >e2e/task-list.test.ts
import { expect, test } from "@playwright/test";

test("renders the task list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
});
EOF

  mkdir -p canon/context/development
  cat <<'EOF' >canon/context/development/index.md
---
title: Development
subtitle: Local run commands and the ports they serve
---

# Development

Local run commands and the ports they serve

- `bun run dev`: vite dev server on port 5173, unminified modules
- `bun run preview`: production build on port 4173, the shape a user receives
EOF

  mkdir -p src/components
  cat <<'EOF' >src/components/TaskList.tsx
import { useEffect, useState } from "react";

type Task = { id: string; title: string };

const SEEDED: Task[] = [
  { id: "1", title: "Measure the preview build" },
  { id: "2", title: "Compare against the threshold" },
];

export function TaskList() {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setTasks(SEEDED), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <h2>Tasks</h2>
      <ul>
        {(tasks ?? []).map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
      <img src="/banner.svg" alt="" />
    </div>
  );
}
EOF

  cat <<'EOF' >src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TaskList } from "./components/TaskList";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TaskList />
  </StrictMode>,
);
EOF

  mkdir -p public
  cat <<'EOF' >public/banner.svg
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="320">
  <rect width="960" height="320" fill="#2563eb" />
</svg>
EOF

  cat <<'EOF' >index.html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Tasks</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

  git add . && git commit -m "feat(ui): task list served by vite preview" --no-verify -q

  log_step "Scenario ready: runtime measurement with a detectable harness"
  log_info "Context: Vite/React app carrying a preview command, a documented port, and Playwright"
  log_info "Seeded so detection has one answer:"
  log_info "  playwright.config.ts and @playwright/test make Playwright the harness found"
  log_info "  preview on 4173 is production-shaped, dev on 5173 is not"
  log_info "  TaskList.tsx fills its list after 400ms above an unsized banner,"
  log_info "  so the banner is pushed down and the layout reading is non-zero"
  log_info "Before:  bun install, then bunx playwright install chromium. Neither is seeded,"
  log_info "         since a sandbox provisions files and cannot fetch a browser."
  log_info "Action:  /ux-measure"
  log_info "Expect:  Playwright named as the harness, a median per metric beside its threshold,"
  log_info "         a Shifted line naming the banner img the seeded shift moves,"
  log_info "         taken off the run that produced the median rather than merged across three,"
  log_info "         and a reading written to .canon/review/ux-measure-<slug>.md"
  log_info "Second arm: delete playwright.config.ts and the two Playwright entries in package.json,"
  log_info "         re-run, and expect a statement of what the measurement needs rather than a failure"
}
