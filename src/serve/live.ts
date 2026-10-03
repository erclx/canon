import { type FSWatcher, watch } from 'node:fs'
import { SERVE_HOST } from '@/serve/static'

/**
 * How long a burst of watch events for one path waits before it is sent. One
 * editor save raises several, and each would otherwise reach a reader again.
 */
const SETTLE_MS = 40

export interface LiveOptions<T> {
  /**
   * Turns a changed path, relative to the watched directory, into what a change
   * carries, or into undefined to drop it, such as a write's staging file.
   */
  readonly map: (path: string) => T | undefined
  /**
   * Takes each settled change in place of the clients. A caller that has work
   * to do before a reader may look, such as regenerating pages, sends its own
   * payload through `send` once that work lands.
   */
  readonly onChange?: (payload: T) => void
}

/**
 * Whether a request names this server by a loopback name and its own port.
 * The bind keeps other machines out, and this keeps out a page the operator
 * visits whose domain was rebound to 127.0.0.1, which reaches the socket with
 * its own name in the Host header.
 */
export function isLoopbackHost(host: string | null, port: number): boolean {
  return host === `${SERVE_HOST}:${port}` || host === `localhost:${port}`
}

/**
 * Watches a directory and fans each settled change out as a server-sent event
 * to every open client, or to `onChange` when the caller takes changes itself.
 */
export class LiveStream<T> {
  private readonly clients = new Set<ReadableStreamDefaultController<string>>()
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly watcher: FSWatcher

  constructor(
    dir: string,
    private readonly options: LiveOptions<T>,
  ) {
    this.watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (filename) this.queue(filename.toString())
    })
  }

  private queue(path: string): void {
    const payload = this.options.map(path)
    if (payload === undefined) return
    clearTimeout(this.pending.get(path))
    this.pending.set(
      path,
      setTimeout(() => {
        this.pending.delete(path)
        if (this.options.onChange) this.options.onChange(payload)
        else this.send(payload)
      }, SETTLE_MS),
    )
  }

  send(payload: unknown): void {
    const frame = `data: ${JSON.stringify(payload)}\n\n`
    for (const client of this.clients) client.enqueue(frame)
  }

  open(): Response {
    let self: ReadableStreamDefaultController<string> | undefined
    const stream = new ReadableStream<string>({
      start: (controller) => {
        self = controller
        this.clients.add(controller)
        controller.enqueue(': open\n\n')
      },
      cancel: () => {
        if (self) this.clients.delete(self)
      },
    })
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
      },
    })
  }

  /** Opens a stream for a request naming this server, and refuses any other. */
  answer(request: Request, port: number): Response {
    if (isLoopbackHost(request.headers.get('host'), port)) return this.open()
    return new Response('Forbidden\n', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  close(): void {
    this.watcher.close()
    for (const timer of this.pending.values()) clearTimeout(timer)
    this.pending.clear()
    for (const client of this.clients) {
      try {
        client.close()
      } catch {
        /* Already closed by the browser going away. */
      }
    }
    this.clients.clear()
  }
}
