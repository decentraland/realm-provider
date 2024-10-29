import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
import { randomInt } from 'crypto'

export async function aboutMainHandler(
  context: Pick<
    HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider' | 'config', '/main/about'>,
    'components' | 'url'
  >
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
        (catalyst: any) =>
          !blacklistedCatalyst.some((blackListedCatalyst) => catalyst.url.toLowerCase().includes(blackListedCatalyst))
      )
    : catalysts

  let index = randomInt(filteredCatalysts.length)

  const preferredCatalyst = context.url.searchParams.get('catalyst')
  if (preferredCatalyst) {
    const preferredCatalystIndex = filteredCatalysts.findIndex((catalyst: any) => catalyst.url === preferredCatalyst)
    if (preferredCatalystIndex >= 0) {
      index = preferredCatalystIndex
    }
  }

  const catalystAbout = filteredCatalysts[index].about

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
