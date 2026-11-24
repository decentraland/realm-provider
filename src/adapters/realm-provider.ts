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

const DEFAULT_CATALYSTS_CACHE_TTL_MS = 30_000
const DEFAULT_CB_FAILURE_THRESHOLD = 3
const DEFAULT_CB_COOLOFF_MS = 60_000

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

  const cacheTtlMs =
    parseInt((await config.getString('CATALYSTS_CACHE_TTL_MS')) || '', 10) || DEFAULT_CATALYSTS_CACHE_TTL_MS
  const cbFailureThreshold =
    parseInt((await config.getString('CB_FAILURE_THRESHOLD')) || '', 10) || DEFAULT_CB_FAILURE_THRESHOLD
  const cbCooloffMs = parseInt((await config.getString('CB_COOLOFF_MS')) || '', 10) || DEFAULT_CB_COOLOFF_MS

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
    if (state.failures >= cbFailureThreshold) {
      state.openUntil = Date.now() + cbCooloffMs
      logger.warn(
        `Circuit breaker opened for ${url} after ${state.failures} consecutive failures — skipping for ${cbCooloffMs / 1000}s`
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
    ttl: cacheTtlMs,
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

      let hadSuccessfulResponse = false

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
            // Any successful HTTP response resets the circuit breaker for this
            // catalyst, regardless of its application-level health status.
            recordSuccess(catalyst)
            hadSuccessfulResponse = true
            if (info.healthy && info.acceptingUsers) {
              return { about: info, url: catalyst }
            } else {
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

      // Only preserve stale data when ALL catalysts failed due to transport
      // errors or were skipped by an open circuit. If any catalyst responded
      // successfully (even with healthy=false / acceptingUsers=false), the
      // fresh result reflects actual application state and must replace stale data.
      if (results.length === 0 && !hadSuccessfulResponse && staleValue && staleValue.length > 0) {
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
