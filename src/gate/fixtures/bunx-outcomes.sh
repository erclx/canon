#!/usr/bin/env bash
# Fake bunx for src/gate/install-playwright-deps.test.ts. Each call takes the
# next line of FAKE_OUTCOMES: hang outlives the bound, ok succeeds, and a
# number exits with that code. Every call is logged to FAKE_LOG.
echo "bunx $*" >>"$FAKE_LOG"
outcome=$(head -n 1 "$FAKE_OUTCOMES")
tail -n +2 "$FAKE_OUTCOMES" >"$FAKE_OUTCOMES.next"
mv "$FAKE_OUTCOMES.next" "$FAKE_OUTCOMES"
if [ "$outcome" = hang ]; then exec sleep 30; fi
if [ "$outcome" = ok ]; then exit 0; fi
exit "$outcome"
