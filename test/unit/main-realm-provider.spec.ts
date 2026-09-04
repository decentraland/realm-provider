import { readFileSync } from 'fs'
import { join } from 'path'
import { createMainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

const STATS_URL = 'https://archipelago-ea-stats.decentraland.org'
const PULSE_URL = 'https://pulse.decentraland.org'
const WS_CONNECTOR_URL = 'https://archipelago-ws-connector.decentraland.org'

function readFixture(relativePath: string) {
  return JSON.parse(readFileSync(join(__dirname, '../fixtures/iteration-2', relativePath), 'utf-8'))
}

const packAbout = readFixture('http/about.json')
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

    it('maps Pulse /about userCount and a 200 /health to a healthy status', async () => {
      const fetch = makeFetch({
        '/about': { status: packAbout.status, json: () => Promise.resolve(packAbout.body) },
        '/health': { status: packHealth.status },
        '/status': connectorStatus
      })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/about`)
      expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/health`)
      expect(status.healthy).toBe(true)
      expect(status.userCount).toBe(packAbout.body.userCount)
      expect(status.realmName).toBe('main')
    })

    it('reports unhealthy when Pulse /health is not 200, keeping the /about user count', async () => {
      const fetch = makeFetch({
        '/about': { json: () => Promise.resolve(packAbout.body) },
        '/health': { status: 503 },
        '/status': connectorStatus
      })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      const status = await provider.getStatus()

      expect(status.healthy).toBe(false)
      expect(status.userCount).toBe(packAbout.body.userCount)
    })

    it('never reads /core-status', async () => {
      const fetch = makeFetch({
        '/about': { json: () => Promise.resolve(packAbout.body) },
        '/health': { status: 200 },
        '/status': connectorStatus
      })

      const provider = await createMainRealmProviderComponent({ config: pulseConfig(), fetch, logs })
      await provider.getStatus()

      const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
      expect(urls.some((url: string) => url.includes('/core-status'))).toBe(false)
      expect(urls.some((url: string) => url.includes(STATS_URL))).toBe(false)
    })

    it('still points clients at the ws-connector adapter', async () => {
      const fetch = makeFetch({
        '/about': { json: () => Promise.resolve(packAbout.body) },
        '/health': { status: 200 },
        '/status': connectorStatus
      })

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
  })
})
