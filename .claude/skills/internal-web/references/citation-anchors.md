# Citation anchors

Every string in `web/src/content/copy.ts` traces to `README.md`, so the page and the readme cannot drift into saying different things. `readmeCitations` in `src/gate/measures.ts` enforces it, which makes this the one page convention that fails the build rather than failing silently.

`internal/rules/claude/landing-page.md` states the convention. This covers working with it.

## The two forms

A string quoting the readme carries the phrase verbatim:

```ts
// README.md: "<phrase copied from the current README.md>"
```

A string condensing a run of readme lines carries a marker and a reason instead of a distorted quote:

```ts
// canon-allow-readme-paraphrase: <why a quote would distort it>
```

## What the gate actually reads

The gate matches each quoted phrase against `README.md` as it is now. That is the property a line number lacks, since a quoted phrase fails loudly the moment the readme's wording moves where a line number drifts silently.

- It counts **phrases**, not lines. One anchor line may carry several, space-separated, and a citation spanning two phrases sits on one line.
- The paraphrase marker exempts **only the unquoted part** of the string. A marked string that also borrows a verbatim phrase quotes it on the same line, and the gate checks that quote.

## Adding a string

1. Find the readme sentence the string derives from before writing the string. An anchor hunted for after the copy tends to be a phrase that merely shares words.
2. Copy the phrase verbatim, including punctuation inside it.
3. Where no verbatim phrase survives the edit the copy needs, take the paraphrase marker and say in the reason what the quote would have distorted.
4. Run the gate rather than reading the comment back. A phrase that looks copied and carries a changed apostrophe fails, and reading it is exactly how that goes unnoticed.

## The coupling worth knowing

Anchors written now point at a readme that `v100.4` rewrites. A page change and a readme change therefore couple in both directions, since rewriting the readme breaks anchors and adding anchors constrains the rewrite. Neither task can be planned as though the other is not happening.
