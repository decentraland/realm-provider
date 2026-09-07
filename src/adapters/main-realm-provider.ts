import { AppComponents } from '../types'
import { drainResponse } from '../logic/fetch-utils'
import { getPresenceSource } from '../logic/presence-source'

/** One entry of Pulse `GET /realms`: realm names are lowercase, `main` is Genesis City. */
type PulseRealm = {
  name?: string
  peers?: number
}

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
  /** The MAIN realm's server name. Constant, so callers can label a response without a round trip. */
  realmName: string
  getStatus(): Promise<MainRealmStatus>
}

export async function createMainRealmProviderComponent({
  config,
  fetch,
  logs
}: Pick<AppComponents, 'config' | 'fetch' | 'logs'>): Promise<MainRealmProviderComponent> {
  // The comms adapter still points clients at the ws-connector, whatever the presence source is.
  const wsConnectorUrl = await config.requireString('ARCHIPELAGO_WS_CONNECTOR_URL')
  const adapter = `archipelago:archipelago:${wsConnectorUrl.replace(/^http/, 'ws')}/ws`
  const realmName = 'main'

  const presenceSource = await getPresenceSource(config, logs)

  let fetchCoreStatus: () => Promise<MainRealmStatus>

  if (presenceSource === 'pulse') {
    const pulseUrl = await config.requireString('PULSE_URL')

    // Pulse splits what /core-status used to answer in one shot: /realms carries the per-realm peer
    // counts, /health carries liveness (200 == healthy). We deliberately do NOT read /about: its
    // `userCount` totals every realm (worlds and local scenes included), while this realm's
    // `usersCount` has always meant Genesis City only.
    fetchCoreStatus = async function fetchPulseStatus(): Promise<MainRealmStatus> {
      const [realmsResponse, healthResponse] = await Promise.all([
        fetch.fetch(`${pulseUrl}/realms`),
        fetch.fetch(`${pulseUrl}/health`)
      ])

      await drainResponse(healthResponse)

      if (!realmsResponse.ok) {
        await drainResponse(realmsResponse)
        throw new Error(`/realms returned ${realmsResponse.status} for ${pulseUrl}`)
      }

      // Defaulted at every hop: a body without `realms`, or an entry without `peers`, means no
      // Genesis City peers — never a TypeError that would degrade the realm to unhealthy.
      const { realms = [] } = ((await realmsResponse.json()) ?? {}) as { realms?: PulseRealm[] }
      const userCount = realms.find((realm) => realm?.name === realmName)?.peers ?? 0

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
    realmName,
    getStatus
  }
}
