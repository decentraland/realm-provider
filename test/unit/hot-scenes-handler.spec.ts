import { hotScenesHandler } from '../../src/controllers/handlers/hot-scenes-handler'
import { CatalystsProvider } from '../../src/adapters/realm-provider'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    ARCHIPELAGO_STATS_URL: 'https://archipelago-ea-stats.decentraland.org',
    ...overrides
  }
  return {
    requireString: jest.fn((key: string) => Promise.resolve(values[key])),
    getString: jest.fn((key: string) => Promise.resolve(values[key]))
  }
}

function makeFetch(responses: Record<string, { ok: boolean; status?: number; json?: () => Promise<any> }>) {
  return {
    fetch: jest.fn((url: string) => {
      const key = Object.keys(responses).find((k) => url.includes(k))
      if (!key) throw new Error(`Unexpected fetch to ${url}`)
      const r = responses[key]
      return Promise.resolve({
        ok: r.ok,
        status: r.status ?? (r.ok ? 200 : 404),
        bodyUsed: false,
        body: { cancel: () => Promise.resolve() },
        json: r.json ?? (() => Promise.resolve({}))
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

function makeCatalysts(urls: string[], realmNames: string[]): CatalystsProvider {
  return {
    getHealhtyCatalysts: jest.fn().mockResolvedValue(
      urls.map((url, i) => ({
        url,
        about: { configurations: { realmName: realmNames[i] } }
      }))
    )
  }
}

function makeMainRealm(healthy: boolean, realmName = 'main'): MainRealmProviderComponent {
  return {
    getStatus: jest.fn().mockResolvedValue({ healthy, realmName, userCount: 0, adapter: 'adapter' })
  }
}

function executeHandler(
  catalystsProvider: CatalystsProvider,
  mainRealmProvider: MainRealmProviderComponent,
  fetch: any,
  content: any,
  config: any
) {
  return hotScenesHandler({
    components: { catalystsProvider, mainRealmProvider, fetch, content, config },
    url: new URL('http://localhost/hot-scenes')
  })
}

describe('hot-scenes handler', () => {
  describe('when all DAO catalyst nodes return 404 for /stats/parcels', () => {
    it('returns an empty list instead of 500', async () => {
      const catalysts = makeCatalysts(
        ['https://peer-ec1.decentraland.org', 'https://peer-eu1.decentraland.org'],
        ['shiva', 'hela']
      )
      const mainRealm = makeMainRealm(false)
      const fetch = makeFetch({
        '/stats/parcels': { ok: false, status: 404 }
      })
      const content = makeContent([])
      const config = makeConfig()

      const { body } = await executeHandler(catalysts, mainRealm, fetch, content, config)

      expect(body).toEqual([])
    })
  })

  describe('when catalyst /stats/parcels returns valid data', () => {
    it('returns hot scenes aggregated from catalyst parcel data', async () => {
      const catalysts = makeCatalysts(['https://peer-ec1.decentraland.org'], ['shiva'])
      const mainRealm = makeMainRealm(false)
      const fetch = makeFetch({
        '/stats/parcels': {
          ok: true,
          json: () => Promise.resolve({ parcels: [{ peersCount: 5, parcel: { x: 0, y: 0 } }] })
        }
      })
      const content = makeContent([
        {
          id: 'scene-1',
          content: [],
          metadata: {
            display: { title: 'Genesis Plaza', navmapThumbnail: undefined },
            scene: { base: '0,0', parcels: ['0,0'] }
          }
        }
      ])
      const config = makeConfig()

      const { body } = await executeHandler(catalysts, mainRealm, fetch, content, config)

      expect(body).toHaveLength(1)
      expect(body[0].usersTotalCount).toBe(5)
      expect(body[0].realms).toEqual([{ serverName: 'shiva', usersCount: 5 }])
    })
  })

  describe('when main realm is healthy but /parcels returns non-2xx', () => {
    it('returns an empty list gracefully', async () => {
      const catalysts = makeCatalysts([], [])
      const mainRealm = makeMainRealm(true)
      const fetch = makeFetch({
        '/parcels': { ok: false, status: 503 }
      })
      const content = makeContent([])
      const config = makeConfig()

      const { body } = await executeHandler(catalysts, mainRealm, fetch, content, config)

      expect(body).toEqual([])
    })
  })

  describe('when main realm is healthy and /parcels returns valid data', () => {
    it('returns hot scenes from main realm parcel data', async () => {
      const catalysts = makeCatalysts([], [])
      const mainRealm = makeMainRealm(true, 'main')
      const fetch = makeFetch({
        '/parcels': {
          ok: true,
          json: () => Promise.resolve({ parcels: [{ peersCount: 10, parcel: { x: 1, y: 0 } }] })
        }
      })
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

      const { body } = await executeHandler(catalysts, mainRealm, fetch, content, config)

      expect(body).toHaveLength(1)
      expect(body[0].usersTotalCount).toBe(10)
      expect(body[0].realms).toEqual([{ serverName: 'main', usersCount: 10 }])
    })
  })
})
