---
name: search-craft
description: Carries the thinking step a session takes before it searches outside the project, naming the field, deriving who that field treats as authoritative, and running a search scoped to those sources beside an open one, plus a dated note on which sites refuse access. Use before any outside search for evidence, papers, documentation, statistics, or opinion, when a procedure loads it at its sourcing step, or when asked "find me the strongest evidence on X", "where should I look for this", "what does the research say", "find papers on", "look up the docs for", or "what are people saying about". Do NOT use to format a citation, which belongs to the surface writing it, to source a Claude Code subject, which is the `claude-code-guide` agent, or to generate an image, which is not search.
---

# Search craft

A session reaching outside the project tends to run one generic search and take whatever ranks highest. Ranking rewards pages written to rank, so a field's thin "complete guide" pages and its advocates crowd out its reference material, and one search gives nothing to check them against. In the measured case that single search reported a browser version the field's own compatibility tables contradicted. This skill carries the step before the search: work out where the field's authoritative material lives, search there, and search openly beside it.

The procedure that loaded this skill owns what the result is for and where it is written. Nothing here formats a citation or decides what a finding means.

## Name the field

- Name the field the question sits in before writing a query. Name two when the question straddles them, such as a pricing question that is both law and economics.
- Name it at the level a practitioner would, being the discipline that argues about the answer, rather than the topic word in the question.
- Say the field in the output, so a reader can tell a wrong answer from a search run in the wrong place.

## Derive who the field trusts

- Ask what kind of body the field treats as settling a question, then name the bodies of that kind. The kinds recur across fields:
  - the standards body or specification that defines the thing
  - the reference documentation its practitioners cite
  - the peer-reviewed papers and working papers of its professional society
  - the official statistics office or regulator that publishes the numbers
  - the project's own repository, changelog, or issue tracker, for a piece of software
- Derive the names. Never reach for a remembered list of sites per category, since a list rots with nobody noticing and the field's own kind of authority is what the derivation tests.
- Search for the authorities first when unsure who they are, such as asking where the field's practitioners publish or what its practitioners cite, and scope the real search only after that answer is read.
- As an illustration of deriving, not a list to reuse: a question on a browser feature's support sits in web platform engineering, whose authorities are the specification, the reference docs practitioners cite, and the compatibility tables built from browser releases. Each new question derives its own.

## Search twice

- Run the same query twice: once scoped to the derived authorities through `WebSearch`'s `allowed_domains`, and once open.
- Prefer the scoped result when the two disagree on a fact, and say in the output that they disagreed and which one was kept. Never pick one silently.
- Use the open result for what the authorities do not publish: practitioner write-ups, field reports, and news.
- Check the domain of every scoped result before citing it. The filter is not strict, and a scoped run can return results from outside its list.
- Fetch the authority's page itself to confirm a fact both searches summarized differently, since a search summary is a paraphrase and can carry the error.

## Prefer a structured source

- Prefer a source's public API over a fetched and summarized HTML page where one exists. An API returns the dates, authors, and identifiers a citation needs, and a summary of the page can drop or blur them.
- Reach the API with a plain request when it needs no key, rather than writing a wrapper for one search.

## Access note

Each line is a claim measured once, and `${CLAUDE_SKILL_DIR}/REQUIREMENT.md` records the date under its Gap. Sites change their blocking without notice, so re-check a line before relying on it. Add a line only for a failure a session actually hit, and record the date it hit in the requirement beside it.

- Reddit answers its RSS feed and refuses its JSON search with a 403. `WebFetch` is refused for the site.
- X answers nothing without paying or a login. `curl` redirects to a login page and `WebFetch` returns 402.
- Stop and ask the operator before any route that pays, logs in, or works around a refusal. Never suggest scraping behind a login.

## Excuses and rebuttals

| Excuse                                   | Rebuttal                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| The model already knows the good sites   | It does, and it does not use that knowledge unprompted. A generic search ranked third-party guides over the field's reference pages.                 |
| One search was enough                    | In the measured case the open search's summary stated a version the field's compatibility tables contradicted, and only the scoped search caught it. |
| The open results look authoritative      | Ranking rewards pages written to rank. An open set mixed journals with advocacy groups and leaned one way where the scoped set showed both sides.    |
| I scoped it, so every result is in scope | The domain filter is not strict. A scoped run returned results from outside its own list.                                                            |
| The summary already answers it           | A summary paraphrases. Fetch the page when two summaries disagree, since that is where the error sits.                                               |

## Red flags

- You are about to write a query and have not named the field.
- Every source you are about to cite came from one open search.
- You named an authority because it is a site you remember, not because it is the kind of body the field trusts.
- The scoped and open results disagree and the output does not say so.
- You are citing a scoped result whose domain you have not checked.
- You are about to pay, log in, or scrape to reach a source and have not asked the operator.

## Before handing over

- The output names the field, or both fields, the question was searched in.
- Every authority searched was derived from the kind of body the field trusts.
- The query ran scoped and open, and every disagreement between them is stated with the side kept.
- Every cited source's domain was checked, and a fact the summaries disagreed on was confirmed on the page itself.
- No paid, logged-in, or scraped route was taken without the operator's answer.

## What this delegates

- The form a citation takes: the surface writing it, such as the standard the procedure writes to
- A Claude Code subject: the `claude-code-guide` agent, which `draft-wiki` routes to
- Generating an image: whatever draws the surface, since making one is not search
- Access code a session needs repeatedly: a `canon` verb, never a script in this skill
