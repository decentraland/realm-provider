import { readFileSync } from 'fs'
import { join } from 'path'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { createMainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

const PULSE_URL = 'https://pulse.decentraland.org'
const WS_CONNECTOR_URL = 'https://archipelago-ws-connector.decentraland.org'

function readFixture(relativePath: string) {
  return JSON.parse(readFileSync(join(__dirname, '../fixtures/iteration-2', relativePath), 'utf-8'))
}

const packRealms = readFixture('http/realms.json')
const packHealth = readFixture('http/health.json')
const mainPeers = packRealms.body.realms.find((realm: any) => realm.name === 'main').peers

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
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
    fetch: jest.fn((url: string, _init?: any) => {
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

const connectorStatus = { json: () => Promise.resolve({ version: '1.0.0', commitHash: 'abc1234' }) }

function pulseFetch(realmsResponse: MockResponse, healthStatus = 200) {
  return makeFetch({
    '/realms': realmsResponse,
    '/health': { status: healthStatus },
    '/status': connectorStatus
  })
}

describe('main realm provider', () => {
  it('reports the MAIN realm peers from Pulse /realms and a 200 /health as healthy', async () => {
    const fetch = pulseFetch(
      { status: packRealms.status, json: () => Promise.resolve(packRealms.body) },
      packHealth.status
    )

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    const status = await provider.getStatus()

    expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/realms`, expect.anything())
    expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/health`, expect.anything())
    expect(status.healthy).toBe(true)
    expect(status.userCount).toBe(mainPeers)
    expect(status.userCount).toBe(4)
    expect(status.realmName).toBe('main')
  })

  it('reports 0 users when Pulse /realms has no main entry', async () => {
    const fetch = pulseFetch({ json: () => Promise.resolve({ realms: [{ name: 'cozyfarm.dcl.eth', peers: 1 }] }) })

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    const status = await provider.getStatus()

    // A body missing the main entry must not throw into the getStatus catch: healthy still comes
    // from /health.
    expect(status.healthy).toBe(true)
    expect(status.userCount).toBe(0)
  })

  it('never reads the retired /about endpoint', async () => {
    const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) })

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    await provider.getStatus()

    const urls = fetch.fetch.mock.calls.map((call: any[]) => String(call[0]))
    expect(urls.some((url: string) => url.endsWith('/about'))).toBe(false)
  })

  it('reports unhealthy when Pulse /health is not 200, keeping the user count', async () => {
    const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) }, 503)

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    const status = await provider.getStatus()

    expect(status.healthy).toBe(false)
    expect(status.userCount).toBe(mainPeers)
  })

  it('still points clients at the ws-connector adapter', async () => {
    const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) })

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    const status = await provider.getStatus()

    expect(status.adapter).toBe(`archipelago:archipelago:wss://archipelago-ws-connector.decentraland.org/ws`)
  })

  it('reports an unhealthy realm with no users when Pulse is unreachable', async () => {
    const fetch = makeFetch({ '/status': connectorStatus })

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
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

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })

    expect(provider.realmName).toBe('main')
    expect(fetch.fetch).not.toHaveBeenCalled()
  })

  it('bounds both Pulse reads with the same 5 second deadline', async () => {
    const fetch = pulseFetch({ json: () => Promise.resolve(packRealms.body) })

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    await provider.getStatus()

    const deadline = { timeout: 5000, abortController: expect.any(AbortController) }
    expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/realms`, deadline)
    expect(fetch.fetch).toHaveBeenCalledWith(`${PULSE_URL}/health`, deadline)
  })

  it('degrades to an unhealthy realm with no users when a Pulse read never answers', async () => {
    jest.useFakeTimers()
    try {
      // Pulse accepts the connection and never answers (GC pause, deadlocked handler, an LB
      // holding the socket open). undici applies no default request timeout, so only the
      // deadline this provider arms can end the call.
      const fetch = {
        fetch: jest.fn((url: string, init?: any) => {
          if (url.endsWith('/status')) {
            return Promise.resolve({ ok: true, status: 200, bodyUsed: false, body: null, json: connectorStatus.json })
          }
          return new Promise((_resolve, reject) => {
            init?.abortController?.signal.addEventListener('abort', () => reject(new Error('aborted')))
          })
        })
      } as any

      const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
      const pending = provider.getStatus()
      let settled = false
      pending.then(
        () => (settled = true),
        () => (settled = true)
      )

      await jest.advanceTimersByTimeAsync(4999)
      expect(settled).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await expect(pending).resolves.toEqual({
        healthy: false,
        userCount: 0,
        realmName: 'main',
        adapter: `archipelago:archipelago:wss://archipelago-ws-connector.decentraland.org/ws`
      })
    } finally {
      jest.useRealTimers()
    }
  })

  it('cancels the sibling Pulse response when the other read fails', async () => {
    const cancel = jest.fn(() => Promise.resolve())
    const fetch = {
      fetch: jest.fn((url: string) => {
        if (url.endsWith('/realms')) {
          return Promise.reject(new Error('ECONNRESET'))
        }
        if (url.endsWith('/health')) {
          return Promise.resolve({ ok: true, status: 200, bodyUsed: false, body: { cancel } })
        }
        return Promise.resolve({ ok: true, status: 200, bodyUsed: false, body: null, json: connectorStatus.json })
      })
    } as any

    const provider = await createMainRealmProviderComponent({ config: makeConfig(), fetch })
    const status = await provider.getStatus()

    expect(status.healthy).toBe(false)
    expect(status.userCount).toBe(0)
    // Promise.all abandons the /health response when /realms rejects, and undici keeps that
    // socket pinned until GC. The body must be cancelled instead.
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('fails at component creation when PULSE_URL is not configured', async () => {
    // The real config component throws on a missing requireString key; the mock above resolves
    // undefined, which would hide the startup failure.
    const config = createConfigComponent({
      ARCHIPELAGO_WS_CONNECTOR_URL: WS_CONNECTOR_URL
    })
    const fetch = makeFetch({})

    await expect(createMainRealmProviderComponent({ config, fetch })).rejects.toThrow(/PULSE_URL/)
    expect(fetch.fetch).not.toHaveBeenCalled()
  })
})
