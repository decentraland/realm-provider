// Native fetch (undici) keeps the underlying socket pinned until the response
// body is either fully read or explicitly cancelled. When a response is
// discarded without reading its body (early returns, thrown errors,
// fire-and-forget requests) we must cancel the body to release the socket and
// avoid exhausting the connection pool.
export async function drainResponse(response: {
  bodyUsed: boolean
  body?: { cancel(): Promise<void> } | null
}): Promise<void> {
  if (!response.bodyUsed) {
    await response.body?.cancel().catch(() => undefined)
  }
}
