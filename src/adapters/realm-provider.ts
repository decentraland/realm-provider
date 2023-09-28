import { AppComponents, Network } from '../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
import RequestManager, { bytesToHex, ContractFactory, HTTPProvider } from 'eth-connect'
import {
  catalystAbi,
  CatalystByIdResult,
  CatalystContract,
  getCatalystServersFromDAO,
  l1Contracts
} from '@dcl/catalyst-contracts'
import { LRUCache } from 'lru-cache'

export type RealmProvider = {
  getHealhtyRealms(network: Network): Promise<About[]>
  getHealhtyCatalysts(network: Network): Promise<About[]>
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

export async function createRealmProvider({
  logs,
  fetch
}: Pick<AppComponents, 'logs' | 'fetch'>): Promise<RealmProvider> {
  const logger = logs.getLogger('realm-provider')

  const opts = { fetch: fetch.fetch }
  const mainnet = new HTTPProvider('https://rpc.decentraland.org/mainnet?project=realm-provider', opts)
  const sepolia = new HTTPProvider('https://rpc.decentraland.org/sepolia?project=realm-provider', opts)

  const mainnetContract = await createContract(l1Contracts.mainnet.catalyst, mainnet)
  const sepoliaContract = await createContract(l1Contracts.sepolia.catalyst, sepolia)

  const daoCache = new LRUCache<Network, string[]>({
    max: 12,
    ttl: 1000 * 60 * 60 * 24, // 1 day
    fetchMethod: async function (network: Network, staleValue: string[] | undefined) {
      try {
        switch (network) {
          case Network.mainnet:
            return getCatalystServersFromDAO(mainnetContract).then((servers) => servers.map((s) => s.address))
          case Network.sepolia:
            return getCatalystServersFromDAO(sepoliaContract).then((servers) => servers.map((s) => s.address))
        }
      } catch (err: any) {
        logger.error(err)
        return staleValue
      }
    }
  })

  const aboutCache = new LRUCache<string, About>({
    max: 20,
    ttl: 1000 * 60 * 60 * 2, // 2 minutes
    fetchMethod: async function (catalyst: string) {
      try {
        const response = await fetch.fetch(`${catalyst}/about`)
        return await response.json()
      } catch (err: any) {
        logger.error(err)
        // If it fails to fetch the about, we assume it's not healthy
        return undefined
      }
    }
  })

  async function getHealhtyCatalysts(network: Network): Promise<About[]> {
    const catalysts = await daoCache.fetch(network)
    if (!catalysts) {
      return []
    }
    const abouts = await Promise.all(catalysts.map((catalyst) => aboutCache.fetch(catalyst)))
    const result: About[] = []
    for (const about of abouts) {
      if (about && about.healthy && about.acceptingUsers) {
        result.push(about)
      }
    }
    return result
  }

  async function getHealhtyRealms(network: Network): Promise<About[]> {
    const catalysts = await daoCache.fetch(network)
    if (!catalysts) {
      return []
    }
    const abouts = await Promise.all(catalysts.map((catalyst) => aboutCache.fetch(catalyst)))
    const result: About[] = []
    for (const about of abouts) {
      if (about && about.comms && about.healthy && about.acceptingUsers) {
        result.push(about)
      }
    }
    return result
  }

  return {
    getHealhtyRealms,
    getHealhtyCatalysts
  }
}
