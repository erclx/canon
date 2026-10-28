---
title: Search craft skill ledger
description: Sources for claude/skills/search-craft/SKILL.md, one row per bullet in its concern groups
---

# Search craft skill ledger

The field is information literacy and research methods. ACRL's framework carries how a searcher picks producers and judges authority, and Wineburg and McGrew's study of fact checkers carries reading past the ranking. Caulfield's SIFT carries tracing a claim to its origin, while Anthropic's tool docs carry the domain filter.

The closing sections and `## What this delegates` restate these rules or route, so they take no table.

The access note records refusals, so its rows are measurements re-run on the date in `Read` rather than citations.

## Name the field

| Bullet                        | Source                                                                                                                                                                                                                               | Read       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Name the field before a query | [ACRL Framework, Searching as Strategic Exploration](https://www.ala.org/acrl/standards/ilframework): learners "match information needs to appropriate search tools and information producers"                                       | 2026-10-28 |
| At a practitioner's level     | [ACRL Framework, Searching as Strategic Exploration](https://www.ala.org/acrl/standards/ilframework): learners "distinguish between different types of searching language (e.g., controlled vocabulary, keywords, natural language)" | 2026-10-28 |
| Say the field in the output   | House choice: an answer from a search run in the wrong field reads the same as a wrong fact unless the output names where it looked. It beat reporting the sources alone                                                             | 2026-10-28 |

## Derive who the field trusts

| Bullet                                  | Source                                                                                                                                                                                                                                                                                | Read       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Ask what kind of body settles it        | [ACRL Framework, Authority Is Constructed and Contextual](https://www.ala.org/acrl/standards/ilframework): "authority is a type of influence recognized or exerted within a community", and learners "identify different types of authority"                                          | 2026-10-28 |
| Derive the names, never a list          | House choice: a remembered list of sites per category rots with nobody noticing, and reading one skips the test of what kind of body the field trusts. It beat a per-category directory, declined in `references/adopted.md`                                                          | 2026-10-28 |
| Search for the authorities first        | [Wineburg and McGrew, Lateral Reading and the Nature of Expertise](https://stacks.stanford.edu/file/druid:yk133ht8603/Wineburg%20McGrew_Lateral%20Reading%20and%20the%20Nature%20of%20Expertise.pdf): "before diving deeply into unfamiliar content, chart a plan for moving forward" | 2026-10-28 |
| Each new question derives its own names | [ACRL Framework, Authority Is Constructed and Contextual](https://www.ala.org/acrl/standards/ilframework): "the information need of the individual or community may help to determine the form of authority required"                                                                 | 2026-10-28 |

## Search twice

| Bullet                                  | Source                                                                                                                                                                                                                                                                                                                                                      | Read       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The same query scoped and open          | [Wineburg and McGrew, Lateral Reading and the Nature of Expertise](https://stacks.stanford.edu/file/druid:yk133ht8603/Wineburg%20McGrew_Lateral%20Reading%20and%20the%20Nature%20of%20Expertise.pdf): fact checkers "knew that the first result was not necessarily the most authoritative", since optimizers push "more authoritative sites to the bottom" | 2026-10-28 |
| Prefer the scoped side, and say so      | House choice: a silent pick hides which source a fact rests on, so a reader cannot re-check the disagreement. It beat keeping whichever result ranked higher                                                                                                                                                                                                | 2026-10-28 |
| The open result for what is unpublished | [Wineburg and McGrew, Lateral Reading and the Nature of Expertise](https://stacks.stanford.edu/file/druid:yk133ht8603/Wineburg%20McGrew_Lateral%20Reading%20and%20the%20Nature%20of%20Expertise.pdf): reading laterally means "drawing on the resources of the Internet to learn more about a site and its claims"                                          | 2026-10-28 |
| Check every scoped result's domain      | [Anthropic, Server tools, Domain filtering](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools): "Subdomains are automatically included (`example.com` covers `docs.example.com`)", and Unicode names "can bypass domain filters through homograph attacks"                                                                         | 2026-10-28 |
| Fetch the page where summaries differ   | [Caulfield, SIFT (The Four Moves)](https://hapgood.us/2019/06/19/sift-the-four-moves/): "we'll have you trace the claim, quote, or media back to the source"                                                                                                                                                                                                | 2026-10-28 |

## Prefer a structured source

| Bullet                                | Source                                                                                                                                                                                                           | Read       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A public API over a summarized page   | [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/): "Our publicly available REST API exposes the scholarly metadata that members and trusted sources deposit with Crossref" | 2026-10-28 |
| A plain request rather than a wrapper | [claude-research-stack](https://github.com/aghori3004/claude-research-stack): "The skill talks to the CLIs and MCPs directly, on purpose", listing "No wrapper scripts" among what it leaves out                 | 2026-10-28 |

## Access note

| Bullet                          | Source                                                                                                                                                                                                       | Read       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Reddit refuses keyless routes   | House choice, measured: `curl` on `/r/programming/.rss` and on `/search.json` both returned 403, and `WebFetch` answered that it is "unable to fetch from www.reddit.com"                                    | 2026-10-28 |
| X answers nothing without login | House choice, measured: `curl` on `/search` returned 307 to `/i/jf/onboarding/web` with `mode=login`, and `WebFetch` returned "HTTP 402 Payment Required"                                                    | 2026-10-28 |
| Ask before a route that pays    | [x-research-skill](https://github.com/rohunvora/x-research-skill): "Each search page returns up to 100 posts = ~$0.50/page", a spend that is the operator's to authorize rather than one a session discovers | 2026-10-28 |
