## Summary

Cache each station's week of tides on the device to open the station page without waiting on the tide service. A cold open of the Cascais week view now paints the table in 180 milliseconds against 1,420 before.

## Key changes

- Read the week from `src/tides/cache.ts` before fetching in `src/tides/week.ts`, refetching behind the painted table.
- Add `src/tides/cache.ts`, which keeps the last fetched week per station and drops one older than 24 hours.
- Cover the stale and missing cache cases in `src/tides/cache.test.ts`.

## Technical context

- The cache trades freshness for speed, so a reopened station can show tides up to 24 hours old until the refetch lands about a second later.
- A tide table changes only when the service republishes a prediction, so a day-old week differs from a fresh one only after a correction.

## Outcome

| What was measured                  | Result | Baseline | Conditions                                  |
| ---------------------------------- | ------ | -------- | ------------------------------------------- |
| Cascais week view, table paint, ms | 180    | 1,420    | median of 10 cold opens, mid-tier phone, 4G |
| Peniche week view, table paint, ms | 175    | 1,390    | median of 10 cold opens, mid-tier phone, 4G |
| Bundle size added, kB gzipped      | 0.6    | 0        | production build                            |

## Testing

- [x] `bun test src/tides/cache.test.ts` passes, 5 tests.
- [x] `bun run perf:week --runs 10` reports the medians in the table.
