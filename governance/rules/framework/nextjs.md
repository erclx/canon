---
description: Enforce Next.js App Router boundaries, caching, Server Action security, and built-in primitives
paths:
  - '**/*.tsx'
  - '**/*.ts'
---

# Next.js standards

## Routing

- Add routes under `app/` with the App Router, never under `pages/`.
- Await `params` and `searchParams`, which are Promises in a page, a layout, and a route handler.

## Server and client components

- Default to Server Components. Add `'use client'` only to a file needing state, event handlers, effects, or browser APIs.
- Put `'use client'` on the interactive leaf, not a layout, since every module it imports joins the client bundle.
- Pass a Client Component only serializable props holding the fields it renders, never a whole database record.
- Add `import 'server-only'` to a module that reads secrets or the database.

## Data and caching

- Cache with `'use cache'` and a `cacheLife` call where Cache Components is on, the default for new apps. A `fetch` is not cached by default.
- Wrap a component reading `cookies()`, `headers()`, or uncached data in `<Suspense>` with a fallback.
- Call `revalidatePath` or `revalidateTag` in the Server Action after a mutation.

## Mutations

- Verify authentication and resource ownership inside every Server Action, since each is reachable by a direct POST.
- Validate every Server Action argument before use, and return only the fields the UI needs.

## Built-in primitives

- Use `next/link` for internal navigation and `next/image` for raster images.
- Give `next/image` a `width` and `height` for a remote source, or `fill` inside a positioned parent.

## Environment

- Prefix a variable with `NEXT_PUBLIC_` only when the browser needs it, since its value is inlined at build time.
