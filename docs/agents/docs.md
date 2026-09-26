---
title: Docs
description: How canon docs resolves the toolkit's own reference surface from an install root, and how a split domain is named
---

# Docs

`canon docs` emits the toolkit's own reference docs so an agent in a target project can orient without the toolkit source checked out. The CLI resolves `docs/` and `canon/context/` from its install root, and which of the two it finds depends on how the CLI was installed. A registry install carries `docs/` alone, since `.claude/` is not published. A clone or a linked worktree carries both.

- `canon docs list [--json]` lists the downstream catalog: the consumer-facing `docs/` surface plus per-domain narrative from `canon/context/` when that root is present. Toolkit-internal context entries (`ci`, `development`, `sandbox`) are dropped. From a registry install the context section is absent rather than empty.
- `canon docs <topic>` prints one doc to stdout, resolved by exact name from `docs/` first, then `canon/context/`. Any doc the install carries is reachable by name, including the toolkit-internal topics the list omits.

## How a name resolves

A domain too large for one file splits into `<domain>/` with a generated `index.md`, and both verbs name it by the folder. `canon docs <domain>` prints that index, which is the catalog routing to the sub-area files, and the listing describes it from the index's `subtitle` where a sibling file supplies `description`. A folder carrying no `index.md` is absent from both, since a catalog is what makes the sub-areas reachable, and so are the files inside it.

A sub-area file resolves by its bare name too, so `canon docs operating-model` reaches `docs/workflow/operating-model.md`. Three spellings are tried in order, being a sibling file, a folder of that name, then a sub-area file one level down, and each spelling is tried across both roots before the next one runs. A sibling file therefore wins over a folder of the same name, and both win over a sub-area file. Reading the folder last is what keeps the sub-area spelling from changing any name that resolved before it existed.

The sub-area spelling keeps the root order too. The first root whose folders carry the name answers, so `canon docs indexes` reaches `docs/agents/indexes.md` even though a context folder holds an entry of the same name. A bare name carried by two folders of that one root resolves to neither, which names the available topics and exits 1 rather than answering with whichever folder sorts first.

`canon docs list` stops at the folder where `canon docs <topic>` goes on to name each file inside it. The listing is the downstream catalog rather than the index of what a name reaches, so a sub-area file appears there only where it declares a target-facing `category` of its own, and no sub-area file of the context root appears at all. A name that resolves and does not list is the divergence the toolkit-internal topics already carry.

## Output

Data prints to stdout and the frame to stderr, so `canon docs <topic> > out.md` captures clean markdown. With no topic and no verb, `canon docs` runs `list`. An unknown topic names the available topics on stderr and exits 1.

Only a `---` block opening on the first line counts as frontmatter, so a document body carrying horizontal rules emits whole.
