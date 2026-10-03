#!/usr/bin/env bash

# canon-no-seed: stages this checkout's own claude/skills and src/cli.ts, which a target does not carry. The target route is feature-cloud-target-setup's.

# A Claude Code cloud session loads no plugin, so on the VM this copies the
# plugin skills to where a project session lists them, links the standards
# their bodies cite as ../../standards, and makes `canon` the checkout's CLI.
# Locally it exits before touching anything, since every session start here
# runs it too.

# The payload goes unread, but draining it keeps the writer off a closed pipe.
# Bounded, so a run by hand on a terminal does not block.
[ -t 0 ] || IFS= read -r -d '' -t 2 _

[ "${CLAUDE_CODE_REMOTE:-}" = true ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$root" || exit 0
[ -d claude/skills ] || exit 0

exclude=$(git rev-parse --git-path info/exclude 2>/dev/null) || exit 0
mkdir -p "$(dirname "$exclude")" .claude/skills
touch "$exclude"

# Both paths stay out of every commit through the exclude file rather than
# .gitignore, which would itself be a diff. A tracked skill of the same name
# is left alone, since overwriting it would be one.
exclude_once() {
  grep -qxF "$1" "$exclude" || printf '%s\n' "$1" >>"$exclude"
}

for src in claude/skills/*/; do
  name=$(basename "$src")
  dest=".claude/skills/$name"
  [ -z "$(git ls-files -- "$dest")" ] || continue
  rm -rf "$dest"
  cp -R "$src" "$dest"
  exclude_once "/$dest/"
done

[ -e .claude/standards ] || ln -s ../standards .claude/standards
exclude_once '/.claude/standards'

# A SessionStart hook's stdout reaches the session as context, which is the
# only place a failed install surfaces before a skill calls a verb that is not
# there, so the runner's own lines travel with the verdict.
if ! output=$({ bun install && bun link; } 2>&1); then
  printf '%s\n' 'cloud-setup.sh copied the plugin skills, but bun install or bun link failed, so canon is not installed and every skill calling it will fail.'
  printf '%s\n' "$output" | tail -n 20
fi
exit 0
