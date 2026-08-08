import { AppComponents, RealmInfo } from '../types'
import RequestManager, { bytesToHex, ContractFactory, HTTPProvider } from 'eth-connect'
import {
  catalystAbi,
  CatalystByIdResult,
  CatalystContract,
  getCatalystServersFromDAO,
  l1Contracts,
  L1Network
} from '@dcl/catalyst-contracts'
import { LRUCache } from 'lru-cache'
import { drainResponse } from '../logic/fetch-utils'

export type CatalystsProvider = {
  getHealhtyCatalysts(): Promise<RealmInfo[]>
}

// Option A: TTL for the healthy-catalysts cache (30 seconds)
const CATALYSTS_CACHE_TTL_MS = 30_000

// Option B: Circuit breaker thresholds
const CB_FAILURE_THRESHOLD = 3 // consecutive errors before opening circuit
const CB_COOLOFF_MS = 60_000 // how long to skip an open-circuit catalyst (1 minute)

type CircuitState = {
  failures: number
  openUntil: number
}

async function createContract(address: string, provider: HTTPProvider): Promise<CatalystContract> {
  const requestManager = new RequestManager(provider)
  const factory = new ContractFactory(requestManager, catalystAbi)
  const contract = (await factory.at(address)) as any
  return {
    async catalystCount(): Promise<number> {
      return contract.catalystCount()
    },
    async catalystIds(i: number): Promise<string> {
      return contract.catalystIds(i)
    },
    async catalystById(catalystId: string): Promise<CatalystByIdResult> {
      const [id, owner, domain] = await contract.catalystById(catalystId)
      return { id: '0x' + bytesToHex(id), owner, domain }
    }
  }
}

export async function createCatalystsProvider({
  logs,
  fetch,
  config
}: Pick<AppComponents, 'logs' | 'fetch' | 'config'>): Promise<CatalystsProvider> {
  const logger = logs.getLogger('realm-provider')

  const network: L1Network = ((await config.getString('ETH_NETWORK')) ?? 'mainnet') as L1Network
  const contracts = l1Contracts[network]
  if (!contracts) {
    throw new Error(`Invalid ETH_NETWORK ${network}`)
  }

  const opts = { fetch: fetch.fetch }
  const mainnet = new HTTPProvider(`https://rpc.decentraland.org/${network}?project=realm-provider`, {
    fetch: fetch.fetch
  })

  const contract = await createContract(contracts.catalyst, mainnet)

  const blacklistedCatalysts = ((await config.getString('BLACKLISTED_CATALYST')) || '').split(';').filter(Boolean)
  if (blacklistedCatalysts.length > 0) {
    logger.info(`Blacklisted catalysts: ${blacklistedCatalysts.join(', ')}`)
  }

  const daoCache = new LRUCache<number, string[]>({
    max: 12,
    ttl: 1000 * 60 * 60 * 24, // 1 day
    fetchMethod: async function (_: number, staleValue: string[] | undefined) {
      try {
        const servers = await getCatalystServersFromDAO(contract)
        return servers.map((s) => s.address)
      } catch (err: any) {
        logger.error(err)
        return staleValue
      }
    }
  })

  // Option B: Per-catalyst circuit breaker state
  const circuitBreaker = new Map<string, CircuitState>()

  function isCircuitOpen(url: string): boolean {
    const state = circuitBreaker.get(url)
    return state ? state.openUntil > Date.now() : false
  }

  function recordSuccess(url: string): void {
    circuitBreaker.delete(url)
  }

  function recordFailure(url: string): void {
    const existing = circuitBreaker.get(url)
    const state: CircuitState = existing ?? { failures: 0, openUntil: 0 }
    state.failures += 1
    if (state.failures >= CB_FAILURE_THRESHOLD) {
      state.openUntil = Date.now() + CB_COOLOFF_MS
      logger.warn(
        `Circuit breaker opened for ${url} after ${state.failures} consecutive failures — skipping for ${CB_COOLOFF_MS / 1000}s`
      )
    }
    circuitBreaker.set(url, state)
  }

  // Option A: Cache the result of the /about poll across all catalysts.
  // allowStale: true enables stale-while-revalidate — expired entries are served
  // immediately while a background refresh runs, so inbound requests never block
  // on a new catalyst poll and can't saturate the event loop.
  const catalystsCache = new LRUCache<number, RealmInfo[]>({
    max: 1,
    ttl: CATALYSTS_CACHE_TTL_MS,
    allowStale: true,
    allowStaleOnFetchRejection: true,
    fetchMethod: async function (_: number, staleValue: RealmInfo[] | undefined) {
      const catalysts = await daoCache.fetch(1)
      if (!catalysts || catalysts.length === 0) {
        logger.warn('No catalysts found in daoCache.')
        return staleValue ?? []
      }

      const allowedCatalysts =
        blacklistedCatalysts.length > 0
          ? catalysts.filter(
              (catalyst) =>
                !blacklistedCatalysts.some((blocked) => catalyst.toLowerCase().includes(blocked.toLowerCase()))
            )
          : catalysts

      const catalystsInfo = await Promise.all(
        allowedCatalysts.map(async (catalyst) => {
          // Option B: skip catalysts whose circuit is open
          if (isCircuitOpen(catalyst)) {
            logger.info(`Skipping ${catalyst} — circuit breaker open`)
            return null
          }
          try {
            logger.info(`Fetching /about from ${catalyst}`)
            const response = await opts.fetch(`${catalyst}/about`, { timeout: 1000 })
            if (!response.ok) {
              await drainResponse(response)
              logger.warn(`Failed to fetch /about from ${catalyst}: ${response.statusText}`)
              recordFailure(catalyst)
              return null
            }
            const info = await response.json()
            if (info.healthy && info.acceptingUsers) {
              recordSuccess(catalyst)
              return { about: info, url: catalyst }
            } else {
              // Application-level rejection (not accepting users) — not a network error,
              // so we do not count this as a circuit breaker failure.
              logger.info(`Catalyst ${catalyst} is not healthy or not accepting users`)
              return null
            }
          } catch (error) {
            logger.error(`Error fetching /about from ${catalyst}: ${error}`)
            recordFailure(catalyst)
            return null
          }
        })
      )

      const results = catalystsInfo.filter(Boolean) as RealmInfo[]

      // Preserve stale data when all catalysts fail (network outage or all circuits open)
      // so callers always get the last-known-good list rather than an empty array.
      if (results.length === 0 && staleValue && staleValue.length > 0) {
        logger.warn('All catalyst fetches failed or circuit-open — serving stale data')
        return staleValue
      }

      return results
    }
  })

  async function getHealhtyCatalysts(): Promise<RealmInfo[]> {
    return (await catalystsCache.fetch(1)) ?? []
  }

  return {
    getHealhtyCatalysts
  }
}
