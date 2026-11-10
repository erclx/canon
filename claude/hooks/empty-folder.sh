#!/bin/sh
# Points a session started in an empty folder at canon:target-scaffold.
#
# The skill listing drops the least-used skills' descriptions first once it
# passes its character budget, and target-scaffold is rarely used, so a plain
# "start a new project here" never saw it. This context reaches the session
# whatever the listing keeps.
#
# Empty means what step 2 of target-scaffold tests: nothing but `.git`. A
# folder holding only a dotfile such as `.gitignore` is a project, so the hook
# stays silent there. It fires in every folder of every project with canon
# installed, so it reads one listing, writes nothing, and exits 0 on every path.

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
