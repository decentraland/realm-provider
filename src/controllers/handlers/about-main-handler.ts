import { HandlerContextWithPath, ServiceUnavailableError } from '../../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'
import { getNetworkFromUrl } from '../utils'
import { randomInt } from 'crypto'

export async function aboutMainHandler(
  context: Pick<HandlerContextWithPath<'metrics' | 'realmProvider', '/main/about'>, 'components' | 'url'>
): Promise<{ status: 200; body: About }> {
  const {
    url,
    components: { realmProvider }
  } = context
  const network = getNetworkFromUrl(url)
  const catalysts = await realmProvider.getHealhtyCatalysts(network)

  if (catalysts.length === 0) {
    throw new ServiceUnavailableError('No content catalysts available')
  }

  const index = randomInt(catalysts.length)
  const catalystAbout = catalysts[index]

  const about: About = {
    ...catalystAbout,
    comms: {
      healthy: true,
      protocol: 'v3',
      // commitHash: 'cad12d2354ce966ec9eeae06400842de4e02395f',
      usersCount: 0
    }
  }

  return {
    status: 200,
    body: about
  }
}
