import { readFileSync } from 'fs'
import { join } from 'path'
import type { hotScenesHandler as HotScenesHandler } from '../../src/controllers/handlers/hot-scenes-handler'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

const GATEKEEPER_URL = 'https://comms-gatekeeper.decentraland.org'
const STATS_URL = 'https://archipelago-ea-stats.decentraland.org'

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
    ARCHIPELAGO_STATS_URL: STATS_URL,
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

function makeContent(scenes: any[] = []) {
  return {
    fetchScenes: jest.fn().mockResolvedValue(scenes),
    calculateThumbnail: jest.fn().mockReturnValue(undefined)
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

function executeHandler(
  handler: typeof HotScenesHandler,
  mainRealmProvider: MainRealmProviderComponent,
  fetch: any,
  content: any,
  config: any
) {
  return handler({
    components: { mainRealmProvider, fetch, content, config, logs },
    url: new URL('http://localhost/hot-scenes')
  } as any)
}

/** Flush every pending microtask, so concurrent handler calls reach their next await. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

describe('hot-scenes handler', () => {
  beforeEach(() => {
    logger.warn.mockClear()
  })

  describe('when PRESENCE_SOURCE is not set', () => {
    it('aggregates parcels from archipelago-stats, as it does today', async () => {
      const handler = loadHandler()
      const mainRealm = makeMainRealm(true, 'main')
      const fetch = makeFetch(() => ({
        json: () => Promise.resolve({ parcels: [{ peersCount: 10, parcel: { x: 1, y: 0 } }] })
      }))
      const content = makeContent([
        {
          id: 'scene-2',
          content: [],
          metadata: {
            display: { title: 'Some Scene', navmapThumbnail: undefined },
            scene: { base: '1,0', parcels: ['1,0'] }
          }
        }
      ])
      const config = makeConfig()

      const { body } = await executeHandler(handler, mainRealm, fetch, content, config)
      const scenes = body as any[]

      expect(fetch.fetch).toHaveBeenCalledWith(`${STATS_URL}/parcels`)
      expect(scenes).toHaveLength(1)
      expect(scenes[0].usersTotalCount).toBe(10)
      expect(scenes[0].realms).toEqual([{ serverName: 'main', usersCount: 10 }])
    })
  })

  describe('when PRESENCE_SOURCE is archipelago', () => {
    it('returns an empty list when the main realm is unhealthy', async () => {
      const handler = loadHandler()
      const mainRealm = makeMainRealm(false)
      const fetch = makeFetch(() => ({}))
      const content = makeContent([])
      const config = makeConfig({ PRESENCE_SOURCE: 'archipelago' })

      const { body } = await executeHandler(handler, mainRealm, fetch, content, config)

      expect(body).toEqual([])
      expect(fetch.fetch).not.toHaveBeenCalled()
    })

    it('returns an empty list gracefully when /parcels returns non-2xx', async () => {
      const handler = loadHandler()
      const mainRealm = makeMainRealm(true)
      const fetch = makeFetch(() => ({ ok: false, status: 503 }))
      const content = makeContent([])
      const config = makeConfig({ PRESENCE_SOURCE: 'archipelago' })

      const { body } = await executeHandler(handler, mainRealm, fetch, content, config)

      expect(body).toEqual([])
    })

    it('never fetches /stats/parcels from a catalyst', async () => {
      const handler = loadHandler()
      const mainRealm = makeMainRealm(true, 'main')
      const fetch = makeFetch(() => ({
        json: () => Promise.resolve({ parcels: [{ peersCount: 3, parcel: { x: 0, y: 0 } }] })
      }))
      const content = makeContent([])
      const config = makeConfig({ PRESENCE_SOURCE: 'archipelago' })

      await executeHandler(handler, mainRealm, fetch, content, config)

      const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
      expect(urls.some((url: string) => url.includes('/stats/parcels'))).toBe(false)
    })
  })

  describe('when PRESENCE_SOURCE is pulse', () => {
    function pulseConfig() {
      return makeConfig({ PRESENCE_SOURCE: 'pulse' })
    }

    function gatekeeperArray() {
      return JSON.parse(JSON.stringify(packHotScenes.body))
    }

    it('passes every comms-gatekeeper field through and adds the main realm to each entry', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve(gatekeeperArray()) }))

      const response = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

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

      const response = await executeHandler(
        handler,
        makeMainRealm(true, 'main-2'),
        fetch,
        makeContent([]),
        pulseConfig()
      )

      expect((response.body as any[])[0].realms).toEqual([{ serverName: 'main-2', usersCount: 9 }])
    })

    it('gives the gatekeeper a 5 second timeout', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))

      await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

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

        const pending = executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())
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

    it('never fetches /stats/parcels nor archipelago-stats', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))

      await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

      const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
      expect(urls.some((url: string) => url.includes('/stats/parcels'))).toBe(false)
      expect(urls.some((url: string) => url.includes(STATS_URL))).toBe(false)
    })

    it('does not call the content server', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve(gatekeeperArray()) }))
      const content = makeContent([])

      await executeHandler(handler, makeMainRealm(true), fetch, content, pulseConfig())

      expect(content.fetchScenes).not.toHaveBeenCalled()
    })

    it('serves the cached array for 10 seconds instead of hitting the gatekeeper again', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
      try {
        const handler = loadHandler()
        const fetch = makeFetch(() => ({ json: () => Promise.resolve(gatekeeperArray()) }))
        const config = pulseConfig()

        const first = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
        jest.setSystemTime(Date.now() + 9_000)
        const second = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)

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
        const config = pulseConfig()

        await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
        jest.setSystemTime(Date.now() + 11_000)
        await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)

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
      const config = pulseConfig()

      const first = executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
      const second = executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)

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
        const config = pulseConfig()

        await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
        failing = true
        jest.setSystemTime(Date.now() + elapsedMs)

        return executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
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

    it('answers the upstream 503 warming body when there is nothing cached', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({
        ok: false,
        status: 503,
        json: () => Promise.resolve({ ok: false, error: 'warming' })
      }))

      const response = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

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

      const response = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

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

      await expect(
        executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())
      ).rejects.toBeInstanceOf(ServiceUnavailableError)
    })
  })
})
