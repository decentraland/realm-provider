import { AppComponents } from '../types'
import { drainResponse } from '../logic/fetch-utils'
import { requireHttpUrl } from '../logic/config-validation'

/** One entry of Pulse `GET /realms`: realm names are lowercase, `main` is Genesis City. Deliberately
 * NOT `/about`: its `userCount` totals every realm (worlds and local scenes included), which would
 * silently change what `/realms` `usersCount` and `/main/about` `comms.usersCount` / `bff.userCount`
 * have always meant — Genesis City only. */
type PulseRealm = {
  name?: string
  peers?: number
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

  // requireHttpUrl, not requireString: components.ts already validates this at boot, but reading
  // it the same way here means a future edit that drops the boot check still fails loudly here,
  // naming the key, instead of reaching an unparsable URL as a per-request fetch error.
  const pulseUrl = await requireHttpUrl(config, 'PULSE_URL')

  // Pulse splits what the retired archipelago-stats status endpoint used to answer in one shot:
  // /realms carries the per-realm peer counts, /health carries liveness (200 == healthy).
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
      const [realmsResult, healthResult] = await Promise.allSettled([
        fetch.fetch(`${pulseUrl}/realms`, requestOptions),
        fetch.fetch(`${pulseUrl}/health`, requestOptions)
      ])

      if (healthResult.status === 'fulfilled') {
        await drainResponse(healthResult.value)
      }

      if (realmsResult.status === 'rejected') {
        throw realmsResult.reason
      }

      if (healthResult.status === 'rejected') {
        await drainResponse(realmsResult.value)
        throw healthResult.reason
      }

      const realmsResponse = realmsResult.value

      if (!realmsResponse.ok) {
        await drainResponse(realmsResponse)
        throw new Error(`/realms returned ${realmsResponse.status} for ${pulseUrl}`)
      }

      // A 200 whose body is not shaped like `{ realms: [...] }` (an empty body, a non-JSON error
      // page a proxy substituted, an object missing the field entirely, a `realms` that is not an
      // array) is an upstream contract break, not "zero Genesis City peers" — it must fail the
      // same way a non-200 does, not silently report a healthy realm with a stale count. A
      // well-shaped `{ realms: [] }`, or a `realms` entry missing `peers`/`name`, is NOT malformed:
      // each hop below is defaulted, so it yields 0 peers instead of a TypeError.
      const body = (await realmsResponse.json()) as unknown
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Array.isArray((body as any).realms)) {
        throw new Error(`/realms returned a body that is not { realms: [...] } for ${pulseUrl}`)
      }

      const { realms } = body as { realms: PulseRealm[] }
      const userCount = realms.find((realm) => realm?.name === realmName)?.peers ?? 0

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
