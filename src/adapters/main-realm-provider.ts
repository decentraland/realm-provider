import { AppComponents } from '../types'

export type CoreStatus = {
  healthy: boolean
  userCount: number
}

export type ConnectorStatus = {
  version?: string
  commitHash?: string
}

export type MainRealmStatus = CoreStatus &
  ConnectorStatus & {
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

  async function fetchConnectorStatus(): Promise<ConnectorStatus> {
    const status = await fetch.fetch(`${wsConnectorUrl}/status`)
    const { version, commitHash } = await status.json()
    return { version, commitHash }
  }

  async function getStatus(): Promise<MainRealmStatus> {
    try {
      const [coreStatus, connectorStatus] = await Promise.all([fetchCoreStatus(), fetchConnectorStatus()])
      return {
        ...coreStatus,
        ...connectorStatus
      }
    } catch (err) {
      return { healthy: false, userCount: 0, adapter, realmName }
    }
  }

  return {
    getStatus
  }
}
