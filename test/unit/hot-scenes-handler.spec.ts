import { readFileSync } from 'fs'
import { join } from 'path'
import type { hotScenesHandler as HotScenesHandler } from '../../src/controllers/handlers/hot-scenes-handler'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

const GATEKEEPER_URL = 'https://comms-gatekeeper.decentraland.org'

const packHotScenes = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/iteration-2/http/today/hot-scenes.json'), 'utf-8')
)

// The handler keeps its proxy cache in module scope, so every test gets a fresh module instance.
function loadHandler(): typeof HotScenesHandler {
  jest.resetModules()
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../src/controllers/handlers/hot-scenes-handler').hotScenesHandler
}

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    COMMS_GATEKEEPER_URL: GATEKEEPER_URL,
    ...overrides
  }
  return {
    requireString: jest.fn((key: string) => Promise.resolve(values[key])),
    getString: jest.fn((key: string) => Promise.resolve(values[key]))
  }
}

type MockResponse = { ok?: boolean; status?: number; json?: () => Promise<any> }

function makeResponse(result: MockResponse) {
  const status = result.status ?? (result.ok === false ? 404 : 200)
  return {
    ok: result.ok ?? status < 300,
    status,
    bodyUsed: false,
    body: { cancel: () => Promise.resolve() },
    json: result.json ?? (() => Promise.resolve({}))
  }
}

function makeFetch(handler: (url: string, init?: any) => MockResponse | Promise<never>) {
  return {
    fetch: jest.fn((url: string, init?: any) => {
      const result = handler(url, init)
      if (result instanceof Promise) {
        return result
      }
      return Promise.resolve(makeResponse(result))
    })
  }
}

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
const logs = { getLogger: () => logger } as any

function makeMainRealm(healthy: boolean, realmName = 'main'): MainRealmProviderComponent {
  return {
    realmName,
    getStatus: jest.fn().mockResolvedValue({ healthy, realmName, userCount: 0, adapter: 'adapter' })
  }
}

function executeHandler(handler: typeof HotScenesHandler, mainRealmProvider: MainRealmProviderComponent, fetch: any, config: any) {
  return handler({
    components: { mainRealmProvider, fetch, config, logs },
    url: new URL('http://localhost/hot-scenes')
  } as any)
}

