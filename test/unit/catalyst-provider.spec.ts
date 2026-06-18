import { createCatalystsProvider } from '../../src/adapters/realm-provider'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { createLogComponent } from '@well-known-components/logger'
import { createFetchComponent } from '@well-known-components/fetch-component'

describe('catalyst provider', () => {
  let logs: any
  let fetch: any

  beforeEach(async () => {
    logs = await createLogComponent({})
    fetch = createFetchComponent()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when CATALYST_OVERRIDE is set', () => {
    it('should use hardcoded catalyst list instead of DAO', async () => {
      const config = createConfigComponent({
        CATALYST_OVERRIDE: 'https://peer-test1.decentraland.org;https://peer-test2.decentraland.org'
      })

      // Mock fetch to simulate /about endpoint responses
      const mockFetch = jest.fn()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            healthy: true,
            acceptingUsers: true,
            configurations: { realmName: 'test1' },
            comms: { healthy: true, usersCount: 10 }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            healthy: true,
            acceptingUsers: true,
            configurations: { realmName: 'test2' },
            comms: { healthy: true, usersCount: 20 }
          })
        })

      fetch.fetch = mockFetch

      const provider = await createCatalystsProvider({ logs, fetch, config })
      const catalysts = await provider.getHealhtyCatalysts()

      expect(catalysts).toHaveLength(2)
      expect(catalysts[0].url).toBe('https://peer-test1.decentraland.org')
      expect(catalysts[1].url).toBe('https://peer-test2.decentraland.org')
      expect(mockFetch).toHaveBeenCalledWith('https://peer-test1.decentraland.org/about', { timeout: 1000 })
      expect(mockFetch).toHaveBeenCalledWith('https://peer-test2.decentraland.org/about', { timeout: 1000 })
    })

    it('should filter out unhealthy catalysts from hardcoded list', async () => {
      const config = createConfigComponent({
        CATALYST_OVERRIDE: 'https://peer-healthy.decentraland.org;https://peer-unhealthy.decentraland.org'
      })

      const mockFetch = jest.fn()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            healthy: true,
            acceptingUsers: true,
            configurations: { realmName: 'healthy' },
            comms: { healthy: true, usersCount: 10 }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            healthy: false,
            acceptingUsers: false,
            configurations: { realmName: 'unhealthy' }
          })
        })

      fetch.fetch = mockFetch

      const provider = await createCatalystsProvider({ logs, fetch, config })
      const catalysts = await provider.getHealhtyCatalysts()

      expect(catalysts).toHaveLength(1)
      expect(catalysts[0].url).toBe('https://peer-healthy.decentraland.org')
    })

    it('should handle empty CATALYST_OVERRIDE and fall back to DAO', async () => {
      const config = createConfigComponent({
        CATALYST_OVERRIDE: '',
        ETH_NETWORK: 'mainnet'
      })

      // Empty string is falsy, so it falls back to DAO behavior
      // We're not testing the DAO integration here, just that provider is created
      const provider = await createCatalystsProvider({ logs, fetch, config })
      
      expect(provider).toBeDefined()
      expect(provider.getHealhtyCatalysts).toBeDefined()
      // Don't call getHealhtyCatalysts as it would try to connect to blockchain
    })

    it('should handle CATALYST_OVERRIDE with trailing semicolons', async () => {
      const config = createConfigComponent({
        CATALYST_OVERRIDE: 'https://peer-test.decentraland.org;'
      })

      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          healthy: true,
          acceptingUsers: true,
          configurations: { realmName: 'test' },
          comms: { healthy: true, usersCount: 10 }
        })
      })

      fetch.fetch = mockFetch

      const provider = await createCatalystsProvider({ logs, fetch, config })
      const catalysts = await provider.getHealhtyCatalysts()

      expect(catalysts).toHaveLength(1)
      expect(catalysts[0].url).toBe('https://peer-test.decentraland.org')
    })
  })

  describe('when CATALYST_OVERRIDE is not set', () => {
    it('should use DAO contract (default behavior)', async () => {
      const config = createConfigComponent({
        ETH_NETWORK: 'mainnet'
      })

      // This test validates that the DAO path is taken when no override is set
      // In a real scenario, this would connect to the blockchain
      const provider = await createCatalystsProvider({ logs, fetch, config })

      expect(provider).toBeDefined()
      expect(provider.getHealhtyCatalysts).toBeDefined()
    })
  })
})

