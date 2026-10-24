---
description: Enforce pytest fixtures, parametrize, and async patterns for Python tests
paths:
  - 'tests/**/*.py'
  - '**/test_*.py'
  - '**/*_test.py'
---

# Python testing tooling

## Framework

- Use `pytest` for all tests. Do not use `unittest.TestCase`.
- Place tests under `tests/`, mirroring the `src/` package layout.
- Name files `test_*.py` and test functions `test_*`.

## Fixtures

- Use `@pytest.fixture` over setup and teardown methods.
- Place shared fixtures in `conftest.py` at the narrowest scope that needs them.
- Set `scope=` (`"session"`, `"module"`, `"function"`) explicitly when reuse matters.
- Use `tmp_path` and `monkeypatch` over hand-rolled temp directories or env stashes.

## Parametrize

- Use `@pytest.mark.parametrize` for table-driven cases over per-case test functions.
- Use `ids=` to label parametrized cases when their repr is unclear.

## Async

- Mark async tests with `@pytest.mark.asyncio` or configure `asyncio_mode = "auto"`.
- Do not start a fresh event loop inside tests.

## Assertions and mocks

- Use plain `assert` over `self.assertEqual`. Pytest rewrites assertions for readable diffs.
- Use `pytest.raises(...)` over `try/except` for expected exceptions.
- Use `monkeypatch.setattr` or `unittest.mock.patch` over ad hoc module rewrites.
- Do not make real network calls. Use `responses`, `httpx_mock`, or fakes.

## Conventions

- Arrange, act, assert per test, with one logical assertion group.
- Use descriptive `test_*` names that read as the assertion. Do not prefix with `should_`.
