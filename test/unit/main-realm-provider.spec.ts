import { readFileSync } from 'fs'
import { join } from 'path'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { createMainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

const STATS_URL = 'https://archipelago-ea-stats.decentraland.org'
const PULSE_URL = 'https://pulse.decentraland.org'
const WS_CONNECTOR_URL = 'https://archipelago-ws-connector.decentraland.org'

function readFixture(relativePath: string) {
  return JSON.parse(readFileSync(join(__dirname, '../fixtures/iteration-2', relativePath), 'utf-8'))
}

const packRealms = readFixture('http/realms.json')
const packHealth = readFixture('http/health.json')

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    ARCHIPELAGO_STATS_URL: STATS_URL,
    ARCHIPELAGO_WS_CONNECTOR_URL: WS_CONNECTOR_URL,
    PULSE_URL,
    ...overrides
  }
  return {
    requireString: jest.fn((key: string) => Promise.resolve(values[key])),
    getString: jest.fn((key: string) => Promise.resolve(values[key]))
  } as any
}

type MockResponse = { status?: number; ok?: boolean; json?: () => Promise<any> }

function makeFetch(routes: Record<string, MockResponse>) {
  return {
    fetch: jest.fn((url: string) => {
      const key = Object.keys(routes).find((route) => url.endsWith(route))
      if (!key) {
        return Promise.reject(new Error(`Unexpected fetch to ${url}`))
      }
      const route = routes[key]
      const status = route.status ?? 200
      return Promise.resolve({
        ok: route.ok ?? status < 300,
        status,
        bodyUsed: false,
        body: { cancel: () => Promise.resolve() },
        json: route.json ?? (() => Promise.resolve({}))
      })
    })
  } as any
}

const logs = { getLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) } as any

const connectorStatus = { json: () => Promise.resolve({ version: '1.0.0', commitHash: 'abc1234' }) }

// The main realm's peer count as Pulse reports it for Genesis City: realms[name == 'main'].peers.
const packMainPeers = packRealms.body.realms.find((realm: any) => realm.name === 'main').peers

describe('main realm provider', () => {
  describe('when PRESENCE_SOURCE is not set', () => {
    it('reads the user count from archipelago-stats /core-status, as it does today', async () => {
      const fetch = makeFetch({
        '/core-status': { json: () => Promise.resolve({ healthy: true, userCount: 27 }) },
        '/status': connectorStatus
      })

      const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(fetch.fetch).toHaveBeenCalledWith(`${STATS_URL}/core-status`)
      expect(status.healthy).toBe(true)
      expect(status.userCount).toBe(27)
      expect(status.realmName).toBe('main')
      expect(status.adapter).toBe(`archipelago:archipelago:wss://archipelago-ws-connector.decentraland.org/ws`)
    })
  })

  describe('when PRESENCE_SOURCE is pulse', () => {
    function pulseConfig() {
      return makeConfig({ PRESENCE_SOURCE: 'pulse' })
    }

    function pulseFetch(realmsResponse: MockResponse, healthStatus = 200) {
      return makeFetch({
        '/realms': realmsResponse,
        '/health': { status: healthStatus },
        '/status': connectorStatus
      })
    }

    it('reports the Genesis City peer count from Pulse /realms and a 200 /health as healthy', async () => {
      const fetch = pulseFetch(
        { status: packRealms.status, json: () => Promise.resolve(packRealms.body) },
        packHealth.status
      )

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/realms`)
      expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/health`)
      expect(status.healthy).toBe(true)
      // 4 peers in `main`, not the 5 that /about counts across every realm
      expect(status.userCount).toBe(packMainPeers)
      expect(status.userCount).toBe(4)
      expect(status.realmName).toBe('main')
    })

    it('reports no users when Pulse /realms does not list main', async () => {
      const fetch = pulseFetch({
        json: () =>
          Promise.resolve({
            realms: [{ name: 'cozyfarm.dcl.eth', peers: 1, clusters: 1 }],
            lastUpdated: packRealms.body.lastUpdated
          })
      })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(status.healthy).toBe(true)
      expect(status.userCount).toBe(0)
    })

    it('reports no users when Pulse /realms answers a body with no realms at all', async () => {
      const fetch = pulseFetch({ json: () => Promise.resolve({}) })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      // A malformed body must not throw into the getStatus catch: healthy still comes from /health.
      expect(status.healthy).toBe(true)
      expect(status.userCount).toBe(0)
    })

    it('never reads /about or /core-status', async () => {
      const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      await provider.getStatus()

      const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
      expect(urls.some((url: string) => url.endsWith('/about'))).toBe(false)
      expect(urls.some((url: string) => url.includes('/core-status'))).toBe(false)
      expect(urls.some((url: string) => url.includes(STATS_URL))).toBe(false)
    })

    it('reports unhealthy when Pulse /health is not 200, keeping the peer count', async () => {
      const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) }, 503)

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(status.healthy).toBe(false)
      expect(status.userCount).toBe(packMainPeers)
    })

    it('still points clients at the ws-connector adapter', async () => {
      const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(status.adapter).toBe(`archipelago:archipelago:wss://archipelago-ws-connector.decentraland.org/ws`)
    })

    it('reports an unhealthy realm with no users when Pulse is unreachable', async () => {
      const fetch = makeFetch({ '/status': connectorStatus })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(status).toEqual({
        healthy: false,
        userCount: 0,
        realmName: 'main',
        adapter: `archipelago:archipelago:wss://archipelago-ws-connector.decentraland.org/ws`
      })
    })

    it('exposes the main realm name without a round trip, so /hot-scenes can label it', async () => {
      const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })

      expect(provider.realmName).toBe('main')
      expect(fetch.fetch).not.toHaveBeenCalled()
    })

    it('fails at component creation when PULSE_URL is not configured', async () => {
      // The real config component throws on a missing requireString key; the mock above resolves
      // undefined, which would hide the startup failure.
      const config = createConfigComponent({
        PRESENCE_SOURCE: 'pulse',
        ARCHIPELAGO_WS_CONNECTOR_URL: WS_CONNECTOR_URL
      })
      const fetch = makeFetch({})

      await expect(createMainRealmProviderComponent({ config, fetch, logs })).rejects.toThrow(/PULSE_URL/)
      expect(fetch.fetch).not.toHaveBeenCalled()
    })
  })
})
