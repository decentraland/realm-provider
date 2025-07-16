import { HandlerContextWithPath, ServiceUnavailableError, RealmInfo } from '../../types'
import { About, AboutConfigurationsMap } from '@dcl/catalyst-api-specs/lib/client'
import { filterCatalystsByVersion } from '../../logic/catalyst-filter'
import { findClosestNode } from '../../logic/geolocation'

export async function aboutMainHandler(
  context: HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider' | 'config', '/main/about'>
): Promise<{ status: 200; body: About }> {
  const {
    components: { catalystsProvider, mainRealmProvider, config }
  } = context
  const blacklistedCatalyst = ((await config.getString('BLACKLISTED_CATALYST')) || '').split(';').filter(Boolean)
  const catalysts = await catalystsProvider.getHealhtyCatalysts()

  if (catalysts.length === 0) {
    throw new ServiceUnavailableError('No content catalysts available')
  }

  const filteredCatalysts = blacklistedCatalyst.length
    ? catalysts.filter(
        (catalyst: RealmInfo) =>
          !blacklistedCatalyst.some((blackListedCatalyst) => catalyst.url.toLowerCase().includes(blackListedCatalyst))
      )
    : catalysts

  // Filter catalysts by version
  const { updatedCatalysts, outdatedCatalysts } = filterCatalystsByVersion(filteredCatalysts)

  // Use updated catalysts for selection, fallback to outdated if no updated ones available
  // This should never happen, but it is safty fallback just in case
  const catalystsToUse = updatedCatalysts.length > 0 ? updatedCatalysts : outdatedCatalysts

  // Geolocation-based selection
  // Country code is set by Cloudflare https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-ipcountry
  const countryCode = context.request.headers.get('CF-IPCountry') || ''
  let index = 0
  if (countryCode) {
    index = findClosestNode(countryCode, catalystsToUse)
  }

  const preferredCatalyst = context.url.searchParams.get('catalyst')
  if (preferredCatalyst) {
    const preferredCatalystIndex = catalystsToUse.findIndex((catalyst: RealmInfo) => catalyst.url === preferredCatalyst)
    if (preferredCatalystIndex >= 0) {
      index = preferredCatalystIndex
    }
  }

  const catalystAbout = catalystsToUse[index].about

  const mainRealmStatus = await mainRealmProvider.getStatus()

  const about: About = {
    ...catalystAbout,
    configurations: {
      ...catalystAbout.configurations,
      realmName: mainRealmStatus.realmName
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
