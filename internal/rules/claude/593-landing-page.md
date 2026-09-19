---
description: Hold the landing page's five conventions, each of which fails silently when broken
paths:
  - 'web/**'
---

# Landing page standards

The page is this repository's only outward-facing surface, and each rule below
covers a failure that ships looking correct. A build passes, a browser renders,
and the defect reaches a reader who has no way to spot it. That is why they are
a rule rather than a note in a context entry.

Two conventions were rewritten against the current composition, the motion test and the accent set. The other three describe how a page is built rather than how it looks, and each is gated by something real, so a new composition leaves them alone.

## Every count is read, never typed

- Read a count from the CLI at build time, the way `web/src/lib/counts.ts` reads `canon gov counts --json`. Never write a literal.
- Never add a fallback literal behind a failed read. A page that ships a stale number when the read fails is worse than one that fails the build, because nothing downstream can tell the two apart.
- State on the page where a rendered number came from. `web/src/content/copy.ts` carries `countNote` for the catalog counts and `agentView.provenance` for the session rows.

## Every image is generated, never a screenshot pasted in

- Point an image at a file some script writes. The frames under `assets/` come from `scripts/core/regen-hero.sh` and `canon capture`, and `web/public/assets/` symlinks them rather than holding a second copy.
- Say so on the page when a frame is a hand-taken snapshot that no build refreshes, which is what `boardLifecycle.note` does for the task board.
- Never hand-edit a generated artifact. A hand-edit after generation defeats the discipline silently, which is the failure `assets/captures/install.html.tmpl` documents for the terminal frames and `scripts/core/regen-agent-fixture.sh` inherits for the session rows.

## A motion earns its place by asserting something a still cannot

- Ask of each motion whether the page would say less with the end state alone. A row reaching Completed asserts a dispatch finishing, and a card arriving asserts a glob firing. A fade that only announces a section asserts nothing and is decoration.
- Set no number on how many motions the page carries. A count never improved a call and only produced arithmetic about whether one flip belonged to a second motion. The walkthrough is the backstop, since a page that drifted to a crowd of motions is visible to a person and is not a silent failure.
- Treat a reveal as an assertion when its order carries the claim, such as a trigger landing before the effects it causes. Treat it as an entrance when it plays the same on every section. An entrance is one decision made once, and a section that tunes its own arrival has started making a claim, so it answers to the test above.
- Give every animation a `prefers-reduced-motion: reduce` branch that still lands the state change. A transition carried by a class survives the branch where one carried by the motion alone does not.

## The accent is closed to three uses, and identity is none of them

- `--color-accent` has three uses and the set is closed: structure, action, and status. A fourth use is not a fourth category. Argue it into one of the three or leave the accent out, because every new category arrives with a reason as good as the last and the set holds only while it cannot grow.
- Status is a state the surface it shows would color, such as the open state of a pull request. Reach for `--color-success` or a surface and border token when a section separates a state that is not that one.
- Leave identity outside the set. The brand mark drawn in the accent marks neither structure, action, nor status, so it does not count and does not open a fourth category.
- Name the token `--color-accent` in a rule or a comment. `global.css` aliases it to `--mark` inside the page, and a rule naming a token the tree does not define fails silently.
- Keep the accent out of persistent chrome. The nav marks the active beat with a tinted pill in ink, so a reader's place on the page is not one of the accent's uses.

## Every citation is a quoted phrase, never a line number

- Anchor a string in `copy.ts` to `README.md` with `// README.md: "<phrase>"`, a phrase copied verbatim from the current `README.md` text. A line number drifts silently the moment the cited line moves, where a quoted phrase fails loudly instead, which is what `readmeCitations` gates on in `src/gate/measures.ts`.
- Mark a string that condenses or paraphrases a run of `README.md` lines rather than quoting one with `canon-allow-readme-paraphrase: <reason>` instead of forcing a distorted quote.
- Write a citation with more than one phrase as `// README.md: "<phrase>" "<phrase>"`, space-separated on the one anchor line, rather than splitting it across two comments.
- Put a quote on the same line as `canon-allow-readme-paraphrase` when the marked string also borrows a phrase verbatim. The marker exempts only the part of the string that isn't in quotes, so `readmeCitations` still checks the quoted part against the current `README.md` text.

## Before shipping

- Run `bun run web:build`, which runs `astro check` over the page. `web/` sits outside the `types` stage in `src/gate/stages.ts`, so this is the only typecheck it gets.
- Run `cd web && bunx playwright test`. The suite asserts the section count, so a section added or removed fails it by design.
