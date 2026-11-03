#!/usr/bin/env bash
# Fake bun for src/tooling/screenshot-trap.test.ts. `run preview` backgrounds a
# subshell that touches READY_MARKER and returns at once, the way astro preview
# forks, and the capture exits with FAKE_CAPTURE_EXIT.
if [[ "$1 $2" == "run build" ]]; then exit 0; fi
if [[ "$1 $2" == "run preview" ]]; then
  (
    sleep 0.05
    touch "$READY_MARKER"
  ) &
  exit 0
fi
if [[ "$1" == "e2e/screenshot.ts" ]]; then exit "$FAKE_CAPTURE_EXIT"; fi
exit 1
