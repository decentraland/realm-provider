import { AppComponents } from '../types'
import { LRUCache } from 'lru-cache'

export type CoreStatus = {
  healthy: boolean
  userCount: number
}

export type MainRealmStatus = CoreStatus & {
  adapter: string
  realmName: string
}

export type MainRealmProviderComponent = {
  getStatus(): Promise<MainRealmStatus>
}

export async function createMainRealmProviderComponent({
  config,
  fetch,
  logs
}: Pick<AppComponents, 'config' | 'fetch' | 'logs'>): Promise<MainRealmProviderComponent> {
  const statsUrl = await config.requireString('ARCHIPELAGO_STATS_URL')
  const wsConnectorUrl = await config.requireString('ARCHIPELAGO_WS_CONNECTOR_URL')
  const adapter = `archipelago:archipelago:${wsConnectorUrl.replace(/^http/, 'ws')}/ws`
  const realmName = 'main'

  const logger = logs.getLogger('main-realm-status')

  const coreStatusCache = new LRUCache<number, MainRealmStatus>({
    max: 1,
    ttl: 1000 * 60 * 60 * 2, // 2 minutes
    fetchMethod: async function (_key: number, staleValue: MainRealmStatus | undefined) {
      try {
        const response = await fetch.fetch(`${statsUrl}/core-status`)
        const coreStatus: CoreStatus = await response.json()
        return { ...coreStatus, adapter, realmName }
      } catch (err: any) {
        logger.error(err)
        return staleValue
      }
    }
  })

  const wsConnectorCache = new LRUCache<number, boolean>({
    max: 1,
    ttl: 1000 * 60 * 60 * 2, // 2 minutes
    fetchMethod: async function (_key: number) {
      try {
        const status = await fetch.fetch(`${wsConnectorUrl}/status`)
        return await status.json()
      } catch (err: any) {
        logger.error(err)
        return false
      }
    }
  })

  async function getStatus(): Promise<MainRealmStatus> {
    const coreStatus = await coreStatusCache.fetch(1)
    if (!coreStatus) {
      return { healthy: false, userCount: 0, adapter, realmName }
    }

    const wsConnectorStatus = await wsConnectorCache.fetch(1)
    if (!wsConnectorStatus) {
      return { healthy: false, userCount: coreStatus.userCount, adapter, realmName }
    }
    return coreStatus
  }

  return {
    getStatus
  }
}
