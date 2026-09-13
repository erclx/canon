Review this session for new terms worth adding to `internal/vocabulary.md`. Append qualifying entries directly to the page.

A term qualifies when it names a rhetorical or structural pattern used with clear utility in the session and no matching entry already exists.

1. Resolve the main worktree root via `git worktree list --porcelain | awk '/^worktree /{print $2; exit}'` (fall back to `pwd`).
2. Read `internal/vocabulary.md` at that root.
3. For each new term, build a bullet with three parts on one line:
   - `**Term**` in bold, sentence case.
   - One-line gloss of what the term means.
   - One-line use-when for when to reach for it.
4. Pick the best-fitting existing category (`## Techniques`, `## Anti-patterns`, `## Qualities`, `## Frames`) and insert the bullet at the alphabetically correct position within that section. Do not append at the end. Do not invent new categories.
5. End with `📝 Added: <terms>`, or `✅ No new terms.` when nothing qualifies.

Do not edit or rewrite existing entries. Capture only.
