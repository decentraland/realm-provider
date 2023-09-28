import { HandlerContextWithPath } from '../../types'
import { getNetworkFromUrl } from '../utils'

export async function realmsHandler(
  context: Pick<HandlerContextWithPath<'catalystsProvider', '/realms'>, 'url' | 'components'>
) {
  const {
    url,
    components: { catalystsProvider }
  } = context
  const network = getNetworkFromUrl(url)

  // TODO: add main realm here?
  return {
    body: {
      servers: await catalystsProvider.getHealhtyRealms(network)
    }
  }
}
