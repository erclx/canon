---
title: Default reference sites
description: Default sites a design-references run captures when nobody names one, what each is a reference for, and the pinned community DESIGN.md collection folder per site
---

# Default reference sites

Read at Step 1 when neither the ask nor the `references` key names a site, and at Step 6 for every site. A project overrides the list through that key, since taste in sites belongs to the project.

## The list

Each site earns its place by being a reference a designer would cite, capturing clean by section, and differing from the others in kind or theme, so no one look becomes the default.

| Site       | Address                    | Kind                  | A reference for                                                     | Folder       |
| ---------- | -------------------------- | --------------------- | ------------------------------------------------------------------- | ------------ |
| Notion     | `https://www.notion.com/`  | Marketing, light      | Illustration beside product windows, pastel feature cards           | `notion`     |
| Linear     | `https://linear.app/`      | Marketing, dark       | A dark product page carried by its screenshots and tight type       | `linear.app` |
| Vercel     | `https://vercel.com/`      | Marketing, monochrome | A near-monochrome grid, dense logo and stat rows                    | `vercel`     |
| Stripe     | `https://docs.stripe.com/` | Docs                  | A docs shell, being side navigation, reading width, and code panels | `stripe`     |
| Apple      | `https://www.apple.com/`   | Retail, photographic  | Full-bleed product photography with very little text per band       | `apple`      |
| ElevenLabs | `https://elevenlabs.io/`   | Marketing, many bands | Many short bands stacked, and the rhythm between them               | `elevenlabs` |
| Raycast    | `https://www.raycast.com/` | App-like, dark        | A marketing page shaped like the app, with keyboard-led UI shown    | `raycast`    |

Pick three that differ in kind and theme on a run with no ask, such as one light marketing page, one dark one, and the docs shell. An app shell behind a sign-in cannot be captured, so Raycast stands in for one.

## App UI

Read at Step 1 instead of the list above when the decision is an app surface, such as a dashboard, a planner, or a mobile flow. Each entry is a public page that shows real product screens, so a draft takes structure from an app rather than from marketing layout. An app shell behind a sign-in cannot be captured, so these pages stand in for one.

| Site      | Address                  | Kind             | A reference for                                                     | Folder |
| --------- | ------------------------ | ---------------- | ------------------------------------------------------------------- | ------ |
| Todoist   | `https://todoist.com/`   | Planner, light   | A task list beside a sidebar, and the same list at phone width      | none   |
| Wanderlog | `https://wanderlog.com/` | Travel, light    | An itinerary column beside a map, with booking cards in the list    | none   |
| Oura      | `https://ouraring.com/`  | Health, dark     | Phone screens of score rings, trend charts, and stacked detail      | `oura` |
| Brilliant | `https://brilliant.org/` | Education, light | A lesson canvas with a tutor panel, and answer tiles under a prompt | none   |

Pick three that differ in kind and theme on a run with no ask. Each was captured at 1440 wide and read for real screens in its first sections.

The collection holds no folder for a site whose Folder reads none, so Step 6 reads its file as absent. Wanderlog's later feature cards are illustrations, so take its first shot. A consent banner sits over some Oura and Brilliant shots, which a caption ignores.

## The DESIGN.md collection

The community files come from VoltAgent's awesome-design-md, MIT licensed, pinned to `VoltAgent/awesome-design-md@fcc70284932276d085f01ef9f83edde90b1258cb`. Bump the pin by hand, since a moving head changes the vocabulary between two runs of one site.

```plaintext
https://raw.githubusercontent.com/VoltAgent/awesome-design-md/fcc70284932276d085f01ef9f83edde90b1258cb/design-md/<folder>/DESIGN.md
```

- Take `<folder>` from the table for a listed site
- For any other site, try the host's name without its top-level domain, such as `figma` for `figma.com`, then the whole host without `www.`, such as `linear.app`
- Read a fetch that does not return 200 as the file being absent for that site
