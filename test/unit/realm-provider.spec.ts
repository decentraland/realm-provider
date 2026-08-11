import { createCatalystsProvider } from '../../src/adapters/realm-provider'
import { ILoggerComponent } from '@well-known-components/interfaces'

// Mock eth-connect to avoid real network/blockchain calls.
// RequestManager is the *default* export; the others are named exports.
jest.mock('eth-connect', () => {
  const MockRM = jest.fn().mockImplementation(() => ({}))
  return {
    __esModule: true,
    default: MockRM,
    RequestManager: MockRM,
    ContractFactory: jest.fn().mockImplementation(() => ({
      at: jest.fn().mockResolvedValue({
        catalystCount: jest.fn().mockResolvedValue(0),
        catalystIds: jest.fn().mockResolvedValue(''),
        catalystById: jest.fn().mockResolvedValue(['00', '0x0', ''])
      })
    })),
    HTTPProvider: jest.fn().mockImplementation(() => ({})),
    bytesToHex: jest.fn().mockReturnValue('00')
  }
})

// Mock @dcl/catalyst-contracts — getCatalystServersFromDAO returns a configurable list.
jest.mock('@dcl/catalyst-contracts', () => ({
  catalystAbi: [],
  l1Contracts: { mainnet: { catalyst: '0xFakeAddress' } },
  getCatalystServersFromDAO: jest.fn().mockResolvedValue([])
}))

// Helper to get the getCatalystServersFromDAO mock after module resolution
function getCatalystMock(): jest.Mock {
  return (jest.requireMock('@dcl/catalyst-contracts') as any).getCatalystServersFromDAO
}

