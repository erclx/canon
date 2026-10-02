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
  "name": "sandbox-ux-audit",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

  cat <<'EOF' >>CLAUDE.md

# My App

Vite + React task list. Uses CSS modules and a small token system.

## Commands

- `bun run dev`: start vite dev server
- `bun run check`: lint and typecheck
EOF

  mkdir -p .claude
  cat <<'EOF' >>canon/DESIGN.md

# Design

## Spacing scale

Use the spacing tokens, never raw px:

- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-6`: 24px

## Color tokens

- `--color-fg`: #1a1a1a
- `--color-fg-muted`: #6b6b6b
- `--color-bg`: #ffffff
- `--color-accent`: #2563eb
- `--color-danger`: #dc2626

## Button variants

Two variants only: `primary` (accent background, white text) and `secondary` (transparent background, accent text and border). No third variant. Both use `--space-2` vertical padding and `--space-4` horizontal.

## Icons

Use Lucide icons exclusively. Icon size matches text size of the surrounding label.
EOF

  mkdir -p canon/wireframes
  rm -f canon/wireframes/feature-name.md
  cat <<'EOF' >canon/wireframes/index.md
---
title: Wireframes
subtitle: Per-surface ASCII layouts loaded on demand
---

# Wireframes
EOF

  cat <<'EOF' >canon/wireframes/task-list.md
---
title: Task list surface
description: Vertical list of task rows on the home view.
---

# Task list surface

A vertical list of task rows. Each row shows the task title and a checkbox.

States:

- **Loading**: skeleton rows
- **Empty**: centered illustration with copy "No tasks yet. Add one to get started." and a primary button "Add task"
- **Populated**: list of rows
- **Error**: inline error banner above the list with a retry button
EOF

  cat <<'EOF' >canon/wireframes/add-task.md
---
title: Add task surface
description: Modal dialog for creating a new task.
---

# Add task surface

Modal dialog with a single text input and a primary "Add" button plus a secondary "Cancel" button.
EOF

  cat <<'EOF' >>canon/REQUIREMENTS.md

# Requirements

- Users can view, add, and complete tasks
- The task list always communicates its state (loading, empty, populated, error)

## Non-goals

- No filtering, sorting, or search in this iteration
EOF

  mkdir -p src/components src/styles
  cat <<'EOF' >src/styles/tokens.css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;

  --color-fg: #1a1a1a;
  --color-fg-muted: #6b6b6b;
  --color-bg: #ffffff;
  --color-accent: #2563eb;
  --color-danger: #dc2626;
}
EOF

  cat <<'EOF' >src/components/Button.tsx
import "./Button.css";

type Variant = "primary" | "secondary" | "ghost";

export function Button({
  variant = "primary",
  children,
  onClick,
}: {
  variant?: Variant;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
}
EOF

  cat <<'EOF' >src/components/Button.css
.btn {
  padding: 12px 18px;
  border-radius: 6px;
  font-size: 14px;
}

.btn-primary {
  background: var(--color-accent);
  color: white;
  border: none;
}

.btn-secondary {
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
}

.btn-ghost {
  background: transparent;
  color: var(--color-fg-muted);
  border: none;
}
EOF

  cat <<'EOF' >src/components/TaskList.tsx
import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import * as MaterialIcons from "@mui/icons-material";
import { Button } from "./Button";

type Task = { id: string; title: string; done: boolean };

export function TaskList() {
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then(setTasks);
  }, []);

  if (tasks === null) {
    return null;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 14 }}>Tasks</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {tasks.map((t) => (
          <li
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
            }}
          >
            <Check size={16} />
            <span>{t.title}</span>
            <MaterialIcons.Delete fontSize="small" />
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={() => {}}>
        Add task
      </Button>
    </div>
  );
}
EOF

  cat <<'EOF' >src/components/AddTaskModal.tsx
import { useState } from "react";
import { Button } from "./Button";

export function AddTaskModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");

  return (
    <div className="modal">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task name"
      />
      <Button variant="primary" onClick={onClose}>
        Add
      </Button>
      <Button variant="primary" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
EOF

  mkdir -p .canon/tasks
  cat <<'EOF' >.canon/tasks/index.md
---
title: Tasks
subtitle: One file per task, ordered by phase label
---

# Tasks

One file per task, ordered by phase label

- [v01.0: Polish task list before review](v01.0-task-list-polish.md): Tidy the task list and add modal ahead of review
EOF

  cat <<'EOF' >.canon/tasks/v01.0-task-list-polish.md
---
title: 'v01.0: Polish task list before review'
description: Tidy the task list and add modal ahead of review
---

# v01.0: Polish task list before review

- [x] Initial task list and add modal landed
EOF

  git add . && git commit -m "feat(ui): initial task list and add modal" --no-verify -q

  log_step "Scenario ready: UX audit with seeded drift"
  log_info "Context: small Vite/React app with DESIGN.md, wireframes/, and components that drift on purpose"
  log_info "Seeded drift to look for in the audit:"
  log_info "  Button.tsx adds a third variant 'ghost' not in DESIGN.md"
  log_info "  Button.css uses raw 12px/18px instead of --space tokens"
  log_info "  TaskList.tsx mixes Lucide and MUI icons (DESIGN.md says Lucide only)"
  log_info "  TaskList.tsx uses inline px styles instead of tokens"
  log_info "  TaskList.tsx renders nothing while loading (no skeleton state from wireframes/)"
  log_info "  TaskList.tsx has no empty state (wireframes/ describes one)"
  log_info "  TaskList.tsx has no error state"
  log_info "  AddTaskModal.tsx has two primary buttons. Cancel should be secondary"
  log_info "Action:  /ux-audit"
  log_info "Expect:  observations grouped by surface, written to .canon/review/ux-audit-<slug>.md"
}
