---
description: Enforce Next.js App Router structure, server/client boundaries, and built-in primitives
paths:
  - '**/*.tsx'
  - '**/*.ts'
---

# Next.js standards

## App Router structure

- Use the App Router under `app/`. Do not introduce `pages/` in new code.
- Use route segment files for their documented purpose: `page.tsx` for routes, `layout.tsx` for shared shells, `loading.tsx` for Suspense fallbacks, `error.tsx` for error boundaries, `route.ts` for HTTP handlers.

## Server and client components

- Default to Server Components. Add `"use client"` only when the file needs state, effects, browser APIs, or event handlers.
- Place `"use client"` at the leaf, not at the layout. Push the boundary as deep as possible.
- Do not import server-only modules (`fs`, db clients, secrets) from a client component. Mark server-only modules with `import "server-only"`.
- Pass serializable props across the server/client boundary. Do not pass functions or class instances.

## Data fetching

- Fetch data in Server Components or Route Handlers. Do not fetch in client components when a server alternative exists.
- Set explicit caching on `fetch`: `cache: "force-cache"`, `cache: "no-store"`, or `next: { revalidate: <seconds> }`. Do not rely on defaults.
- Use `revalidatePath` or `revalidateTag` for invalidation over manual refetch loops.

## Server Actions

- Mark Server Actions with `"use server"` at the top of the file or function.
- Validate Server Action inputs with a Zod schema before use. The client/server boundary is implicit and easy to miss.
- Return serializable values. Do not return Response or stream objects from a Server Action.

## Route handlers

- Place HTTP endpoints in `app/**/route.ts`. Do not add `pages/api/`.
- Export named methods (`GET`, `POST`, ...). Return `NextResponse` over raw `Response` for typed helpers.
- Read params from the function signature (`{ params }`), not from the request URL.

## Built-in primitives

- Use `next/link` over `<a>` for internal navigation. Use `next/image` over `<img>` for raster images. Use `next/font` over manual `<link>` tags for fonts.
- Set explicit `width` and `height` (or `fill`) on `next/image`. Do not omit dimensions.

## Metadata and environment

- Export `metadata` or `generateMetadata` from `layout.tsx` or `page.tsx` over manual `<head>` injection.
- Prefix browser-exposed env vars with `NEXT_PUBLIC_`. Never read unprefixed server-only env vars from a client component.
