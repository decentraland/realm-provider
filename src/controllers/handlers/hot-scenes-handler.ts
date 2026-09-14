import { IHttpServerComponent } from '@dcl/core-commons'
import type { ILoggerComponent } from '@well-known-components/interfaces'
import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { drainResponse } from '../../logic/fetch-utils'
import { requireHttpUrl } from '../../logic/config-validation'

// How long we wait for comms-gatekeeper before falling back to whatever we have cached. The
// deadline covers the whole exchange, the body read included.
const GATEKEEPER_TIMEOUT_MS = 5000

// How long a successful comms-gatekeeper answer is reused. /hot-scenes is a high-traffic,
// low-precision endpoint, so a short cache keeps the gatekeeper from being hammered.
const GATEKEEPER_CACHE_TTL_MS = 10000

// How old a cached answer may be and still be served while the gatekeeper is failing. Past this
// the list describes where users *were*, not where they are, so the upstream failure is surfaced
// instead of a plausible-looking lie.
const GATEKEEPER_STALE_MAX_AGE_MS = 60000

type Realm = {
  serverName: string
  usersCount: number
}

export type HotSceneInfo = {
  id: string
  name: string
  baseCoords: [number, number]
  parcels: [number, number][]
  usersTotalCount: number
  realms: Realm[]
  thumbnail?: string
}

export type HotScenesResponse = {
  status?: number
  headers?: Record<string, string>
  body: IHttpServerComponent.JsonBody
}

type HotScenesComponents = Pick<
  HandlerContextWithPath<'mainRealmProvider' | 'config' | 'fetch' | 'logs', '/hot-scenes'>,
  'components'
>['components']

// The last array comms-gatekeeper answered, kept so a warming or unreachable gatekeeper does not
// blank out /hot-scenes for every client.
let gatekeeperCache: { body: IHttpServerComponent.JsonBody; cachedAt: number } | undefined

// The upstream call a cache miss is currently making, shared by every request that arrives while
// it is in flight.
let inFlightGatekeeperFetch: Promise<HotScenesResponse> | undefined

/**
 * comms-gatekeeper computes /hot-scenes from its presence map and answers the fields it knows
 * about. realm-provider's own contract also carries a `realms` distribution, which clients read,
 * so the single realm the gatekeeper speaks for is added to every entry. Every gatekeeper field
 * passes through untouched. The caller has already checked that the body is an array.
 */
function withMainRealm(body: any[], serverName: string): IHttpServerComponent.JsonBody {
  return body.map((scene) =>
    scene && typeof scene === 'object' && !Array.isArray(scene)
      ? { ...scene, realms: [{ serverName, usersCount: scene.usersTotalCount ?? 0 }] }
      : scene
  )
}

/**
 * The cached array, if it is still recent enough to stand in for a live answer. Anything older is
 * dropped, so the next failure reports the failure instead of serving that list again.
 */
function serveStaleCache(logger: ILoggerComponent.ILogger): HotScenesResponse | undefined {
  if (!gatekeeperCache) {
    return undefined
  }

  const ageMs = Date.now() - gatekeeperCache.cachedAt
  if (ageMs > GATEKEEPER_STALE_MAX_AGE_MS) {
    gatekeeperCache = undefined
    return undefined
  }

  logger.warn('Serving a stale /hot-scenes list: comms-gatekeeper did not answer', { ageMs })
  return { headers: { 'X-Cache': 'stale' }, body: gatekeeperCache.body }
}

