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

function createMockComponents(fetchImpl: jest.Mock, blacklistedCatalyst?: string) {
  return {
    logs: { getLogger: jest.fn().mockReturnValue(createMockLogger()) } as any,
    fetch: { fetch: fetchImpl } as any,
    config: {
      getString: jest.fn().mockImplementation((key: string) => {
        if (key === 'ETH_NETWORK') return Promise.resolve('mainnet')
        if (key === 'BLACKLISTED_CATALYST') return Promise.resolve(blacklistedCatalyst ?? undefined)
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
  })

  describe('blacklisted catalysts', () => {
    it('should filter out blacklisted catalysts before any /about fetch', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeHealthyResponse())
      // Blacklist PEER2 via the config
      const provider = await createCatalystsProvider(createMockComponents(fetchMock, 'peer-ec2'))

      const result = await provider.getHealhtyCatalysts()

      // Only PEER1 should appear in results
      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(PEER1)

      // PEER2 must not have been fetched at all
      expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('peer-ec2'), expect.anything())
    })

    it('should support multiple blacklisted catalysts separated by semicolons', async () => {
      const fetchMock = jest.fn().mockResolvedValue(makeHealthyResponse())
      const provider = await createCatalystsProvider(createMockComponents(fetchMock, 'peer-ec1;peer-ec2'))

      const result = await provider.getHealhtyCatalysts()
      expect(result).toHaveLength(0)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
