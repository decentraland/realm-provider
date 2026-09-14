import { AppComponents } from '../types'
import { drainResponse } from '../logic/fetch-utils'

/** Pulse `GET /about`: `userCount` totals every realm (worlds and local scenes included), not just
 * Genesis City. WP6 (rev 3) accepts that scope for the main realm's `usersCount`. */
type PulseAbout = {
  userCount?: number
}

// How long we wait for Pulse before reporting the realm as unavailable. undici applies no default
// request timeout, so without a deadline a Pulse pod that accepts the connection and never answers
// would hang /about and /main/about until the client gives up. Same 5 s the /hot-scenes proxy uses.
const PULSE_TIMEOUT_MS = 5000

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
  fetch
}: Pick<AppComponents, 'config' | 'fetch'>): Promise<MainRealmProviderComponent> {
  // The comms adapter still points clients at the ws-connector, unrelated to online-player counts.
  const wsConnectorUrl = await config.requireString('ARCHIPELAGO_WS_CONNECTOR_URL')
  const adapter = `archipelago:archipelago:${wsConnectorUrl.replace(/^http/, 'ws')}/ws`
  const realmName = 'main'

  const pulseUrl = await config.requireString('PULSE_URL')

  // Pulse splits what the retired archipelago-stats status endpoint used to answer in one shot:
  // /about carries `userCount`, /health carries liveness (200 == healthy).
  async function fetchCoreStatus(): Promise<MainRealmStatus> {
    // One deadline for both reads, the body read included: the fetch component's own `timeout`
    // stops covering the request as soon as the headers are in, so we hold the AbortController
    // it uses and abort it ourselves. A timeout rejects, and the getStatus catch below turns
    // that into `{ healthy: false, userCount: 0 }` — an unreachable Pulse's answer today.
    const abortController = new AbortController()
    const requestOptions = { timeout: PULSE_TIMEOUT_MS, abortController }
    const deadline = setTimeout(() => abortController.abort(), PULSE_TIMEOUT_MS)

    try {
      // allSettled, not all: with Promise.all a leg that answers *after* its sibling rejected is
      // abandoned unread, and undici keeps that socket pinned until GC (see fetch-utils).
      const [aboutResult, healthResult] = await Promise.allSettled([
        fetch.fetch(`${pulseUrl}/about`, requestOptions),
        fetch.fetch(`${pulseUrl}/health`, requestOptions)
      ])

      if (healthResult.status === 'fulfilled') {
        await drainResponse(healthResult.value)
      }

      if (aboutResult.status === 'rejected') {
        throw aboutResult.reason
      }

      if (healthResult.status === 'rejected') {
        await drainResponse(aboutResult.value)
        throw healthResult.reason
      }

      const aboutResponse = aboutResult.value

      if (!aboutResponse.ok) {
        await drainResponse(aboutResponse)
        throw new Error(`/about returned ${aboutResponse.status} for ${pulseUrl}`)
      }

      // Defaulted: a body without `userCount` means no users — never a TypeError that would
      // degrade the realm to unhealthy.
      const about = ((await aboutResponse.json()) ?? {}) as PulseAbout
      const userCount = about.userCount ?? 0

      return { healthy: healthResult.value.status === 200, userCount, adapter, realmName }
    } finally {
      clearTimeout(deadline)
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
