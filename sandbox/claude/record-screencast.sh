#!/usr/bin/env bash
set -e
set -o pipefail

use_config() {
  export SANDBOX_SKIP_AUTO_COMMIT="true"
  export SANDBOX_INJECT_SEEDS="true"
}

stage_setup() {
  select_or_route_scenario "Which scenario?" "resolved" "refused"

  case "$SELECTED_OPTION" in
  "resolved")
    mkdir -p .canon/tmp/screencast demos
    cat <<'EOF' >.canon/tmp/screencast/cold-open.md
# Screencast: Cold open demo

## 1. Header

- Audience: technical peers
- Length: 20-30s
- Hero moment: the card lands on the board
- Pitch: naming a card and watching it land.

## 3. Beat sheet

### Beat 1: Cold open

- On screen: The empty board
- Action: navigate
- Watch for: The board paints
- Emphasis: none
- Caption: An empty board

### Beat 2: Hero moment

- On screen: A card being named
- Action: type
- Watch for: The title appears in the field
- Emphasis: none
- Caption: Name the card

### Beat 3: Payoff

- On screen: The card on the board
- Action: click
- Watch for: The card lands
- Emphasis: none
- Caption: And it lands
EOF

    cat <<'EOF' >board.html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Board</title>
  </head>
  <body>
    <h1>Board</h1>
    <input id="title" placeholder="Card title" />
    <button id="add">Add card</button>
    <div id="output"></div>
    <script>
      document.getElementById('add').addEventListener('click', () => {
        const value = document.getElementById('title').value
        document.getElementById('output').textContent = value ? 'Added ' + value : ''
      })
    </script>
  </body>
</html>
EOF

    cat <<'EOF' >demos/cold-open.json
{
  "slug": "cold-open",
  "title": "Cold open demo",
  "url": "http://localhost:4173/board.html",
  "viewport": { "width": 1280, "height": 720 },
  "output": { "video": "demos/cold-open.webm", "still": "demos/cold-open.png" },
  "pointer": { "travelMs": 400, "typeDelayMs": 110 },
  "annotations": { "durationMs": 900, "position": "bottom-right", "fontSize": 22 },
  "steps": [
    {
      "beat": 1,
      "name": "Cold open",
      "kind": "navigate",
      "target": "",
      "text": "",
      "waitFor": "h1",
      "holdMs": 600,
      "caption": "An empty board",
      "still": false
    },
    {
      "beat": 2,
      "name": "Hero moment",
      "kind": "fill",
      "target": "#title",
      "text": "Ship the recorder",
      "waitFor": "#title",
      "holdMs": 600,
      "caption": "Name the card",
      "still": false
    },
    {
      "beat": 3,
      "name": "Payoff",
      "kind": "click",
      "target": "#add",
      "text": "",
      "waitFor": "#output",
      "holdMs": 1200,
      "caption": "And it lands",
      "still": true
    }
  ]
}
EOF

    git add . && git commit -m "feat(demo): cold-open draft and a resolved plan" --no-verify -q

    log_step "Scenario ready: run a resolved plan (record-screencast)"
    log_info "Context: .canon/tmp/screencast/cold-open.md paired with demos/cold-open.json, already compiled and fully filled"
    log_info "Before:  bun install, then bunx playwright install chromium. Neither is seeded, since a sandbox provisions files and cannot fetch a browser."
    log_info "Before:  serve board.html on port 4173, e.g. python3 -m http.server 4173, since the plan's url points there"
    log_info "Action:  /canon:record-screencast .canon/tmp/screencast/cold-open.md"
    log_info "Expect:  demos/cold-open.json already exists, so the session skips canon demo compile entirely and never touches the plan"
    log_info "Expect:  canon demo run drives the page and reports the webm, the mp4 if ffmpeg is on PATH, and the still, each on its own line"
    ;;
  "refused")
    mkdir -p .canon/tmp/screencast demos
    cat <<'EOF' >.canon/tmp/screencast/empty-state-tour.md
# Screencast: Empty state tour

## 1. Header

- Audience: technical peers
- Length: 15-20s
- Hero moment: adding the first card
- Pitch: touring the empty state before anything is on the board.

## 3. Beat sheet

### Beat 1: Cold open

- On screen: The empty board
- Action: navigate
- Watch for: The board paints
- Emphasis: none
- Caption: An empty board

### Beat 2: Hero moment

- On screen: The add button
- Action: click
- Watch for: A card appears
- Emphasis: none
- Caption: Add the first card
EOF

    cat <<'EOF' >demos/empty-state-tour.json
{
  "slug": "empty-state-tour",
  "title": "Empty state tour",
  "url": "",
  "viewport": { "width": 1280, "height": 720 },
  "output": { "video": "demos/empty-state-tour.webm", "still": "demos/empty-state-tour.png" },
  "pointer": { "travelMs": 400, "typeDelayMs": 110 },
  "annotations": { "durationMs": 900, "position": "bottom-right", "fontSize": 22 },
  "steps": [
    {
      "beat": 1,
      "name": "Cold open",
      "kind": "navigate",
      "target": "",
      "text": "",
      "waitFor": "h1",
      "holdMs": 600,
      "caption": "An empty board",
      "still": false
    },
    {
      "beat": 2,
      "name": "Hero moment",
      "kind": "click",
      "target": "#add",
      "text": "",
      "waitFor": "#output",
      "holdMs": 1200,
      "caption": "Add the first card",
      "still": true
    }
  ]
}
EOF

    git add . && git commit -m "feat(demo): empty-state-tour draft and a plan missing its url" --no-verify -q

    log_step "Scenario ready: refuse an unresolved plan (record-screencast)"
    log_info "Context: .canon/tmp/screencast/empty-state-tour.md paired with demos/empty-state-tour.json, already compiled but url is still empty"
    log_info "Action:  /canon:record-screencast .canon/tmp/screencast/empty-state-tour.md"
    log_info "Expect:  demos/empty-state-tour.json already exists, so the session skips canon demo compile and calls canon demo run directly"
    log_info "Expect:  the run refuses with reason plan-unresolved, the session reports url as the missing field, and it stops"
    log_info "Expect:  no browser launch, no guessed url, and no edit to demos/empty-state-tour.json"
    ;;
  *)
    log_error "Unknown scenario: $SELECTED_OPTION"
    ;;
  esac
}
