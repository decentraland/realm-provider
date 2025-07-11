import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About, AboutConfigurationsMap } from '@dcl/catalyst-api-specs/lib/client'
import { randomInt } from 'crypto'
import { filterCatalystsByVersion } from '../../logic/catalyst-filter'

export async function aboutMainHandler(
  context: HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider' | 'config', '/main/about'>
): Promise<{ status: 200; body: About }> {
  const {
    components: { catalystsProvider, mainRealmProvider, config }
  } = context

  const blacklistedCatalyst = ((await config.getString('BLACKLISTED_CATALYST')) || '').split(';').filter(Boolean)
  const catalysts = await catalystsProvider.getHealhtyCatalysts()

  // Debug headers - try different ways to access them
  console.log('=== HEADERS DEBUG ===')
  console.log('context keys:', Object.keys(context))
  console.log('context.request:', context.request)
  console.log('context.request type:', typeof context.request)

  if (context.request) {
    console.log('context.request.headers:', context.request.headers)
    console.log('context.request.headers type:', typeof context.request.headers)
    console.log(
      'context.request.headers keys:',
      context.request.headers ? Object.keys(context.request.headers) : 'null'
    )

    // Try to access headers as an object
    if (context.request.headers && typeof context.request.headers === 'object') {
      console.log('Headers as object:', JSON.stringify(context.request.headers, null, 2))
    }

    // Try to access headers as Headers object
    if (context.request.headers && typeof context.request.headers.get === 'function') {
      console.log('CF-IPCountry header:', context.request.headers.get('CF-IPCountry'))
      console.log('User-Agent header:', context.request.headers.get('User-Agent'))
      console.log('Accept header:', context.request.headers.get('Accept'))
    }
  } else {
    console.log('No request object found in context')
  }
  console.log('=== END HEADERS DEBUG ===')

  if (catalysts.length === 0) {
    throw new ServiceUnavailableError('No content catalysts available')
  }

  const filteredCatalysts = blacklistedCatalyst.length
    ? catalysts.filter(
        (catalyst: any) =>
          !blacklistedCatalyst.some((blackListedCatalyst) => catalyst.url.toLowerCase().includes(blackListedCatalyst))
      )
    : catalysts

  // Filter catalysts by version
  const { updatedCatalysts, outdatedCatalysts } = filterCatalystsByVersion(filteredCatalysts)

  // Use updated catalysts for selection, fallback to outdated if no updated ones available
  const catalystsToUse = updatedCatalysts.length > 0 ? updatedCatalysts : outdatedCatalysts

  let index = randomInt(catalystsToUse.length)

  const preferredCatalyst = context.url.searchParams.get('catalyst')
  if (preferredCatalyst) {
    const preferredCatalystIndex = catalystsToUse.findIndex((catalyst: any) => catalyst.url === preferredCatalyst)
    if (preferredCatalystIndex >= 0) {
      index = preferredCatalystIndex
    }
  }

  const catalystAbout = catalystsToUse[index].about

  const mainRealmStatus = await mainRealmProvider.getStatus()

  // https://adr.decentraland.org/adr/ADR-250
  const mapConfigurations: AboutConfigurationsMap = {
    minimapEnabled: true,
    sizes: [
      { left: -150, top: 150, right: 150, bottom: -150 },
      { left: 62, top: 158, right: 162, bottom: 151 },
      { left: 151, top: 150, right: 163, bottom: 59 }
    ],
    satelliteView: {
      version: 'v1',
      baseUrl: 'https://genesis.city/map/latest',
      suffixUrl: '.jpg',
      topLeftOffset: { x: -2, y: -6 }
    },
    parcelView: {
      version: 'v1',
      imageUrl: 'https://api.decentraland.org/v1/minimap.png'
    }
  }

  const about: About = {
    ...catalystAbout,
    configurations: {
      ...catalystAbout.configurations,
      realmName: mainRealmStatus.realmName,
      map: mapConfigurations
    },
    healthy: mainRealmStatus.healthy,
    acceptingUsers: mainRealmStatus.healthy,
    comms: {
      version: mainRealmStatus.version,
      commitHash: mainRealmStatus.commitHash,
      healthy: mainRealmStatus.healthy,
      protocol: 'v3',
      usersCount: mainRealmStatus.userCount,
      adapter: mainRealmStatus.adapter
    }
  }

  if (about.bff) {
    about.bff.userCount = mainRealmStatus.userCount
  }

  return {
    status: 200,
    body: about
  }
}
