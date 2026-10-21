#!/usr/bin/env bash
# Writes the step summary saying whether the captured landing page frames match
# the committed baseline, called by the capture job in pr-visual-checks.yml. A
# moved capture is expected when a catalog the page counts has moved, so it
# reports and never fails.
set -e

if git diff --quiet -- assets/evidence/home; then
  echo "The captured frames match the committed baseline." >>"$GITHUB_STEP_SUMMARY"
  exit 0
fi
{
  echo "### The landing page capture moved"
  echo
  echo "These frames differ from the committed baseline. That is expected"
  echo "when a catalog this page counts has moved, and it is not a failure."
  echo
  echo '```'
  git diff --stat -- assets/evidence/home
  echo '```'
  echo
  echo "Download the \`landing-page-capture\` artifact to view them."
} >>"$GITHUB_STEP_SUMMARY"
