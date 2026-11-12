#!/bin/sh
# Fake gh for the pr preview --check tests in src/commands/pr/preview.test.ts. Reads FAKE_LOG and FAKE_TIP.
echo "$*" >>"$FAKE_LOG"
case "$1 $2" in
"api repos/{owner}/{repo}/pulls/1") printf '{"number":1,"head":{"ref":"feat/x","sha":"%s"}}' "$FAKE_TIP" ;;
"run list") printf '[{"databaseId":7,"status":"completed","conclusion":"success","headSha":"%s","createdAt":"2026-10-02T10:00:00Z"}]' "$FAKE_TIP" ;;
*) exit 0 ;;
esac
