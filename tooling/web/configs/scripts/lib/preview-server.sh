#!/usr/bin/env bash
# Sourced, not executed. Builds the site, serves it in the background on
# PREVIEW_PORT, and blocks until it answers or exits with an error. Shared by
# scripts/screenshot.sh and scripts/readme-screenshot.sh so the two don't
# carry two copies of the same startup boilerplate.
set -euo pipefail

: "${PREVIEW_PORT:=4173}"

if curl -sSf "http://localhost:$PREVIEW_PORT/" >/dev/null 2>&1; then
  echo "Port $PREVIEW_PORT already in use. Stop the listening process or set PREVIEW_PORT." >&2
  exit 1
fi

bun run build
bun run preview >/dev/null 2>&1 &
PREVIEW_PID=$!
# shellcheck disable=SC2154 # pid is bound by the for loop inside the single-quoted trap body, which shellcheck does not track there
trap 'kill "$PREVIEW_PID" 2>/dev/null || true; if command -v lsof >/dev/null 2>&1; then for pid in $(lsof -ti tcp:"$PREVIEW_PORT" 2>/dev/null); do kill "$pid" 2>/dev/null || true; done; else echo "lsof not found on PATH; cannot confirm the preview port is clear of a detached grandchild." >&2; fi; wait "$PREVIEW_PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  if curl -sSf "http://localhost:$PREVIEW_PORT/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -sSf "http://localhost:$PREVIEW_PORT/" >/dev/null 2>&1; then
  echo "Preview server not responding on port $PREVIEW_PORT after 10s." >&2
  exit 1
fi
