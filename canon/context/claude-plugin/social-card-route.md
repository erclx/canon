---
title: Social card route
description: Why the card is a route the project keeps, the build-exclusion measurement that scopes it to Astro, and why the Next path waits
---

# Social card route

`draft-identity` keeps the picked card as a route in the project, captured through a running server, so the composition reads the project's own stylesheet, tokens, and fonts. A scratch page captured once and deleted is the alternative it replaces. That leaves only a PNG behind, so renaming a project means another pass through the pick loop with an operator in it to move one string, and the page has to inline every rule and type every color because it has nowhere to live.

## Build exclusion by framework

Next and vite-react carry no structural build exclusion as clean as Astro's `srcDir`, and the three differ enough that one shared scaffold does not cover them. Measured at `dea5b47b` on 2026-09-20.

- **Astro: yes, structural.** A second config sets `srcDir` at a folder the page router never reads. This repository proves it with the gallery's own second config, whose comment states it excludes the gallery structurally rather than by a filename convention, and a shell check fails on a leak.
- **Next: no.** The App Router has no build-time route exclusion. Its practical workaround is a `pageExtensions` regex over a filename pattern, which is the convention the Astro approach was chosen over, and a route group such as `app/(debug)/` needs a runtime environment check instead. Four open discussions in the Next.js repository ask for the feature, which is the clearest evidence it does not exist.
- **vite-react: the question does not apply.** It builds a single-page app with no page router, so routes are client-side and a build has nothing to exclude. A card there is a second Rollup entry rather than a route, which is a third shape.

What the measurement settles is that the exclusion problem belongs to the serve-and-capture approach alone, where the card page is scaffolding rather than product. Next needs no exclusion at all on the path it will eventually take, because `ImageResponse` is that framework's own intended production mechanism and a card route there is meant to be served.

## Why the Next path waits

Serve-and-capture ships first and `ImageResponse` follows. Both were available and one was picked rather than both built.

Serve-and-capture covers Astro and vite-react and reads real values off a running page. The `ImageResponse` path fixes less than the measurement makes it look like it would: satori supports a CSS subset and wants `display: flex` on nearly every box, so a card written for it carries inline styles rather than the project's own cascade, which is the defect the route exists to close. No target is asking for it, so the route ships for Astro alone.

A project with no page router at all takes the scratch-page capture, and the skill says so rather than reporting a source it did not write. That arm is what keeps the skill working on a project that is not a web app.

## The write-folder measurement

Across four repositories, one kept `public/` at the root and was found, two kept theirs at `web/public/` and were missed, and one kept its favicon under `web/src/app/` with no `public/` anywhere. Three of four therefore received their files at the repository root while the announcement read as a detected folder. Measured at `dea5b47b` on 2026-09-20.

That measurement lives here rather than in the skill body, because a body shipping to every target may not state a count or a folder shape true of one operator's checkout. A reader in a target cannot open those four repositories, so the number tells them nothing about their own tree. The body carries the principle the number produced: a root-only check misses a project keeping its assets a level down or under a framework convention.

## The card reads only properties the design system emits

The route names `--color-background` and `--color-text`, which is what `canon design css` emits. A property the design system does not define, such as `--color-ground` or `--font-body`, takes its fallback in every project carrying the design files, so the card renders white in the browser default face, captures at the right dimensions, and reports success.

That is the same failure the route closes, with the palette swapped for the font. A card built from typed values is the defect, and a card reading custom properties that resolve to nothing is that defect wearing the syntax of the fix. The route sets no `font-family` at all for the same reason, since the design system emits no font token and inheriting the project's body font reads a real value where a token would have read nothing.

## The favicon keeps its own path

The favicon is not conformed to the shape the card takes, and the divergence is deliberate rather than unfinished. It is generated from a token file with no browser in the loop, it carries a `prefers-color-scheme` branch a captured PNG cannot hold, and it already has its own color source. A card route reading a running stylesheet answers none of those three, so pointing the favicon at one would cost the theme branch and buy nothing.

What the card route does change for the favicon is where it lands, since `draft-identity` writes both into the same detected folder and that detection now walks one level down.

## Where the pieces sit

The route, its second config, and the exclusion check ship as golden configs in the `astro` tooling stack rather than the `web` layer, because all three are Astro-format files and that layer's own rule puts framework glue in the per-stack adapter. The stack's own precedent agrees, a dev-only scenario switcher shipped as an `.astro` golden config.

What the `web` layer does own is when the check runs. Its `scripts/verify.sh` runs the card exclusion check after its build stage whenever that script is installed, testing for the script rather than for a framework. That keeps the exclusion on the default path rather than behind a flag, and it leaves a project with no card route one stage shorter with no override to write.

The capture needed nothing added to it. `canon capture` already reads an `http(s)://` source, where `--out` names the destination PNG rather than a directory. Its 2x device scale factor is fixed with no flag, which is why the route declares its card element at 600x315 to land a 1200x630 capture, and why the route carries that halving as a comment rather than as a surprise.
