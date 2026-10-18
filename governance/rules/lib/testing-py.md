---
description: Enforce pytest fixtures, parametrize, and async patterns for Python tests
paths:
  - '**/tests/**/*.py'
  - '**/test_*.py'
  - '**/*_test.py'
---

# Python testing tooling

## Framework

- Write tests as plain `pytest` functions, never `unittest.TestCase` subclasses, which lose fixtures and parametrization.

## Fixtures

- Write setup and teardown as a `@pytest.fixture` that yields, over setup and teardown methods.
- Place a shared fixture in the `conftest.py` of the narrowest directory whose tests need it.
- Widen a fixture's `scope=` past the `function` default only for state no test mutates.
- Use `tmp_path` and `monkeypatch` over hand-rolled temp directories or environment stashes, since both undo themselves.

## Parametrize

- Use `@pytest.mark.parametrize` for table-driven cases over per-case test functions.

## Async

- Mark each async test `@pytest.mark.asyncio`, or set `asyncio_mode = "auto"`, since strict mode runs only marked tests.
- Run on the event loop `pytest-asyncio` provides. Never call `asyncio.run()` or create a loop inside a test.

## Assertions and mocks

- Use plain `assert`, which pytest rewrites to report the values, over `self.assertEqual`.
- Use `pytest.raises(...)` over `try` and `except` for an expected exception.
- Patch with `monkeypatch.setattr` or `unittest.mock.patch`, never by assigning a module attribute by hand.
- Do not make real network calls. Use `responses`, `pytest-httpx`, or a fake.
