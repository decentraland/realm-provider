import { HandlerContextWithPath } from '../../types'

// The maximum amount of hot scenes returned
const HOT_SCENES_LIMIT = 100

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

function getCoords(coordsAsString: string): [number, number] {
  return coordsAsString.split(',').map((part) => parseInt(part, 10)) as any
}

export async function hotScenesHandler(
  context: Pick<
    HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider' | 'config' | 'content' | 'fetch', '/hot-scenes'>,
    'components' | 'url'
  >
): Promise<{ body: HotSceneInfo[] }> {
  const {
    components: { catalystsProvider, mainRealmProvider, config, fetch, content }
  } = context

  const archipelagoStatsUrl = await config.requireString('ARCHIPELAGO_STATS_URL')
  const catalysts = await catalystsProvider.getHealhtyCatalysts()
  const mainRealmStatus = await mainRealmProvider.getStatus()

  const parcelPromises = catalysts.map(async ({ url, about }) => {
    const response = await fetch.fetch(`${url}/stats/parcels`, { timeout: 1000 })
    if (!about.configurations.realmName) {
      throw new Error(`ignoring ${url} since has no realmName`)
    }

    const parcelsResponse = (await response.json()) as ParcelsResponse
    return { serverName: about.configurations.realmName, parcels: parcelsResponse.parcels }
  })

  if (mainRealmStatus.healthy) {
    parcelPromises.push(
      (async () => {
        const response = await fetch.fetch(`${archipelagoStatsUrl}/parcels`)
        const parcelsResponse = (await response.json()) as ParcelsResponse
        return { serverName: mainRealmStatus.realmName, parcels: parcelsResponse.parcels }
      })()
    )
  }

  const realmParcels = await Promise.allSettled(parcelPromises)

  type Info = {
    usersCount: number
    realms: Realm[]
  }

  const infoByParcel = new Map<string, Info>()

  for (const result of realmParcels) {
    if (result.status === 'fulfilled') {
      const { serverName, parcels } = result.value
      for (const { peersCount, parcel } of parcels) {
        const coord = `${parcel.x},${parcel.y}`
        const info = infoByParcel.get(coord) || {
          usersCount: 0,
          realms: []
        }
        info.usersCount += peersCount
        info.realms.push({
          serverName,
          usersCount: peersCount
        })
        infoByParcel.set(coord, info)
      }
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
