import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
import { randomInt } from 'crypto'

const BLACKLISTED_CATALYSTS: [] = []

export async function aboutMainHandler(
  context: Pick<HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider', '/main/about'>, 'components' | 'url'>
): Promise<{ status: 200; body: About }> {
  const {
    components: { catalystsProvider, mainRealmProvider }
  } = context
  const catalysts = await catalystsProvider.getHealhtyCatalysts()

  if (catalysts.length === 0) {
    throw new ServiceUnavailableError('No content catalysts available')
  }

  const filteredCatalysts = BLACKLISTED_CATALYSTS.length
    ? catalysts.filter(
        (catalyst: any) =>
          !BLACKLISTED_CATALYSTS.some((blackListedCatalyst) => catalyst.url.toLowerCase().includes(blackListedCatalyst))
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
