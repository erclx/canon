---
title: Python testing rule ledger
description: Sources for governance/rules/lib/testing-py.md, one row per bullet
---

# Python testing rule ledger

The field is Python testing, and the authorities are the pytest documentation at docs.pytest.org and the pytest-asyncio documentation. The pytest pages name no major beyond a feature added in 9.0, and the pytest-asyncio page names none, so the rows record the read date alone.

## Framework

| Bullet                         | Source                                                                                                                                                                                   | Read       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Plain functions, no `TestCase` | [unittest.TestCase support](https://docs.pytest.org/en/stable/how-to/unittest.html): in a `TestCase` subclass, regular fixtures and parametrization do not work, "and likely never will" | 2026-10-18 |

## Fixtures

| Bullet                               | Source                                                                                                                                                                                                                                                                                                      | Read       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Yield fixtures for teardown          | [Fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html): "yield fixtures are considered to be the cleaner and more straightforward option"                                                                                                                                                       | 2026-10-18 |
| Narrowest `conftest.py`              | [Fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html): in a `conftest.py`, "tests from multiple test modules in the directory can access the fixture function"                                                                                                                                 | 2026-10-18 |
| Widen scope only for unmutated state | [Fixtures](https://docs.pytest.org/en/stable/how-to/fixtures.html): "`function`: the default scope, the fixture is destroyed at the end of the test", so a wider scope hands one object to every test in it                                                                                                 | 2026-10-18 |
| `tmp_path` and `monkeypatch`         | [tmp_path](https://docs.pytest.org/en/stable/how-to/tmp_path.html) is "a temporary directory unique to each test function", and with [monkeypatch](https://docs.pytest.org/en/stable/how-to/monkeypatch.html) "All modifications will be undone after the requesting test function or fixture has finished" | 2026-10-18 |

## Parametrize

| Bullet                   | Source                                                                                                                                          | Read       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `parametrize` for tables | [Parametrizing tests](https://docs.pytest.org/en/stable/how-to/parametrize.html): it "enables parametrization of arguments for a test function" | 2026-10-18 |

## Async

| Bullet                      | Source                                                                                                                                                                                                         | Read       |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Mark async tests or go auto | [pytest-asyncio concepts](https://pytest-asyncio.readthedocs.io/en/latest/concepts.html): "In strict mode pytest-asyncio will only run tests that have the _asyncio_ marker", and strict "is the default mode" | 2026-10-18 |
| The plugin's event loop     | [pytest-asyncio concepts](https://pytest-asyncio.readthedocs.io/en/latest/concepts.html): "Pytest-asyncio provides one asyncio event loop for each pytest collector"                                           | 2026-10-18 |

## Assertions and mocks

| Bullet                  | Source                                                                                                                                                                                            | Read       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Plain `assert`          | [Assertions](https://docs.pytest.org/en/stable/how-to/assert.html): failure details come from "rewriting assert statements before they are run"                                                   | 2026-10-18 |
| `pytest.raises`         | [Assertions](https://docs.pytest.org/en/stable/how-to/assert.html): you "can use pytest.raises() as a context manager" for an expected exception                                                  | 2026-10-18 |
| Patch through a fixture | [monkeypatch](https://docs.pytest.org/en/stable/how-to/monkeypatch.html): it "helps you to safely set/delete an attribute", undone after the test, where a hand assignment leaks into later tests | 2026-10-18 |
| No real network calls   | House choice: a test reaching the network fails on an outage or a rate limit with no defect in the code under test                                                                                | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### A default pytest already applies

- Cut "name files `test_*.py` and test functions `test_*`". [Good practices](https://docs.pytest.org/en/stable/explanation/goodpractices.html) states it as pytest's default discovery, and Claude names tests that way unprompted.
- Narrowed "set `scope=` explicitly when reuse matters" to the one case a wider scope breaks, since `function` is already the default.

### Cut without a source or a bug class

- Cut "place tests under `tests/`, mirroring the `src/` package layout" as a layout call, which the `codebase-layout` skill owns. Good practices says only that a separate directory "might be useful".
- Cut "use `ids=` to label parametrized cases when their repr is unclear" as readability naming no failure.
- Cut "arrange, act, assert per test, with one logical assertion group" as test structure, which the `test-craft` skill owns.
- Cut "use descriptive `test_*` names that read as the assertion, never `should_`" as naming style naming no failure.

### Merged or reworded

- Merged "use `pytest` for all tests, never `unittest.TestCase`" with the reason the unittest page gives.
- Reworded "do not start a fresh event loop inside tests" to name the loop the plugin provides and the calls that bypass it.
- Replaced `httpx_mock`, a fixture name, with `pytest-httpx`, the package that provides it.
