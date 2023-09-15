import { AppComponents } from "../types"
import {
  AboutResponse,
} from "@dcl/protocol/out-ts/decentraland/realm/about.gen"
import { createLowerCaseKeysCache } from "./lowercase-keys-cache"

export type RealmProvider = {
  getHealhtyRealms(network: string): Promise<AboutResponse[]>
}

function isDefinedAbout(about: AboutResponse | void): about is AboutResponse {
  return !!about
}

export function createRealmProvider({ catalystProvider, logs, fetch }: Pick<AppComponents, 'catalystProvider' | 'logs' | 'fetch'>): RealmProvider {
  const logger = logs.getLogger('realm-provider')

  async function getCatalystAbout(catalyst: string) {
    const response = await fetch.fetch(`${catalyst}/about`)
    return await response.json()
  }

  const aboutCache = createLowerCaseKeysCache<AboutResponse>({
    max: 10000,
    ttl: 120000, // 2 minutes
    fetchMethod: async function (catalyst: string) {
      try {
        const es = await getCatalystAbout(catalyst)
        return es
      } catch (err: any) {
        logger.error(err)
        // If it fails to fetch the about, we assume it's not healthy
        return undefined
      }
    }
  })
  return {
    async getHealhtyRealms(network: string) {
      const catalysts = await catalystProvider.getCatalysts(network)
      const abouts = await Promise.all(catalysts.map(catalyst => aboutCache.fetch(catalyst)))
      console.log(abouts)
      return abouts
        .filter(isDefinedAbout)
        .filter(about => !!about.comms && about.healthy && about.acceptingUsers)
    }
  }
}