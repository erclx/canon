#!/usr/bin/env bash
# Prints every seed root carrying a `.claude/` or a `canon/`, one per line and
# relative to the project root.
#
# The discovery rule has one definition, `collect_seed_roots` in
# `scripts/lib/tooling.sh`, which `check-seed-independence.sh` already reads.
# This file is the route a caller outside bash takes to that same answer, so a
# stack seeding either root later reaches both readers and the two stages
# measuring seed content cannot disagree about which roots exist.
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

source "$PROJECT_ROOT/scripts/lib/tooling.sh"

collect_seed_roots
