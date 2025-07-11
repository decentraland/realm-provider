import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About, AboutConfigurationsMap } from '@dcl/catalyst-api-specs/lib/client'
import { randomInt } from 'crypto'
import { filterCatalystsByVersion } from '../../logic/catalyst-filter'

export async function aboutMainHandler(
  context: HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider' | 'config' | 'logs', '/main/about'>
): Promise<{ status: 200; body: About }> {
  const {
    components: { catalystsProvider, mainRealmProvider, config, logs }
  } = context
  const logger = logs.getLogger('main-about-handler')
  const blacklistedCatalyst = ((await config.getString('BLACKLISTED_CATALYST')) || '').split(';').filter(Boolean)
  const catalysts = await catalystsProvider.getHealhtyCatalysts()

  // Debug headers - try different ways to access them
  logger.info('=== HEADERS DEBUG ===')
  logger.info(`context keys: ${Object.keys(context).join(', ')}`)
  logger.info(`context.request: ${context.request ? 'exists' : 'null'}`)
  logger.info(`context.request type: ${typeof context.request}`)

  if (context.request) {
    logger.info(`context.request.headers: ${context.request.headers ? 'exists' : 'null'}`)
    logger.info(`context.request.headers type: ${typeof context.request.headers}`)
    logger.info(
      `context.request.headers keys: ${context.request.headers ? Object.keys(context.request.headers).join(', ') : 'null'}`
    )

    // Try to access headers as an object
    if (context.request.headers && typeof context.request.headers === 'object') {
      logger.info(`Headers as object: ${JSON.stringify(context.request.headers, null, 2)}`)
    }

    // Try to access headers as Headers object
    if (context.request.headers && typeof context.request.headers.get === 'function') {
      logger.info(`CF-IPCountry header: ${context.request.headers.get('CF-IPCountry') || 'not present'}`)
      logger.info(`User-Agent header: ${context.request.headers.get('User-Agent') || 'not present'}`)
      logger.info(`Accept header: ${context.request.headers.get('Accept') || 'not present'}`)
    }
  } else {
    logger.info('No request object found in context')
  }
  logger.info('=== END HEADERS DEBUG ===')

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
