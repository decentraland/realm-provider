import { AppComponents } from '../types'
import { drainResponse } from '../logic/fetch-utils'
import { getPresenceSource } from '../logic/presence-source'

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
  // The comms adapter still points clients at the ws-connector, whatever the presence source is.
  const wsConnectorUrl = await config.requireString('ARCHIPELAGO_WS_CONNECTOR_URL')
  const adapter = `archipelago:archipelago:${wsConnectorUrl.replace(/^http/, 'ws')}/ws`
  const realmName = 'main'

  const presenceSource = await getPresenceSource(config)

  let fetchCoreStatus: () => Promise<MainRealmStatus>

  if (presenceSource === 'pulse') {
    const pulseUrl = await config.requireString('PULSE_URL')

    // Pulse splits what /core-status used to answer in one shot: /about carries the user count,
    // /health carries liveness (200 == healthy).
    fetchCoreStatus = async function fetchPulseStatus(): Promise<MainRealmStatus> {
      const [aboutResponse, healthResponse] = await Promise.all([
        fetch.fetch(`${pulseUrl}/about`),
        fetch.fetch(`${pulseUrl}/health`)
      ])

      await drainResponse(healthResponse)

      if (!aboutResponse.ok) {
        await drainResponse(aboutResponse)
        throw new Error(`/about returned ${aboutResponse.status} for ${pulseUrl}`)
      }

      const { userCount } = await aboutResponse.json()
      return { healthy: healthResponse.status === 200, userCount, adapter, realmName }
    }
  } else {
    const statsUrl = await config.requireString('ARCHIPELAGO_STATS_URL')

    fetchCoreStatus = async function fetchArchipelagoStatus(): Promise<MainRealmStatus> {
      const response = await fetch.fetch(`${statsUrl}/core-status`)
      const coreStatus: CoreStatus = await response.json()
      return { ...coreStatus, adapter, realmName }
    }
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