async function fetchFromGatekeeper(
  gatekeeperUrl: string,
  { fetch, mainRealmProvider, logs }: HotScenesComponents
): Promise<HotScenesResponse> {
  const logger = logs.getLogger('hot-scenes-proxy')

  // One deadline for the whole exchange. The fetch component's own `timeout` stops covering the
  // request as soon as the headers are in, so we hold the AbortController it uses and abort it
  // ourselves: that also aborts the body stream `response.json()` is reading.
  const abortController = new AbortController()
  const deadline = setTimeout(() => abortController.abort(), GATEKEEPER_TIMEOUT_MS)

  try {
    const response = await fetch.fetch(`${gatekeeperUrl}/hot-scenes`, {
      timeout: GATEKEEPER_TIMEOUT_MS,
      abortController
    })

    if (!response.ok) {
      // The gatekeeper answers 503 {"ok":false,"error":"warming"} until its presence map is
      // primed. An error body that is not JSON (a load balancer's HTML page, say) must not cost
      // the client the upstream status.
      const body = await response.json().catch(async () => {
        await drainResponse(response)
        return undefined
      })

      const stale = serveStaleCache(logger)
      if (stale) {
        return stale
      }

      return {
        status: response.status,
        body: body ?? { error: `${gatekeeperUrl}/hot-scenes answered ${response.status}` }
      }
    }

    const upstreamBody = await response.json()

    // /hot-scenes answers an array (`docs/openapi.yaml`, and every client reads it as one). A 2xx
    // that is not one is an upstream contract break, not a list to add `realms` to, cache for 10 s
    // and then serve as stale for another 50: treat it exactly like a failed upstream call.
    if (!Array.isArray(upstreamBody)) {
      logger.warn('comms-gatekeeper answered /hot-scenes with a body that is not an array', {
        status: response.status
      })

      const stale = serveStaleCache(logger)
      if (stale) {
        return stale
      }

      return {
        status: 502,
        body: { error: `${gatekeeperUrl}/hot-scenes answered ${response.status} with a body that is not an array` }
      }
    }

    const body = withMainRealm(upstreamBody, mainRealmProvider.realmName)
    gatekeeperCache = { body, cachedAt: Date.now() }
    return { body }
  } catch (err: any) {
    const stale = serveStaleCache(logger)
    if (stale) {
      return stale
    }

    // Never fall back to an empty array here: `[]` looks exactly like "nobody is online
    // anywhere", which is not what an unreachable gatekeeper means. The failure must be visible.
    throw new ServiceUnavailableError(`Could not reach ${gatekeeperUrl}/hot-scenes: ${err.message}`)
  } finally {
    clearTimeout(deadline)
  }
}

/**
 * comms-gatekeeper owns the presence map, so it computes /hot-scenes. We pass its array through,
 * adding only the `realms` distribution our own contract requires. A gatekeeper `503` (warming)
 * passes through as `503` with its body; a network error or elapsed deadline answers `503` too.
 */
async function proxyHotScenes(components: HotScenesComponents): Promise<HotScenesResponse> {
  // requireHttpUrl, not requireString: components.ts already validates this at boot, but reading
  // it the same way here means a future edit that drops the boot check still fails loudly, naming
  // the key, instead of an unparsable URL throwing per request as an opaque 500 (error-handler.ts)
  // rather than the documented 503.
  const gatekeeperUrl = await requireHttpUrl(components.config, 'COMMS_GATEKEEPER_URL')

  if (gatekeeperCache && Date.now() - gatekeeperCache.cachedAt < GATEKEEPER_CACHE_TTL_MS) {
    return { body: gatekeeperCache.body }
  }

  // Every request that arrives during a miss waits on the same upstream call, so a cache expiry
  // under load costs comms-gatekeeper one request rather than one per client.
  if (!inFlightGatekeeperFetch) {
    inFlightGatekeeperFetch = fetchFromGatekeeper(gatekeeperUrl, components).finally(() => {
      inFlightGatekeeperFetch = undefined
    })
  }

  return inFlightGatekeeperFetch
}

export async function hotScenesHandler(
  context: Pick<HandlerContextWithPath<'mainRealmProvider' | 'config' | 'fetch' | 'logs', '/hot-scenes'>, 'components'>
): Promise<HotScenesResponse> {
  return proxyHotScenes(context.components)
}
