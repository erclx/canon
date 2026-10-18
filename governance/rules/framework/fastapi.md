---
description: Enforce FastAPI routers, sync and async handlers, dependency injection, lifespan, and error mapping
paths:
  - '**/*.py'
---

# FastAPI standards

## Routers

- Declare path operations on one `APIRouter` per feature and add each with `app.include_router()`, not on `FastAPI()` directly.
- Put a dependency every route in a group needs, such as auth, in the router's `dependencies=[...]`.

## Path operations

- Declare a path operation `async def` only when every I/O call in it is awaited. Use plain `def` for a blocking library, which FastAPI runs in a threadpool.
- Declare the return type or `response_model` as a model that omits secrets, since FastAPI filters the output to it.
- Take a request body as a Pydantic model parameter, never by parsing `await request.json()` by hand.

## Dependencies

- Declare a dependency as `Annotated[T, Depends(fn)]`, and share a repeated one as a type alias.
- Open a database session in a `yield` dependency and close it after the `yield`, so each request gets its own.
- Replace a dependency in tests through `app.dependency_overrides`, never by patching the module.

## Lifespan and settings

- Run startup and shutdown in a `lifespan` context manager, never `@app.on_event`, which stops running once `lifespan` is set.
- Load settings through `pydantic_settings.BaseSettings` behind an `@lru_cache` dependency, so `.env` is read once and tests can override it.

## Errors

- Raise `HTTPException` with an explicit status code for a client error.
- Map a domain exception to a response in one `@app.exception_handler`, over a try and except in each route.
- Return a safe summary from a handler, never the exception's message or traceback.

## Middleware

- Configure CORS through `CORSMiddleware`, listing origins explicitly when `allow_credentials=True`, since a wildcard is refused then.
