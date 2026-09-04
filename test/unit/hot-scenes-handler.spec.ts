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

function makeFetch(handler: (url: string, init?: any) => MockResponse | Promise<never>) {
  return {
    fetch: jest.fn((url: string, init?: any) => {
      const result = handler(url, init)
      if (result instanceof Promise) {
        return result
      }
      const status = result.status ?? (result.ok === false ? 404 : 200)
      return Promise.resolve({
        ok: result.ok ?? status < 300,
        status,
        bodyUsed: false,
        body: { cancel: () => Promise.resolve() },
        json: result.json ?? (() => Promise.resolve({}))
      })
    })
  }
}

function makeContent(scenes: any[] = []) {
  return {
    fetchScenes: jest.fn().mockResolvedValue(scenes),
    calculateThumbnail: jest.fn().mockReturnValue(undefined)
  }
}

function makeMainRealm(healthy: boolean, realmName = 'main'): MainRealmProviderComponent {
  return {
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
    components: { mainRealmProvider, fetch, content, config },
    url: new URL('http://localhost/hot-scenes')
  } as any)
}

describe('hot-scenes handler', () => {
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

    it('passes the comms-gatekeeper bare array through unchanged', async () => {
      const handler = loadHandler()
      const mainRealm = makeMainRealm(true)
      const fetch = makeFetch(() => ({ json: () => Promise.resolve(JSON.parse(JSON.stringify(packHotScenes.body))) }))
      const content = makeContent([])

      const response = await executeHandler(handler, mainRealm, fetch, content, pulseConfig())

      expect(fetch.fetch).toHaveBeenCalledWith(`${GATEKEEPER_URL}/hot-scenes`, expect.anything())
      expect(response.status).toBeUndefined()
      expect(response.body).toEqual(packHotScenes.body)
      // byte-for-byte: no key added, removed or re-ordered on the way through
      expect(JSON.stringify(response.body)).toEqual(JSON.stringify(packHotScenes.body))
      expect(content.fetchScenes).not.toHaveBeenCalled()
    })

    it('gives the gatekeeper a 5 second timeout', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))

      await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

      expect(fetch.fetch).toHaveBeenCalledWith(`${GATEKEEPER_URL}/hot-scenes`, { timeout: 5000 })
    })

    it('never fetches /stats/parcels nor archipelago-stats', async () => {
      const handler = loadHandler()
      const fetch = makeFetch(() => ({ json: () => Promise.resolve([]) }))

      await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), pulseConfig())

      const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
      expect(urls.some((url: string) => url.includes('/stats/parcels'))).toBe(false)
      expect(urls.some((url: string) => url.includes(STATS_URL))).toBe(false)
    })

    it('serves the cached array for 10 seconds instead of hitting the gatekeeper again', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
      try {
        const handler = loadHandler()
        const fetch = makeFetch(() => ({ json: () => Promise.resolve(packHotScenes.body) }))
        const config = pulseConfig()

        const first = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
        jest.setSystemTime(Date.now() + 9_000)
        const second = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)

        expect(fetch.fetch).toHaveBeenCalledTimes(1)
        expect(second.body).toEqual(first.body)
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

    it('serves the stale cached array when the gatekeeper answers 503 warming', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
      try {
        const handler = loadHandler()
        let warming = false
        const fetch = makeFetch(() =>
          warming
            ? { ok: false, status: 503, json: () => Promise.resolve({ ok: false, error: 'warming' }) }
            : { json: () => Promise.resolve(packHotScenes.body) }
        )
        const config = pulseConfig()

        await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
        warming = true
        jest.setSystemTime(Date.now() + 11_000)
        const response = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)

        expect(response.status).toBeUndefined()
        expect(response.body).toEqual(packHotScenes.body)
      } finally {
        jest.useRealTimers()
      }
    })

    it('serves the stale cached array when the gatekeeper times out', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-04T09:52:47.804Z'))
      try {
        const handler = loadHandler()
        let timeout = false
        const fetch = makeFetch(() =>
          timeout ? Promise.reject(new Error('timeout')) : { json: () => Promise.resolve(packHotScenes.body) }
        )
        const config = pulseConfig()

        await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)
        timeout = true
        jest.setSystemTime(Date.now() + 11_000)
        const response = await executeHandler(handler, makeMainRealm(true), fetch, makeContent([]), config)

        expect(response.status).toBeUndefined()
        expect(response.body).toEqual(packHotScenes.body)
      } finally {
        jest.useRealTimers()
      }
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
