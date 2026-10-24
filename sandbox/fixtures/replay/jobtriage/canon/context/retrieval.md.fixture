---
title: Retrieval
description: Chunking, embedding prefix contract, and the RRF score floor
---

# Retrieval

Reference for the hybrid retrieval stack in the repo and CLI path. The deployed demo bypasses this path after v4.10 and goes straight to live JobTech, so the surfaces below apply to local development and to anyone running `uv run jobtriage` against their own corpus.

The reproducibility tables behind these numbers (hybrid retrieval ablation, agent eval, multilingual embedding comparison) live in `docs/evaluation.md`, linked from the README. This entry keeps the chunking rule, the embedding prefix contract, and the RRF floor rationale behind those numbers.

## Chunking

Ad descriptions split into `~800` character chunks via a paragraph-first, length-second strategy in `python/src/jobtriage/storage/chunking.py`. The chunker groups paragraphs as long as the running total stays under `max_chars`. When a paragraph would overflow, it closes the current chunk and starts a new one. Paragraphs that exceed `max_chars` on their own slice at hard character boundaries.

The same chunks back both the BM25 keyword index (`ad_chunks_fts`) and the dense embedding column (`ad_chunks.embedding`). One chunk equals one retrieval candidate, which keeps reciprocal rank fusion math simple.

## Embedding prefix contract

The canonical encoder is `intfloat/multilingual-e5-base`. The e5 family requires a `passage: ` prefix on indexed text and a `query: ` prefix on the query string. The wrapper at `python/src/jobtriage/embeddings.py` enforces this for `embed_passages` and `embed_query`, so callers cannot accidentally mix prefixes.

The ablation runner applies the same prefixes to every model under test, including `sentence-transformers/all-MiniLM-L6-v2`. MiniLM was not trained on the e5 prefix tokens, so they read as noise and suppress its dense numbers slightly. That cost is accepted as the price of a uniform input contract. The repo's hybrid recovers most of the gap via BM25 fusion, and the table-row note on the README captures the framing.

## RRF score floor

Reciprocal rank fusion has no zero-result floor by default. Adversarial queries (`"quantum welding theologian"`) still return tangentially-relevant ads at very low RRF scores. The v4.2 audit caught this on the seed corpus where ten Volvo ads surfaced at scores around `0.03`.

The score floor at the API boundary suppresses noise without changing the underlying ranking math. The setting is `JOBTRIAGE_RRF_FLOOR`, defaulting to `0.025`. The threshold applies at `/v1/jobs/triage` and `/v1/jobs/semantic` only. `/v1/jobs/search` is left untouched since it filters recent ads regardless of relevance score.

RRF scores are corpus-size dependent. The default fits the 59-ad seed corpus and should be re-tuned for a larger corpus. The `Settings` model at `python/src/jobtriage/settings.py` exposes the knob through pydantic-settings so a deployment can override via environment without a code edit.
