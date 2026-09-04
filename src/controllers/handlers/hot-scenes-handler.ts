import { IHttpServerComponent } from '@dcl/core-commons'
import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { drainResponse } from '../../logic/fetch-utils'
import { getPresenceSource } from '../../logic/presence-source'

// The maximum amount of hot scenes returned
const HOT_SCENES_LIMIT = 100

// How long we wait for comms-gatekeeper before falling back to whatever we have cached.
const GATEKEEPER_TIMEOUT_MS = 5000

// How long a successful comms-gatekeeper answer is reused. /hot-scenes is a high-traffic,
// low-precision endpoint, so a short cache keeps the gatekeeper from being hammered.
const GATEKEEPER_CACHE_TTL_MS = 10000

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

export type ParcelsResponse = {
  parcels: [
    {
      peersCount: number
      parcel: {
        x: number
        y: number
      }
    }
  ]
}

export type HotScenesResponse = {
  status?: number
  body: IHttpServerComponent.JsonBody
}

type HotScenesComponents = Pick<
  HandlerContextWithPath<'mainRealmProvider' | 'config' | 'content' | 'fetch', '/hot-scenes'>,
  'components'
>['components']

// The last array comms-gatekeeper answered, kept so a warming or unreachable gatekeeper does not
// blank out /hot-scenes for every client.
let gatekeeperCache: { body: IHttpServerComponent.JsonBody; cachedAt: number } | undefined

function getCoords(coordsAsString: string): [number, number] {
  return coordsAsString.split(',').map((part) => parseInt(part, 10)) as any
}

/**
 * `pulse` mode: comms-gatekeeper owns the presence map, so it computes /hot-scenes. We proxy its
 * bare array through untouched.
 */
async function proxyHotScenes({ config, fetch }: HotScenesComponents): Promise<HotScenesResponse> {
  const gatekeeperUrl = await config.requireString('COMMS_GATEKEEPER_URL')

  if (gatekeeperCache && Date.now() - gatekeeperCache.cachedAt < GATEKEEPER_CACHE_TTL_MS) {
    return { body: gatekeeperCache.body }
  }

  try {
    const response = await fetch.fetch(`${gatekeeperUrl}/hot-scenes`, { timeout: GATEKEEPER_TIMEOUT_MS })

    if (!response.ok) {
      // The gatekeeper answers 503 {"ok":false,"error":"warming"} until its presence map is primed.
      const body = await response.json()
      if (gatekeeperCache) {
        return { body: gatekeeperCache.body }
      }
      return { status: response.status, body }
    }

    const body = await response.json()
    gatekeeperCache = { body, cachedAt: Date.now() }
    return { body }
  } catch (err: any) {
    if (gatekeeperCache) {
      return { body: gatekeeperCache.body }
    }
    throw new ServiceUnavailableError(`Could not reach ${gatekeeperUrl}/hot-scenes: ${err.message}`)
  }
}

/**
 * `archipelago` mode: aggregate the main realm's per-parcel peer counts from archipelago-stats and
 * join them with the scenes occupying those parcels.
 */
async function aggregateHotScenes({
  mainRealmProvider,
  config,
  fetch,
  content
}: HotScenesComponents): Promise<HotScenesResponse> {
  const archipelagoStatsUrl = await config.requireString('ARCHIPELAGO_STATS_URL')
  const mainRealmStatus = await mainRealmProvider.getStatus()

  type Info = {
    usersCount: number
    realms: Realm[]
  }

  const infoByParcel = new Map<string, Info>()

  if (mainRealmStatus.healthy) {
    try {
      const response = await fetch.fetch(`${archipelagoStatsUrl}/parcels`)
      if (!response.ok) {
        await drainResponse(response)
        throw new Error(`/parcels returned ${response.status} for ${archipelagoStatsUrl}`)
      }

      const parcelsResponse = (await response.json()) as ParcelsResponse
      for (const { peersCount, parcel } of parcelsResponse.parcels) {
        const coord = `${parcel.x},${parcel.y}`
        const info = infoByParcel.get(coord) || {
          usersCount: 0,
          realms: []
        }
        info.usersCount += peersCount
        info.realms.push({
          serverName: mainRealmStatus.realmName,
          usersCount: peersCount
        })
        infoByParcel.set(coord, info)
      }
    } catch {
      // archipelago-stats being unavailable must not fail the endpoint: serve what we can.
    }
  }

  const scenes = await content.fetchScenes(Array.from(infoByParcel.keys()))

  const hotScenes: HotSceneInfo[] = scenes.map((scene) => {
    const result: HotSceneInfo = {
      id: scene.id,
      name: scene.metadata?.display?.title,
      baseCoords: getCoords(scene.metadata?.scene.base),
      usersTotalCount: 0,
      realms: [],
      parcels: scene.metadata?.scene.parcels.map(getCoords),
      thumbnail: content.calculateThumbnail(scene)
    }

    const countByRealm = new Map<string, number>()

    for (const parcel of scene.metadata?.scene.parcels) {
      const info = infoByParcel.get(parcel)
      if (!info) {
        continue
      }

      for (const { serverName, usersCount } of info.realms) {
        const count = countByRealm.get(serverName) || 0
        countByRealm.set(serverName, count + usersCount)
      }
    }

    for (const [serverName, usersCount] of countByRealm) {
      result.usersTotalCount += usersCount
      result.realms.push({ serverName, usersCount })
    }

    return result
  })

  return {
    body: hotScenes.sort((scene1, scene2) => scene2.usersTotalCount - scene1.usersTotalCount).slice(0, HOT_SCENES_LIMIT)
  }
}

export async function hotScenesHandler(
  context: Pick<
    HandlerContextWithPath<'mainRealmProvider' | 'config' | 'content' | 'fetch', '/hot-scenes'>,
    'components'
  >
): Promise<HotScenesResponse> {
  const { components } = context
  const presenceSource = await getPresenceSource(components.config)

  return presenceSource === 'pulse' ? proxyHotScenes(components) : aggregateHotScenes(components)
}
