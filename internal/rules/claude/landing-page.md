---
description: Hold the landing page's provenance conventions for counts, images, and README citations, each of which fails silently when broken
paths:
  - 'web/**'
---

# Landing page standards

## Every count is read, never typed

- Read a count at build time from the source that holds it, the way `web/src/lib/film.ts` reads the film's length off its render. Never write a literal.
- Never add a fallback literal behind a failed read, since nothing downstream can tell a stale number from a fresh one.
- Quote a number from a dated record no build re-reads, such as a closed groundwork track or a merged pull request, only with its source and date beside it on the page.
- State on the page where a rendered number came from, as `footer.note` in `web/src/content/copy.ts` and `measured` in `web/src/content/trail.ts` do.

## Every image is generated, never a screenshot pasted in

- Point an image at a file a script writes, such as a frame `canon capture` renders under `assets/`.
- Symlink a frame into `web/public/assets/` rather than holding a second copy.
- Label a hand-taken snapshot no build refreshes as one on the page.
- Never hand-edit a generated artifact, since the next generation silently undoes the edit or the edit silently outlives it.

## Every citation is a quoted phrase, never a line number

- Anchor a string in `copy.ts` to `README.md` with `// README.md: "<phrase>"`, quoting the current `README.md` verbatim.
- Never cite a line number, which drifts silently where a quoted phrase fails `readmeCitations` loudly.
- Mark a string paraphrasing `README.md` with `canon-allow-readme-paraphrase: <reason>` rather than forcing a distorted quote.
- Write a citation with more than one phrase as `// README.md: "<phrase>" "<phrase>"` on the one anchor line, never split across two comments.
- Put a borrowed quote on the same line as `canon-allow-readme-paraphrase`, since the marker exempts only the unquoted part and `readmeCitations` still checks the quote.
- Give every line in `web/src/content/trail.ts` the record it came from and whether it is quoted or reconstructed, and never mark a line quoted that the record does not carry word for word.
