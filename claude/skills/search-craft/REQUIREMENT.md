---
name: search-craft
description: Why a session needs a thinking step before an outside search, deriving where a field's authorities live rather than taking the top-ranked result, and why that step is a method rather than a catalog of sites
---

# Search craft requirement

## Gap

Without this skill, a session reaching outside the project runs one generic `WebSearch` and takes what ranks highest. Nothing in the toolkit says how to search, and the two procedures that require an outside source, `plan-groundwork` and `draft-doc`'s wiki kind, give no route to one.

The miss is measured. On 2026-10-02 two queries ran twice each with identical text, once open and once with `allowed_domains` set to authorities the session derived itself with no list to consult.

- `css container queries browser support`: 1 of 9 open results came from MDN, and that one was a blog post rather than the reference page. The rest were third-party pages, three of them thin guides. Scoped to MDN, web.dev, and caniuse, 10 of 10 results were primary sources.
- The two summaries disagreed on a fact. The open one said Firefox shipped style queries in version 128, and the scoped one, reading caniuse, said 151. A direct fetch of the caniuse table returned 151, so a session that searched once would have reported the wrong version.
- `effect of minimum wage increase on employment evidence`: the open set mixed journals with advocacy groups and its summary leaned one way. Scoped to five authorities the session named, being a research bureau's working papers, the economists' professional association, a working-paper index, a policy institute, and a legislature's budget office, 7 of 9 results were working papers or official analysis, and the summary carried both the near-zero and the negative estimates.
- 2 of the 9 scoped economics results came from a domain outside the allow list, so the filter is not strict.

The authorities in both pairs were named by the session unprompted once it was asked to, which is the argument for a method over a list. Two queries at one run each show the effect exists and do not size it.

Access is a second gap a session cannot derive. Probed on 2026-10-02, Reddit refused its JSON search with a 403 and refused `WebFetch`, while its RSS feed answered 200. X redirected `curl` to a login page and returned 402 to `WebFetch`, so no free route reaches it. Re-probed on 2026-10-04, Reddit's RSS feed, its search feed, and its JSON listing and search all answered 403, so the feed that answered two days earlier no longer does.

## Must

- Name the field, or two, before a query is written
- Derive the field's authorities from the kind of body it trusts, and search for who they are first when unsure
- Run the query scoped to those authorities and open beside it, prefer the scoped result on a conflict, and say in the output that the two disagreed
- Use the open result for practitioner write-ups and news the authorities do not publish
- Warn that the domain filter is not strict, so a scoped result has its domain checked before it is cited
- Prefer a public API over a fetched and summarized page where one exists, since the API returns the dates, authors, and identifiers a citation needs
- Carry a dated access note grown only from a failure a session hit, and stop to ask the operator before any paid or logged-in route
- Close with the practice skill's excuses, red flags, and closing checklist, answering "the model already knows the good sites" and "one search was enough"
- Be loaded from the sourcing steps of `plan-groundwork` and `draft-doc`'s wiki kind, each reporting when the skill does not resolve

## Must not

- Name a site as the destination for a category of question. An example authority appears only inside the method as an illustration of deriving one, marked as such. A line reading "for economics, use X" is the catalog the operator ruled out and a reviewer reads against this line.
- Ship code. Access code a session needs repeatedly becomes a `canon` verb, never a script in the skill.
- Restate citation format, which belongs to the surface writing the citation
- Suggest scraping behind a login or a paywall

## Out of scope

- The form a citation takes: the procedure or standard writing it
- A Claude Code subject: the `claude-code-guide` agent, which `draft-doc`'s wiki sourcing step already routes to
- Image generation, which makes a picture rather than finding a source
- Loading on every web search rather than on a research-shaped request: a hook matching `WebSearch`, planned on its own
- Whether a session already scopes searches without the skill, which only a run on a fresh research request without it would show

## Measured

2026-10-03, one Sonnet run of the toolkit's own sandbox scenario for this skill, a housing brief asking for linked notes and a prompt for the strongest evidence on whether rent control reduces housing supply. The skill sat in the project's skill folder and the run was allowed the skill, search, and fetch tools.

- No `Skill` call fired, so the description did not route a plain research request to the body.
- The run searched four times with no domain filter, naming authors and journals from recall, then fetched the papers' own pages. It never named the field, so the scenario's field pattern failed and the arm went red on one of its assertions.

The arm shows the trigger is the gap rather than the body: a session that never loads the skill cannot follow it. The pointers from `plan-groundwork` and `draft-doc`'s wiki kind reach only those procedures, and the hook matching `WebSearch` is the route for every other search. One run on one model shows the miss exists and does not size it.
