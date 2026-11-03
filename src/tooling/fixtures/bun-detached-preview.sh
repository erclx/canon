#!/usr/bin/env bash
# Fake bun for src/tooling/screenshot-trap.test.ts. `run preview` starts the
# FAKE_LISTENER script in its own session from node and returns, so a listener
# outlives the pid the script tracks. macOS ships no setsid, and node runs on both.
if [[ "$1 $2" == "run build" ]]; then exit 0; fi
if [[ "$1 $2" == "run preview" ]]; then
  node -e "require('child_process').spawn(process.execPath, [process.env.FAKE_LISTENER], { detached: true, stdio: 'ignore' }).unref()"
  exit 0
fi
if [[ "$1" == "e2e/screenshot.ts" ]]; then exit 0; fi
exit 1
