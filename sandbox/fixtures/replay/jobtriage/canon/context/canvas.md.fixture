---
title: Canvas
description: React Flow surface, reducer, view layouts, and tool-call-to-dispatch bridge
---

# Canvas

Spatial workspace rendered to the right of the chat rail. Retrieved ads become React Flow nodes the agent drives via eight spatial tools. The architectural rationale (why spatial instead of inline cards) lives in `canon/ARCHITECTURE.md` under "Spatial tool layer over inline cards". This entry holds the wiring.

## Layer responsibilities

- `canvas-state.ts` owns the reducer, `CanvasState` shape, and thirteen action types
- `canvas-provider.tsx` owns sessionStorage hydration and write-through
- `canvas-surface.tsx` owns the React Flow root, layout translation, and drag dispatch
- `canvas-bridge.tsx` translates AI SDK tool parts into reducer dispatches via `toCanvasAction`
- `views/layout.ts` owns the five layout strategies (grid, group, timeline, compare, shortlist)
- `export/` owns the shortlist export module: pure markdown and CSV builders, filename slug, blob-plus-anchor download, and the split-button toolbar entry. Reads `state.pinnedAdIds`, `state.adRegistry`, and `state.profileMatches`. Does not dispatch.

## Data-spatial pairing

The system prompt fixes the default pairing. The agent calls at least one spatial tool after each data tool in the same turn:

| Data tool                      | Spatial tool                                   |
| ------------------------------ | ---------------------------------------------- |
| `searchJobs`, `semanticSearch` | `placeAds`                                     |
| `triageBatch`                  | `groupAds` (or `placeAds` when no clear tiers) |
| `matchProfile`                 | `connectProfileToAds`                          |
| `compareRoles`                 | `pairAdsForCompare`                            |
| `deadlineWatch`                | `placeAdsOnTimeline`                           |
| `trackStatus`                  | `markStatus`                                   |

Profile-fit intent stacks two spatial calls. When the user references themselves, their profile, or "fits me" or "best for me", and a profile is saved, the agent calls `connectProfileToAds` in addition to the default pairing. The Triage view supports clusters and edges simultaneously, so `groupAds` plus `connectProfileToAds` after `triageBatch` is the canonical profile-fit composition. When no profile is saved, the agent skips `connectProfileToAds` and asks the user to add one.

## Decisions

### sessionStorage is the source of truth, not the agent

The full canvas state hydrates from `SESSION_KEYS.canvas` on first render and writes through on every reducer step. The agent can re-emit a spatial tool with the same `toolCallId` and the reducer drops the dispatch via `appliedToolCallIds`. A page refresh restores the last persisted canvas, not the agent's last message.

### Agent picks layout strategy, never coordinates

Spatial tools accept a `layout: "grid" | "stack"` hint and an emphasis hint, never pixel coordinates. The client owns layout math in `views/layout.ts`. User drag overrides persist in `state.nodePositions` and survive view switches via `pruneNodePositions` which drops coords for ads no longer visible.

### Pinning stays client-side

The deployed web demo never writes back to `engagements/log.md`. Pin and unpin update `state.pinnedAdIds` in sessionStorage only. The Typer CLI is the only path that mutates the canonical engagement log, which preserves the stateless deploy posture. The user-initiated pin in `ad-node.tsx` dispatches with a synthetic `toolCallId` of `user-pin-${adId}-${Date.now()}` so the dedupe map never collides with agent dispatches.

## Gotchas

### `New chat` clears canvas plus chat plus shortlist, never profile or provider

Header `New chat` action behind a confirmation dialog resets `CanvasState` to `INITIAL_CANVAS_STATE` and clears `jobtriage:chat-messages`. Profile and provider key persist. Switching provider clears chat plus canvas in addition to rotating the key.

### Chat message hydration cannot restore a half-finished stream

`useChat` hydrates from `jobtriage:chat-messages` once on mount and writes the messages array to sessionStorage only when `status === 'ready'`. A refresh during streaming drops the in-flight assistant turn rather than restoring half of it.

### View-switch position persistence

When a user drags a node, `setNodePosition` writes to `state.nodePositions[nodeId]`. On layout rebuild (view change, new `placeAds`, etc.), `buildLayout` produces fresh default positions. `toFlowNode` looks up `state.nodePositions[node.id]` first and overrides when present. Profile node at `PROFILE_NODE_ID` persists across views except the empty Shortlist case (Shortlist view with `pinnedAdIds.length === 0`), where `shouldShowProfileNode` excludes it so it does not peek behind the centered empty-state overlay. The node returns the moment an ad is pinned or the view changes.

### Match edges read `profileMatches`, not `groups`

`connectProfileToAds` sets `state.profileMatches` (an array of `{ adId, score, rationale }`) and switches `emphasis` to `matchScore`. Match edges render from profile to every visible ad that has a match link. `groupAds` does not touch `profileMatches`, so `groupAds` followed by `connectProfileToAds` correctly produces clusters plus edges. The reverse order would reset `emphasis` back to `none` on the `groupAds` dispatch.

## Hidden contracts

- Bridge expects `message.parts[i]` to have `type` starting with `tool-` or equal to `dynamic-tool`, `state === 'output-available'`, and a `toolCallId`. `output` for data tools must have shape `{ results?: AdCardData[] }` with `ad_id` as a string. Spatial dispatches are deduped by `toolCallId`, so re-emitting the same tool-call drops the duplicate dispatch.
- Ad node minimal shape: `ad_id`, `headline`, `employer_name`, `municipality`, `days_until_deadline`, `application_deadline`, `description_excerpt`, `webpage_url`. Missing ads render "Loading ad".
- Match link tone is computed by `matchToneFor(score)` in `match-tone.ts`. Edge strokeWidth and opacity scale with score. Stroke color maps to `MATCH_TONE_STROKE` (strong, consider, pass).
- View tabs (triage, timeline, compare, shortlist) dispatch `setView` without a `toolCallId` to mark the change as user-initiated. The reducer uses the absence as the signal.
- `appliedToolCallIds` caps at 100 entries via `uniquePush`. Older entries get evicted, so a long session can in principle re-dispatch a stale tool-call. Not observed in practice with the 8-step cap, but worth knowing.
