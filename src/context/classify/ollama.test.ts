import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chat, parseVerdictText, probeOllama } from '@/context/classify/ollama'

let server: ReturnType<typeof Bun.serve> | undefined

afterEach(() => {
  server?.stop(true)
  server = undefined
})

function serveOnce(handler: (req: Request) => Response | Promise<Response>) {
  server = Bun.serve({ port: 0, fetch: handler })
  return `http://127.0.0.1:${server.port}`
}

describe('parseVerdictText', () => {
  it('should parse a diff-mode single-quote reply', () => {
    const parsed = parseVerdictText(
      '{"verdict": "history", "quote": "closed on", "reason": "narrates the change"}',
    )

    expect(parsed).toEqual({
      verdict: 'HISTORY',
      quote: 'closed on',
      reason: 'narrates the change',
    })
  })

  it('should join a sweep-mode quotes array with the diff-mode separator', () => {
    const parsed = parseVerdictText(
      '{"verdict": "rewrite", "quotes": ["a", "b"], "reason": "carries its own history"}',
    )

    expect(parsed?.quote).toBe('a | b')
  })

  it('should extract JSON wrapped in surrounding prose', () => {
    const parsed = parseVerdictText(
      'Sure, here is the verdict:\n{"verdict": "keep", "quote": "", "reason": "current"}\nDone.',
    )

    expect(parsed?.verdict).toBe('KEEP')
  })

  it('should report undefined for text with no JSON object', () => {
    expect(parseVerdictText('the model refused to answer')).toBeUndefined()
  })

  it('should report undefined for malformed JSON', () => {
    expect(parseVerdictText('{"verdict": "keep",,}')).toBeUndefined()
  })

  it('should report undefined for JSON missing a verdict field', () => {
    expect(parseVerdictText('{"quote": "x", "reason": "y"}')).toBeUndefined()
  })
})

describe('probeOllama', () => {
  it('should report reachable when the tags endpoint answers ok', async () => {
    const baseUrl = serveOnce(() => new Response('{}', { status: 200 }))

    expect(await probeOllama(baseUrl)).toBe(true)
  })

  it('should report unreachable when the endpoint answers an error status', async () => {
    const baseUrl = serveOnce(() => new Response('nope', { status: 500 }))

    expect(await probeOllama(baseUrl)).toBe(false)
  })

  it('should report unreachable when nothing is listening', async () => {
    expect(await probeOllama('http://127.0.0.1:1')).toBe(false)
  })
})

describe('chat', () => {
  it('should send the measured request shape', async () => {
    let received: Record<string, unknown> | undefined
    const baseUrl = serveOnce(async (req) => {
      received = (await req.json()) as Record<string, unknown>
      return Response.json({
        message: { content: '{"verdict":"keep","quote":"","reason":"x"}' },
      })
    })

    await chat({ baseUrl, model: 'qwen3.8:27b', system: 'sys', user: 'usr' })

    expect(received?.model).toBe('qwen3.8:27b')
    expect(received?.stream).toBe(false)
    expect(received?.think).toBe(false)
    expect(received?.format).toBe('json')
    expect(received?.options).toEqual({ temperature: 0, num_ctx: 16384 })
    expect(received?.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ])
  })

  it('should parse a well-formed reply', async () => {
    const baseUrl = serveOnce(() =>
      Response.json({
        message: {
          content:
            '{"verdict":"move","quote":"`x.ts`","reason":"wrong surface"}',
        },
      }),
    )

    const result = await chat({ baseUrl, model: 'm', system: 's', user: 'u' })

    expect(result).toEqual({
      kind: 'ok',
      raw: '{"verdict":"move","quote":"`x.ts`","reason":"wrong surface"}',
      parsed: { verdict: 'MOVE', quote: '`x.ts`', reason: 'wrong surface' },
    })
  })

  it('should report unparsed when the reply carries no usable JSON', async () => {
    const baseUrl = serveOnce(() =>
      Response.json({ message: { content: 'I refuse to answer in JSON.' } }),
    )

    const result = await chat({ baseUrl, model: 'm', system: 's', user: 'u' })

    expect(result.kind).toBe('unparsed')
  })

  it('should report unparsed when the response carries no message content', async () => {
    const baseUrl = serveOnce(() => Response.json({}))

    const result = await chat({ baseUrl, model: 'm', system: 's', user: 'u' })

    expect(result.kind).toBe('unparsed')
  })

  it('should report unreachable on a non-ok response status', async () => {
    const baseUrl = serveOnce(
      () => new Response('server error', { status: 500 }),
    )

    const result = await chat({ baseUrl, model: 'm', system: 's', user: 'u' })

    expect(result).toEqual({
      kind: 'unreachable',
      message: 'ollama returned 500',
    })
  })

  it('should report unreachable when nothing is listening', async () => {
    const result = await chat({
      baseUrl: 'http://127.0.0.1:1',
      model: 'm',
      system: 's',
      user: 'u',
    })

    expect(result.kind).toBe('unreachable')
  })

  it('should report timeout when the backend never responds inside the budget', async () => {
    const baseUrl = serveOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      return Response.json({ message: { content: '{"verdict":"keep"}' } })
    })

    const result = await chat({
      baseUrl,
      model: 'm',
      system: 's',
      user: 'u',
      timeoutMs: 20,
    })

    expect(result).toEqual({ kind: 'timeout' })
  })
})
