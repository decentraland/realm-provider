import { HandlerContextWithPath } from '../../types'
import { getNetworkFromUrl } from '../utils'

export async function realmsHandler(
  context: Pick<HandlerContextWithPath<'metrics' | 'realmProvider', '/realms'>, 'url' | 'components'>
) {
  const {
    url,
    components: { realmProvider }
  } = context
  const network = getNetworkFromUrl(url)
  return {
    body: {
      servers: await realmProvider.getHealhtyRealms(network)
    }
  }
}
