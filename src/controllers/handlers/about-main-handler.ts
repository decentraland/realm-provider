import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
import { getNetworkFromUrl } from '../utils'
import { randomInt } from 'crypto'

export async function aboutMainHandler(
  context: Pick<
    HandlerContextWithPath<'metrics' | 'catalystsProvider' | 'mainRealmProvider', '/main/about'>,
    'components' | 'url'
  >
): Promise<{ status: 200; body: About }> {
  const {
    url,
    components: { catalystsProvider, mainRealmProvider }
  } = context
  const network = getNetworkFromUrl(url)
  const catalysts = await catalystsProvider.getHealhtyCatalysts(network)

  if (catalysts.length === 0) {
    throw new ServiceUnavailableError('No content catalysts available')
  }

  const index = randomInt(catalysts.length)
  const catalystAbout = catalysts[index]

  const mainRealmStatus = await mainRealmProvider.getStatus()

  const about: About = {
    ...catalystAbout,
    healthy: mainRealmStatus.healthy,
    comms: {
      healthy: mainRealmStatus.healthy,
      protocol: 'v3',
      usersCount: mainRealmStatus.userCount,
      adapter: mainRealmStatus.adapter
    }
  }

  return {
    status: 200,
    body: about
  }
}
