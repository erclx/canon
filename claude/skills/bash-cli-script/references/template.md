# Wrapper template

Copy this skeleton for a small non-interactive wrapper. Keep only the parts the task needs, and stop at 100 lines.

```bash
#!/usr/bin/env bash
set -euo pipefail

log() { printf '%s\n' "$*" >&2; }

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

[ $# -ge 1 ] || die "usage: script.sh <arg>"

log "starting"
```