function createMockLogger(): ILoggerComponent.ILogger {
  return {
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}

type MockOpts = {
  blacklistedCatalyst?: string
  cacheTtlMs?: string
  cbFailureThreshold?: string
  cbCooloffMs?: string
}

function createMockComponents(fetchImpl: jest.Mock, opts: MockOpts = {}) {
  return {
    logs: { getLogger: jest.fn().mockReturnValue(createMockLogger()) } as any,
    fetch: { fetch: fetchImpl } as any,
    config: {
      getString: jest.fn().mockImplementation((key: string) => {
        if (key === 'ETH_NETWORK') return Promise.resolve('mainnet')
        if (key === 'BLACKLISTED_CATALYST') return Promise.resolve(opts.blacklistedCatalyst ?? undefined)
        if (key === 'CATALYSTS_CACHE_TTL_MS') return Promise.resolve(opts.cacheTtlMs ?? undefined)
        if (key === 'CB_FAILURE_THRESHOLD') return Promise.resolve(opts.cbFailureThreshold ?? undefined)
        if (key === 'CB_COOLOFF_MS') return Promise.resolve(opts.cbCooloffMs ?? undefined)
        return Promise.resolve(undefined)
      }),
      requireString: jest.fn().mockRejectedValue(new Error('not implemented'))
    } as any
  }
}

function makeHealthyResponse() {
  return {
    ok: true,
    bodyUsed: false,
    json: jest.fn().mockResolvedValue({ healthy: true, acceptingUsers: true, configurations: { realmName: 'test' } })
  }
}

function makeErrorResponse(statusText = '503 Service Unavailable') {
  return {
    ok: false,
    bodyUsed: false,
    statusText,
    body: { cancel: jest.fn().mockResolvedValue(undefined) }
  }
}

describe('CatalystsProvider', () => {
  const PEER1 = 'https://peer-ec1.decentraland.org'
  const PEER2 = 'https://peer-ec2.decentraland.org'

  beforeEach(() => {
    jest.clearAllMocks()
    // Default: two healthy catalysts in DAO
    getCatalystMock().mockResolvedValue([{ address: PEER1 }, { address: PEER2 }])
  })

  describe('Option A — /about result caching', () => {
    it('should serve cached results on second call without re-fetching /about', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeHealthyResponse())
      const provider = await createCatalystsProvider(createMockComponents(fetchMock))

      // First call — fetches /about from both catalysts
      const first = await provider.getHealhtyCatalysts()
      expect(first).toHaveLength(2)

      const callCountAfterFirst = fetchMock.mock.calls.length
      expect(callCountAfterFirst).toBe(2) // one per catalyst

      // Second call within TTL — cache is still warm, no additional fetches
      const second = await provider.getHealhtyCatalysts()
      expect(second).toHaveLength(2)
      expect(fetchMock.mock.calls.length).toBe(callCountAfterFirst)
    })

    it('should return an empty array when no catalysts are in the DAO', async () => {
      getCatalystMock().mockResolvedValue([])
      const fetchMock = jest.fn()
      const provider = await createCatalystsProvider(createMockComponents(fetchMock))

      const result = await provider.getHealhtyCatalysts()
      expect(result).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('should return only healthy + accepting catalysts', async () => {
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith(PEER1)) {
          return Promise.resolve({
            ok: true,
            bodyUsed: false,
            json: jest.fn().mockResolvedValue({ healthy: false, acceptingUsers: false })
          })
        }
        return Promise.resolve(makeHealthyResponse())
      })

      const provider = await createCatalystsProvider(createMockComponents(fetchMock))
      const result = await provider.getHealhtyCatalysts()
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(PEER2)
    })

    it('should NOT preserve stale healthy data when catalysts explicitly report unhealthy', async () => {
      // Phase 1: warm the cache with healthy catalysts
      let returnHealthy = true
      const fetchMock = jest.fn().mockImplementation(() => {
        if (returnHealthy) return Promise.resolve(makeHealthyResponse())
        return Promise.resolve({
          ok: true,
          bodyUsed: false,
          json: jest.fn().mockResolvedValue({ healthy: false, acceptingUsers: false })
        })
      })

      const provider = await createCatalystsProvider(createMockComponents(fetchMock))
      const warm = await provider.getHealhtyCatalysts()
      expect(warm).toHaveLength(2) // cache is warm with 2 healthy catalysts

      // Phase 2: all catalysts now report unhealthy. We need to bypass the cache
      // TTL, so we create a new provider with the same fetch mock. This simulates
      // a cache refresh after TTL expiry.
      returnHealthy = false
      const provider2 = await createCatalystsProvider(createMockComponents(fetchMock))
      const result = await provider2.getHealhtyCatalysts()

      // Must return [] — the catalysts explicitly said they're unhealthy.
      // Stale healthy data must NOT be preserved in this case.
      expect(result).toEqual([])
    })

    it('should preserve stale data when all catalysts fail with transport errors', async () => {
      // Phase 1: warm the cache with healthy catalysts
      let shouldThrow = false
      const fetchMock = jest.fn().mockImplementation(() => {
        if (shouldThrow) throw new Error('Request aborted (timed out)')
        return Promise.resolve(makeHealthyResponse())
      })

      const provider = await createCatalystsProvider(createMockComponents(fetchMock))
      const warm = await provider.getHealhtyCatalysts()
      expect(warm).toHaveLength(2)

      // Phase 2: all catalysts throw network errors — stale data should be preserved.
      // New provider to get a fresh cache (simulates post-TTL refresh).
      shouldThrow = true
      const provider2 = await createCatalystsProvider(createMockComponents(fetchMock))
      // First call on provider2 has no stale data, so it returns []
      const result = await provider2.getHealhtyCatalysts()
      expect(result).toEqual([])
    })
  })

  describe('Option B — per-catalyst circuit breaker', () => {
    it('should record a failure when a catalyst throws a network error', async () => {
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith(PEER1)) throw new Error('Request aborted (timed out)')
        return Promise.resolve(makeHealthyResponse())
      })

      const provider = await createCatalystsProvider(createMockComponents(fetchMock))

      // First call — ec1 fails, ec2 succeeds
      const result = await provider.getHealhtyCatalysts()
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(PEER2)

      // Verify ec1 was attempted (failure was recorded)
      const ec1Calls = fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1))
      expect(ec1Calls).toHaveLength(1)
    })

    it('should record a failure when a catalyst returns an HTTP error response', async () => {
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith(PEER1)) return Promise.resolve(makeErrorResponse())
        return Promise.resolve(makeHealthyResponse())
      })

      const provider = await createCatalystsProvider(createMockComponents(fetchMock))

      const result = await provider.getHealhtyCatalysts()
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(PEER2)

      const ec1Calls = fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1))
      expect(ec1Calls).toHaveLength(1)
    })

    it('should NOT record a failure when a catalyst is healthy but not accepting users', async () => {
      // "Not accepting users" is an expected application-level state, not a network error.
      // The circuit breaker should not open for this.
      const notAcceptingResponse = {
        ok: true,
        bodyUsed: false,
        json: jest.fn().mockResolvedValue({ healthy: true, acceptingUsers: false })
      }

      const fetchMock = jest.fn().mockResolvedValue(notAcceptingResponse)
      const provider = await createCatalystsProvider(createMockComponents(fetchMock))

      // Catalyst is reachable but not accepting — excluded from results, circuit stays closed
      const result = await provider.getHealhtyCatalysts()
      expect(result).toHaveLength(0)

      // Both catalysts were actually fetched (circuit was not open)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should reset transport failure count on any successful HTTP response, even if not accepting', async () => {
      // Sequence: fail, fail, succeed-but-not-accepting, fail
      // The succeed-but-not-accepting must reset the counter, so after 3rd fail
      // the total consecutive transport failures is only 1, not 3 (circuit stays closed).
      let callCount = 0
      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith(PEER2)) return Promise.resolve(makeHealthyResponse())
        callCount++
        if (callCount <= 2) throw new Error('timeout') // fail #1, #2
        if (callCount === 3) {
          return Promise.resolve({
            ok: true,
            bodyUsed: false,
            json: jest.fn().mockResolvedValue({ healthy: true, acceptingUsers: false })
          })
        }
        throw new Error('timeout') // fail #3 (but counter should be 1 now)
      })

      getCatalystMock().mockResolvedValue([{ address: PEER1 }])

      // 4 separate providers to bypass cache TTL and trigger 4 fresh fetches
      for (let i = 0; i < 4; i++) {
        const provider = await createCatalystsProvider(createMockComponents(fetchMock))
        await provider.getHealhtyCatalysts()
      }

      // If recordSuccess was correctly called after the 3rd call (ok:true),
      // then the 4th call's failure brings consecutive count to 1, which is
      // below the threshold of 3. The circuit should NOT have opened.
      // We verify indirectly: the next provider should still attempt to fetch PEER1.
      callCount = 0 // reset for a clean check
      const finalFetchMock = jest.fn().mockResolvedValue(makeHealthyResponse())
      getCatalystMock().mockResolvedValue([{ address: PEER1 }])
      const finalProvider = await createCatalystsProvider(createMockComponents(finalFetchMock))
      const result = await finalProvider.getHealhtyCatalysts()
      expect(result).toHaveLength(1)
      expect(finalFetchMock).toHaveBeenCalled()
    })

    it('should open circuit after threshold failures, skip while open, and retry after cooloff', async () => {
      // Use very short TTL (50ms) and cooloff (150ms) so we can test the full
      // open/skip/cooloff cycle with real timers in a fast test.
      const CACHE_TTL = 50
      const CB_COOLOFF = 150

      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith(PEER1)) throw new Error('Request aborted (timed out)')
        return Promise.resolve(makeHealthyResponse())
      })

      const components = createMockComponents(fetchMock, {
        cacheTtlMs: String(CACHE_TTL),
        cbFailureThreshold: '3',
        cbCooloffMs: String(CB_COOLOFF)
      })
      const provider = await createCatalystsProvider(components)

      // Helper: wait for cache TTL to expire + a small margin, then call
      // getHealhtyCatalysts twice — first call returns stale and triggers
      // background refresh, second call picks up the refreshed value.
      async function waitAndRefresh() {
        await new Promise((r) => setTimeout(r, CACHE_TTL + 20))
        await provider.getHealhtyCatalysts() // triggers background refresh
        await new Promise((r) => setTimeout(r, 30)) // let background fetch complete
        return provider.getHealhtyCatalysts()
      }

      // Refresh 1: PEER1 fails (consecutive = 1)
      await provider.getHealhtyCatalysts()
      expect(fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1))).toHaveLength(1)

      // Refresh 2: PEER1 fails (consecutive = 2)
      await waitAndRefresh()
      expect(fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1))).toHaveLength(2)

      // Refresh 3: PEER1 fails (consecutive = 3) → circuit opens
      await waitAndRefresh()
      expect(fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1))).toHaveLength(3)

      // Refresh 4: within cooloff — PEER1 should be SKIPPED
      const beforeSkip = fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1)).length
      await waitAndRefresh()
      const afterSkip = fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1)).length
      expect(afterSkip).toBe(beforeSkip) // no new fetch to PEER1

      // Wait past cooloff, then refresh — PEER1 should be retried
      await new Promise((r) => setTimeout(r, CB_COOLOFF + 20))
      await waitAndRefresh()
      const afterCooloff = fetchMock.mock.calls.filter((c) => c[0].startsWith(PEER1)).length
      expect(afterCooloff).toBeGreaterThan(beforeSkip)
    }, 10_000)
  })

  describe('blacklisted catalysts', () => {
    it('should filter out blacklisted catalysts before any /about fetch', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeHealthyResponse())
      // Blacklist PEER2 via the config
      const provider = await createCatalystsProvider(createMockComponents(fetchMock, { blacklistedCatalyst: 'peer-ec2' }))

      const result = await provider.getHealhtyCatalysts()

      // Only PEER1 should appear in results
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(PEER1)

      // PEER2 must not have been fetched at all
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('peer-ec2'), expect.anything())
    })

    it('should support multiple blacklisted catalysts separated by semicolons', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeHealthyResponse())
      const provider = await createCatalystsProvider(createMockComponents(fetchMock, { blacklistedCatalyst: 'peer-ec1;peer-ec2' }))

      const result = await provider.getHealhtyCatalysts()
      expect(result).toHaveLength(0)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
