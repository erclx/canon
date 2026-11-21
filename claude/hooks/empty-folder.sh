#!/bin/sh
# Points a session started in an empty folder at canon:target-scaffold, since a
# plain "start a new project here" never saw it in the listing. Empty means
# nothing but `.git`. It fires everywhere canon is installed, so it writes nothing and exits 0.

dir=${CLAUDE_PROJECT_DIR:-$PWD}
[ -d "$dir" ] && [ -r "$dir" ] && [ -x "$dir" ] || exit 0

for entry in "$dir"/* "$dir"/.[!.]* "$dir"/..?*; do
  [ -e "$entry" ] || [ -L "$entry" ] || continue
  [ "${entry##*/}" = .git ] && continue
  exit 0
done

# Stated as a fact rather than an order, since the hooks reference warns that
# imperative system-style context can trip prompt-injection defenses.
printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"This folder holds nothing but .git. Starting, creating, or scaffolding a project here is the job of the canon:target-scaffold skill, which runs the stack starter through the canon CLI rather than a scaffolder run by hand."}}'
exit 0