/** Flush every pending microtask, so concurrent handler calls reach their next await. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function gatekeeperArray() {
  return JSON.parse(JSON.stringify(packHotScenes.body))
}

describe('hot-scenes handler', () => {
  beforeEach(() => {
    logger.warn.mockClear()
  })

  it('passes every comms-gatekeeper field through and adds the main realm to each entry', async () => {
    const handler = loadHandler()
    const fetch = makeFetch(() => ({ json: () => Promise.resolve(gatekeeperArray()) }))

    const response = await executeHandler(handler, makeMainRealm(true), fetch, makeConfig())

    expect(fetch.fetch).toHaveBeenCalledWith(`${GATEKEEPER_URL}/hot-scenes`, expect.anything())
    expect(response.status).toBeUndefined()

    const scenes = response.body as any[]
    const expected = packHotScenes.body as any[]
    expect(scenes).toHaveLength(expected.length)

    scenes.forEach((scene, index) => {
      // every gatekeeper field byte-identical: nothing renamed, re-ordered, dropped or rewritten
      const { realms, ...gatekeeperFields } = scene
      expect(JSON.stringify(gatekeeperFields)).toEqual(JSON.stringify(expected[index]))
      // ...and realm-provider's own `realms` distribution added on top (A1)
      expect(realms).toEqual([{ serverName: 'main', usersCount: expected[index].usersTotalCount }])
    })
  })

  it('labels the added realm with the main realm name the provider reports', async () => {
    const handler = loadHandler()
    const fetch = makeFetch(() => ({ json: () => Promise.resolve(gatekeeperArray()) }))

    const response = await executeHandler(handler, makeMainRealm(true, 'main-2'), fetch, makeConfig())

    expect((response.body as any[])[0].realms).toEqual([{ serverName: 'main-2', usersCount: 9 }])
  })

  it('gives the gatekeeper a 5 second timeout', async () => {
    const handler = loadHandler()
    const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))

    await executeHandler(handler, makeMainRealm(true), fetch, makeConfig())

    expect(fetch.fetch).toHaveBeenCalledWith(`${GATEKEEPER_URL}/hot-scenes`, {
      timeout: 5000,
      abortController: expect.any(AbortController)
    })
  })

  it('aborts a response whose body stalls past the same 5 seconds', async () => {
    jest.useFakeTimers()
    try {
      const handler = loadHandler()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { ServiceUnavailableError } = require('../../src/types')
      // Headers arrive, the body never does. Only aborting the controller the request was made
      // with ends this promise, so a timeout that stops at the headers leaves it hanging.
      const fetch = makeFetch((_url, init) => ({
        json: () =>
          new Promise((_resolve, reject) => {
            init?.abortController?.signal.addEventListener('abort', () => reject(new Error('aborted')))
          })
      }))

      const pending = executeHandler(handler, makeMainRealm(true), fetch, makeConfig())
      const assertion = expect(pending).rejects.toBeInstanceOf(ServiceUnavailableError)
      let settled = false
      pending.then(
        () => (settled = true),
        () => (settled = true)
      )

      await jest.advanceTimersByTimeAsync(4999)
      expect(settled).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await assertion
      expect(settled).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('never fetches /stats/parcels or /parcels', async () => {
    const handler = loadHandler()
    const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))

    await executeHandler(handler, makeMainRealm(true), fetch, makeConfig())

    const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
    expect(urls.some((url: string) => url.includes('/stats/parcels'))).toBe(false)
    expect(urls.some((url: string) => url.endsWith('/parcels'))).toBe(false)
  })

  it('serves the cached array for 10 seconds instead of hitting the gatekeeper again', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
    try {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve(gatekeeperArray()) }))
      const config = makeConfig()

      const first = await executeHandler(handler, makeMainRealm(true), fetch, config)
      jest.setSystemTime(Date.now() + 9_000)
      const second = await executeHandler(handler, makeMainRealm(true), fetch, config)

      expect(fetch.fetch).toHaveBeenCalledTimes(1)
      expect(second.body).toEqual(first.body)
      expect(second.headers).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
  })

  it('refetches once the 10 second cache expires', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
    try {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))
      const config = makeConfig()

      await executeHandler(handler, makeMainRealm(true), fetch, config)
      jest.setSystemTime(Date.now() + 11_000)
      await executeHandler(handler, makeMainRealm(true), fetch, config)

      expect(fetch.fetch).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('makes one upstream call for requests that arrive together on a cache miss', async () => {
    const handler = loadHandler()
    let releaseFetch!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve
    })
    const fetch = {
      fetch: jest.fn(async () => {
        await gate
        return makeResponse({ json: () => Promise.resolve(gatekeeperArray()) })
      })
    }
    const config = makeConfig()

    const first = executeHandler(handler, makeMainRealm(true), fetch, config)
    const second = executeHandler(handler, makeMainRealm(true), fetch, config)

    // Both requests are now as far as they can get: the gatekeeper fetch is still in flight.
    await flushMicrotasks()
    releaseFetch()
    const [firstResponse, secondResponse] = await Promise.all([first, second])

    expect(fetch.fetch).toHaveBeenCalledTimes(1)
    expect(secondResponse.body).toEqual(firstResponse.body)
  })

  describe('and the gatekeeper fails with something cached', () => {
    const warming = () => ({ ok: false, status: 503, json: () => Promise.resolve({ ok: false, error: 'warming' }) })
    const timeout = () => Promise.reject(new Error('Request aborted (timed out)'))

    // Prime the cache, then age it by `elapsedMs` and let the gatekeeper fail.
    async function cacheThenFail(fail: () => MockResponse | Promise<never>, elapsedMs: number) {
      let failing = false
      const handler = loadHandler()
      const fetch = makeFetch(() => (failing ? fail() : { json: () => Promise.resolve(gatekeeperArray()) }))
      const config = makeConfig()

      await executeHandler(handler, makeMainRealm(true), fetch, config)
      failing = true
      jest.setSystemTime(Date.now() + elapsedMs)

      return executeHandler(handler, makeMainRealm(true), fetch, config)
    }

    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('serves the stale array on a 503 warming, flagged as stale', async () => {
      const response = await cacheThenFail(warming, 11_000)
      const scenes = response.body as any[]

      expect(response.status).toBeUndefined()
      expect(scenes[0].id).toEqual(packHotScenes.body[0].id)
      expect(scenes[0].realms).toEqual([{ serverName: 'main', usersCount: 9 }])
      expect(response.headers).toEqual({ 'X-Cache': 'stale' })
      expect(logger.warn).toHaveBeenCalled()
    })

    it('serves the stale array on a timeout, flagged as stale', async () => {
      const response = await cacheThenFail(timeout, 11_000)

      expect(response.status).toBeUndefined()
      expect(response.headers).toEqual({ 'X-Cache': 'stale' })
      expect((response.body as any[])[0].id).toEqual(packHotScenes.body[0].id)
    })

    it('serves the stale array when the gatekeeper answers a 200 that is not an array', async () => {
      const response = await cacheThenFail(() => ({ json: () => Promise.resolve({ scenes: [] }) }), 11_000)

      expect(response.status).toBeUndefined()
      expect(response.headers).toEqual({ 'X-Cache': 'stale' })
      expect((response.body as any[])[0].id).toEqual(packHotScenes.body[0].id)
    })

    it('stops serving the stale array once it is older than a minute, passing the upstream 503 on', async () => {
      const response = await cacheThenFail(warming, 61_000)

      expect(response.status).toBe(503)
      expect(response.body).toEqual({ ok: false, error: 'warming' })
      expect(response.headers).toBeUndefined()
    })

    it('stops serving the stale array once it is older than a minute, answering 503 on a timeout', async () => {
      const error = await cacheThenFail(timeout, 61_000).then(
        (response) => response,
        (err) => err
      )

      // Compared by name: loadHandler() resets the module registry, so the class the handler
      // throws is not the one this file imported. The error middleware maps it to a 503.
      expect(error.constructor.name).toBe('ServiceUnavailableError')
      expect(error.message).toMatch(/Could not reach/)
    })
  })

  it('treats a 2xx body that is not an array as an upstream failure', async () => {
    const handler = loadHandler()
    // comms-gatekeeper wraps its answer (`200 {"scenes":[…]}`), or an intermediary answers
    // `200 {}` on that path. /hot-scenes answers an array, so a JSON object must never be
    // passed through — a client doing body.map(...) would throw and `realms` would be absent.
    const fetch = makeFetch(() => ({ json: () => Promise.resolve({ scenes: [] }) }))

    const response = await executeHandler(handler, makeMainRealm(true), fetch, makeConfig())

    expect(response.status).toBe(502)
    expect(response.body).toEqual({ error: expect.stringContaining('array') })
    expect(logger.warn).toHaveBeenCalled()
  })

  it('does not cache a 2xx body that is not an array', async () => {
    const handler = loadHandler()
    let answerAnObject = true
    const fetch = makeFetch(() => ({
      json: () => Promise.resolve(answerAnObject ? { scenes: [] } : gatekeeperArray())
    }))
    const config = makeConfig()

    await executeHandler(handler, makeMainRealm(true), fetch, config)
    answerAnObject = false
    const second = await executeHandler(handler, makeMainRealm(true), fetch, config)

    // A cached object would be served for the next 10 s as if it were fresh.
    expect(fetch.fetch).toHaveBeenCalledTimes(2)
    expect(second.status).toBeUndefined()
    expect((second.body as any[])[0].id).toEqual(packHotScenes.body[0].id)
  })

  it('answers the upstream 503 warming body when there is nothing cached', async () => {
    const handler = loadHandler()
    const fetch = makeFetch(() => ({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ ok: false, error: 'warming' })
    }))

    const response = await executeHandler(handler, makeMainRealm(true), fetch, makeConfig())

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ ok: false, error: 'warming' })
  })

  it('passes a non-JSON upstream error status through instead of a blanket 503', async () => {
    const handler = loadHandler()
    // An ALB in front of the gatekeeper answers `502 <html>Bad Gateway</html>`: the body cannot
    // be parsed, but the status is the one the client must see.
    const fetch = makeFetch(() => ({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0'))
    }))

    const response = await executeHandler(handler, makeMainRealm(true), fetch, makeConfig())

    expect(response.status).toBe(502)
    expect(response.body).toEqual({ error: expect.stringContaining('502') })
  })

  it('answers 503 when the gatekeeper times out and there is nothing cached', async () => {
    const handler = loadHandler()
    // loadHandler() reset the module registry, so the error class the handler throws — and that
    // the error middleware turns into a 503 — is the one in that fresh registry.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ServiceUnavailableError } = require('../../src/types')
    const fetch = makeFetch(() => Promise.reject(new Error('timeout')))

    await expect(executeHandler(handler, makeMainRealm(true), fetch, makeConfig())).rejects.toBeInstanceOf(
      ServiceUnavailableError
    )
  })

  it('never asks for a 503 pass-through to serve an empty array as if it were data', async () => {
    // A network failure must never be papered over with `[]`: an empty list looks exactly like
    // "nobody is online anywhere", which is not what a gatekeeper outage means.
    const handler = loadHandler()
    const fetch = makeFetch(() => Promise.reject(new Error('ECONNREFUSED')))

    const error = await executeHandler(handler, makeMainRealm(true), fetch, makeConfig()).catch((err) => err)

    expect(error.constructor.name).toBe('ServiceUnavailableError')
  })
})
