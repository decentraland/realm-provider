import { AppComponents } from '../types'

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
  fetch
}: Pick<AppComponents, 'config' | 'fetch' | 'logs'>): Promise<MainRealmProviderComponent> {
  const statsUrl = await config.requireString('ARCHIPELAGO_STATS_URL')
  const wsConnectorUrl = await config.requireString('ARCHIPELAGO_WS_CONNECTOR_URL')
  const adapter = `archipelago:archipelago:${wsConnectorUrl.replace(/^http/, 'ws')}/ws`
  const realmName = 'main'

  async function fetchCoreStatus(): Promise<MainRealmStatus> {
    const response = await fetch.fetch(`${statsUrl}/core-status`)
    const coreStatus: CoreStatus = await response.json()
    return { ...coreStatus, adapter, realmName }
  }

  async function fetchConnectorStatus(): Promise<void> {
    const status = await fetch.fetch(`${wsConnectorUrl}/status`)
    await status.json()
  }

  async function getStatus(): Promise<MainRealmStatus> {
    try {
      const [coreStatus, _connectorStatus] = await Promise.all([fetchCoreStatus(), fetchConnectorStatus])
      return coreStatus
    } catch (err) {
      return { healthy: false, userCount: 0, adapter, realmName }
    }
  }

  return {
    getStatus
  }
}
