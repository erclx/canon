#!/usr/bin/env bash
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

source "$PROJECT_ROOT/scripts/lib/ui.sh"

TMP_ROOT="$PROJECT_ROOT/.canon/tmp/install-check"
PACK_DIR="$TMP_ROOT/pack"
EXTRACT_DIR="$TMP_ROOT/extract"
TARGET_DIR="$TMP_ROOT/target"
KEEP=0

for arg in "$@"; do
  case "$arg" in
  --keep) KEEP=1 ;;
  --help | -h)
    cat <<HELP
Usage: scripts/core/install-check.sh [--keep]

Verifies the published install path end to end:
  1. Packs this repo into a tarball at .canon/tmp/install-check/pack
  2. Extracts it and asserts scripts/sandbox is absent from the tree
  3. Runs bun install --production in the extracted tree
  4. Runs the CLI with --help from the extracted tree to confirm it resolves
  5. Scaffolds a fresh project in .canon/tmp/install-check/target
  6. Runs canon init from the extracted package and asserts a scaffold landed

Flags:
  --keep    Keep the tmp tree on exit for inspection
HELP
    exit 0
    ;;
  esac
done

cleanup() {
  if [ "$KEEP" = "1" ]; then
    log_info "Kept artifacts at $TMP_ROOT"
  else
    rm -rf "$TMP_ROOT"
  fi
  close_timeline
}
trap cleanup EXIT

rm -rf "$TMP_ROOT"
mkdir -p "$PACK_DIR" "$EXTRACT_DIR"

open_timeline "Install verification"

log_step "Pack"
TARBALL_PATH="$(cd "$PROJECT_ROOT" && bun pm pack --quiet --ignore-scripts --destination "$PACK_DIR" | tail -n 1)"
log_info "Packed to $TARBALL_PATH"

log_step "Extract"
tar -xzf "$TARBALL_PATH" -C "$EXTRACT_DIR" --strip-components=1
log_info "Extracted to $EXTRACT_DIR"

log_step "Assert excluded path is absent"
if [ -e "$EXTRACT_DIR/scripts/sandbox" ]; then
  log_error "scripts/sandbox shipped in the tarball, and the files field in package.json excludes it"
fi
log_info "Absent: scripts/sandbox"

log_step "Install dependencies (production)"
(cd "$EXTRACT_DIR" && bun install --production --ignore-scripts --silent 2>&1 | pipe_output) || log_error "bun install --production failed"
log_info "Dependencies installed without devDependencies"

log_step "Confirm CLI runs"
(cd "$EXTRACT_DIR" && bun run src/cli.ts --help >/dev/null) || log_error "canon --help failed"
log_info "canon --help ran clean from the extracted package"

log_step "Scaffold fresh project"
mkdir -p "$TARGET_DIR"
(cd "$TARGET_DIR" && git init --quiet)
log_info "Initialized git in $TARGET_DIR"

log_step "Run canon init"
(cd "$TARGET_DIR" && CANON_NON_INTERACTIVE=1 bun run "$EXTRACT_DIR/src/cli.ts" init --stack base 2>&1 | pipe_output) || log_error "canon init failed"
log_info "canon init completed"

log_step "Assert scaffold"
# Every domain canon init installs needs at least one path here. A domain with
# no assertion can truncate silently: init still exits 0 because run_domain
# catches a failed domain, and the gate stays green while the target is
# missing everything that domain provides.
#
# Standards and snippets name no path because neither corpus installs into a
# target. A scaffold reads a standard through `canon standards <name>` and a
# snippet through the plugin's live `claude/snippets` symlink, both resolving
# against the toolkit rather than a copy this gate could assert on. The
# `@`-reference convention rule is the one snippets-domain file that still
# installs, since `base` carries `governance/rules/snippets/` as a
# folder-whole entry the same way it does `core` and `claude`.
for path in "CLAUDE.md" ".claude/wiki/index.md" ".claude" "canon/context/index.md" "canon/wireframes/index.md" ".canon/diagrams/index.md" \
  ".prettierrc" ".editorconfig" ".lintstagedrc" ".husky/pre-commit" ".github/workflows/verify.yml" "scripts/verify.sh" \
  ".claude/rules/canon/core/000-constitution.md" ".claude/rules/canon/snippets/600-at-references.md"; do
  if [ ! -e "$TARGET_DIR/$path" ]; then
    log_error "Missing after canon init: $path"
  fi
  log_info "Found: $path"
done

if [ ! -x "$TARGET_DIR/scripts/verify.sh" ]; then
  log_error "Not executable after canon init: scripts/verify.sh"
fi
log_info "Executable: scripts/verify.sh"

log_step "Verification passed"
log_info "Manual check still needed: bun link and global canon invocation"
