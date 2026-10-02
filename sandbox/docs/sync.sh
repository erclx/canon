#!/usr/bin/env bash
set -e

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "feature" "chore" "noop"

  mkdir -p src

  cat <<'EOF' >src/server.ts
export const config = { port: 8080 };
export function start() { console.log("Starting..."); }
EOF

  cat <<'EOF' >README.md
# API Server

## Configuration

Run on port `8080`.

## Usage

```typescript
start();
```
EOF

  # No mock standards folder. A target holds none, so `docs-sync` reaches the
  # standards it reads through `canon standards <name>` here as it would anywhere.
  git add . && git commit -m "feat(server): add base config and start function" -q

  case "$SELECTED_OPTION" in
  "feature")
    git checkout -b feature/drift -q

    cat <<'EOF' >src/server.ts
export const config = { port: 3000 };
export function start(debug: boolean) { console.log("Starting..."); }
EOF

    git add . && git commit -m "feat(server): change port to 3000 and add debug parameter" -q

    log_step "Scenario ready: feature change"
    log_info "Context: port changed to 3000, new debug parameter on start()"
    log_info "Action:  /canon:docs-sync"
    log_info "Expect:  README updated to reflect port 3000 and debug parameter"
    ;;

  "chore")
    git checkout -b chore/noise -q

    sed -i 's/Starting.../Server is booting up.../g' src/server.ts
    git add . && git commit -m "chore(server): update console log messages" -q

    log_step "Scenario ready: internal change"
    log_info "Context: console log message changed, no user-facing API impact"
    log_info "Action:  /canon:docs-sync"
    log_info "Expect:  no documentation updates required"
    ;;

  "noop")
    git checkout -b test/server-unit-tests -q

    mkdir -p src/__tests__
    cat <<'EOF' >src/__tests__/server.test.ts
import { start } from "../server";

describe("server", () => {
  it("starts without error", () => {
    expect(() => start()).not.toThrow();
  });
});
EOF

    git add . && git commit -m "test(server): add unit tests for start function" -q

    log_step "Scenario ready: no-op"
    log_info "Context: test file added, no changes to public API or user-facing behavior"
    log_info "Action:  /canon:docs-sync"
    log_info "Expect:  preview shows Files: None, no documentation updates required"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
