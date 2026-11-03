#!/bin/sh
# Fake gh for the pr close tests in src/commands/pr.test.ts. Reads FAKE_LOG and FAKE_HEAD.
echo "$*" >>"$FAKE_LOG"
case "$*" in
*"-X POST"*) printf 'https://example.test/c/1' ;;
*"-X PATCH"*) exit 0 ;;
*"-X DELETE"*) exit 0 ;;
*pulls/7*) printf '{"number":7,"state":"open","head":{"ref":"%s","repo":{"full_name":"o/r"}},"base":{"repo":{"full_name":"o/r"}}}' "$FAKE_HEAD" ;;
*) exit 1 ;;
esac
