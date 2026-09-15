#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "source" "greenfield"

  case "$SELECTED_OPTION" in
  "source")
    cat <<'EOF' >package.json
{
  "name": "sandbox-design-extract",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    cat <<'EOF' >>CLAUDE.md

# Notes app

Small Vite + React notes app. Voice is calm and direct. Dense screens, sparing accent color, no animation.

## Commands

- `bun run dev`: start vite dev server
- `bun run check`: lint and typecheck
EOF

    mkdir -p .claude
    cat <<'EOF' >>canon/REQUIREMENTS.md

# Requirements

- Users can write, edit, and tag notes
- Surfaces stay dense, no decorative whitespace
- No motion or transitions in this iteration

## Non-goals

- No realtime collaboration
- No image upload
EOF

    mkdir -p src/styles src/components
    cat <<'EOF' >src/styles/tokens.css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;

  --color-bg: #ffffff;
  --color-surface: #f7f7f7;
  --color-text: #1a1a1a;
  --color-muted: #6b6b6b;
  --color-accent: #2563eb;
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;

  --radius-default: 4px;
  --radius-pill: 999px;

  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
EOF

    cat <<'EOF' >src/components/Button.tsx
import "./Button.css";

type Variant = "primary" | "secondary";

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
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-default);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
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
EOF

    cat <<'EOF' >src/components/Note.tsx
export function Note({ title, body }: { title: string; body: string }) {
  return (
    <article
      style={{
        padding: "var(--space-md)",
        background: "var(--color-surface)",
        borderRadius: "var(--radius-default)",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "20px",
          fontWeight: 600,
          lineHeight: 1.3,
          color: "var(--color-text)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          lineHeight: 1.5,
          color: "var(--color-muted)",
        }}
      >
        {body}
      </p>
    </article>
  );
}
EOF

    git add . && git commit -m "feat(notes): seed minimal notes app with token system" --no-verify -q

    log_step "Scenario ready: design extract from a tokenized notes app"
    log_info "Context: Vite/React notes app with CLAUDE.md personality, tokens.css, and components"
    log_info "Signals the skill should pick up:"
    log_info "  CLAUDE.md voice paragraph: calm, direct, dense, sparing accent, no animation"
    log_info "  src/styles/tokens.css: color, spacing, radius, font tokens"
    log_info "  src/components/Button.tsx: token usage in a real component"
    log_info "  REQUIREMENTS.md non-goal: no motion or transitions"
    log_info "Action 1: /canon:design-extract"
    log_info "Expect:   source path announced, canon/DESIGN.md token tables filled from tokens.css"
    log_info "Action 2: canon design render"
    log_info "Expect:   .canon/tmp/render/design/index.html with swatches, samples, and bars"
    ;;
  "greenfield")
    cat <<'EOF' >package.json
{
  "name": "sandbox-design-propose",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
EOF

    mkdir -p .claude
    cat <<'EOF' >>canon/REQUIREMENTS.md

# Requirements

A focus timer for writers. Single-screen app. Start a session, see elapsed time, end and log the run.

## Personality

Quiet and disciplined. The app should feel like a clean desk at dawn: uncluttered, warm paper tones, a single confident accent for the active state. No decoration, no motion, no sound. The reader should trust the timer is running without needing reassurance from the interface.

## Non-goals

- No team features
- No statistics dashboard
- No motion or transitions
EOF

    cat <<'EOF' >>canon/ARCHITECTURE.md

# Architecture

- Vite plus React single-page app
- Local storage for session history
- No backend, no auth, no network calls
EOF

    git add . && git commit -m "chore(project): seed greenfield focus timer with personality" --no-verify -q

    log_step "Scenario ready: design extract on its greenfield path"
    log_info "Context: REQUIREMENTS.md with a Personality paragraph, ARCHITECTURE.md, no code"
    log_info "Signals the skill should pick up:"
    log_info "  Personality: quiet, disciplined, warm paper tones, single accent, no motion"
    log_info "  Non-goals: no motion or transitions"
    log_info "  Architecture: Vite plus React web app (informs typography choices)"
    log_info "Action 1: /canon:design-extract"
    log_info "Expect:   greenfield path announced, canon/DESIGN.md proposed, most cells marked ? verify"
    log_info "Action 2: canon design render"
    log_info "Expect:   .canon/tmp/render/design/index.html renders cleanly with swatches and samples"
    log_info "Expect:   every tagged cell shows a ? verify marker beside its value, never inside it"
    log_info "Expect:   the confidence line reports nearly every counted cell tagged on this path"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
