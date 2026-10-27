# UI copy standards

## Punctuation

- Write no em dash (`—`) or semicolon in rendered copy. Use a comma or a period, or restructure the sentence.
- Add no trailing period to a heading, label, button, nav item, caption, status, or one-sentence tagline.
- Rewrite a two-sentence tagline as one sentence rather than keeping a period inside it.
- Keep end punctuation on body copy, messages, and quoted text, which a reader reads as prose.

## Button copy

- Label a button with the verb of the action it performs, such as `Save` or `Delete`, never with filler such as `Click to delete`.

## Error messages

- Tell the person how to fix the error, such as `Enter an email address` over `Email is invalid`.
- Keep an error message to one short sentence in plain language, with no technical jargon or error codes.

## Placeholder text

- Never use placeholder text as a label, a hint, or an example. Put a format example such as `name@example.com` in hint text under the label.

## Sentence case

- Use sentence case for rendered headings, labels, nav items, tab titles, and dialog titles, since title case on every heading reads as a template default.
- Keep the original casing of a proper noun or product name, such as `GitHub`, `macOS`, or `TypeScript`.

## Uppercase labels

- Keep small uppercase labels above headings to `ceil(sections / 3)`, the first screen counting as one. Delete the extra labels, since position already names a section.

## Where it applies

- Apply the same casing to interface copy kept outside the globs, such as a locale file, which this rule never fires on.

## Overriding

- Depart from sentence case only where the case needs it, such as an acronym, a brand mark, or a set-in-caps identity the design chose on purpose.

## Default target

- Open a link in the same tab. Reserve `target="_blank"` for a page the person must consult while finishing a task in the current one.
- Never add `target="_blank"` as a default for every external link.

## mailto: links

- Open a `mailto:` link in the same tab. It hands off to the mail client rather than replacing the page, so a new tab leaves an empty tab behind.
