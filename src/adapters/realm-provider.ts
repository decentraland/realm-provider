import { AppComponents } from '../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
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

export type RealmInfo = {
  about: About
  url: string
}

export type CatalystsProvider = {
  getHealhtyCatalysts(): Promise<RealmInfo[]>
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
  const mainnet = new HTTPProvider(`https://rpc.decentraland.org/${network}?project=realm-provider`, opts)

  const contract = await createContract(contracts.catalyst, mainnet)

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

  async function getHealhtyCatalysts(): Promise<RealmInfo[]> {
    const catalysts = await daoCache.fetch(1)
    if (!catalysts || catalysts.length === 0) {
      console.warn('No catalysts found in daoCache.')
      return []
    }

    const catalystsInfo = await Promise.all(
      catalysts.map(async (catalyst) => {
        try {
          logger.info(`Fetching /about from ${catalyst}`)
          const response = await opts.fetch(`${catalyst}/about`, { timeout: 1000 })
          if (!response.ok) {
            logger.warn(`Failed to fetch /about from ${catalyst}: ${response.statusText}`)
            return null
          }
          
          // Log all headers from the response
          const headers: Record<string, string> = {}
          response.headers.forEach((value, key) => {
            headers[key] = value
          })          
          
          const info = await response.json()
          if (info.healthy && info.acceptingUsers) {
            return { about: info, url: catalyst }
          } else {
            logger.info(`Catalyst ${catalyst} is not healthy or not accepting users`)
            return null
          }
        } catch (error) {
          logger.error(`Error fetching /about from ${catalyst}: ${error}`)
          return null
        }
      })
    )
    // Filter out any null values (unhealthy or failed fetches) and return
    return catalystsInfo.filter(Boolean) as RealmInfo[]
  }

  return {
    getHealhtyCatalysts
  }
}
