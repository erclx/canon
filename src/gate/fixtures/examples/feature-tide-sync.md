# Feature: Tide sync

## Summary

- Fetch the next week of tides on launch

## Files to touch

- `src/tides/sync.ts`: fetch and cache the week ahead

## Verification

- The week loads offline: `bun test src/tides/sync.test.ts`

## Risks

- None identified.

## Review focus

- A station with no published tides

## Questions

1. Does sync run on a metered connection?
   - Suggested: no, wait for wifi
   - Evidence: none, a preference the operator holds
   - Answer:
