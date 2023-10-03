import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
import { randomInt } from 'crypto'

export async function aboutMainHandler(
  context: Pick<
    HandlerContextWithPath<'metrics' | 'catalystsProvider' | 'mainRealmProvider', '/main/about'>,
    'components'
  >
): Promise<{ status: 200; body: About }> {
  const {
    components: { catalystsProvider, mainRealmProvider }
  } = context
  const catalysts = await catalystsProvider.getHealhtyCatalysts()

  if (catalysts.length === 0) {
    throw new ServiceUnavailableError('No content catalysts available')
  }

  const index = randomInt(catalysts.length)
  const catalystAbout = catalysts[index].about

  const mainRealmStatus = await mainRealmProvider.getStatus()

  const about: About = {
    ...catalystAbout,
    configurations: {
      ...catalystAbout.configurations,
      realmName: mainRealmStatus.realmName
    },
    healthy: mainRealmStatus.healthy,
    comms: {
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
