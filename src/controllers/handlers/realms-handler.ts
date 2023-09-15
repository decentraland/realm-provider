import { HandlerContextWithPath } from '../../types'

// handlers arguments only type what they need, to make unit testing easier
export async function realmsHandler(
  context: Pick<HandlerContextWithPath<'metrics' | 'realmProvider', '/realms'>, 'url' | 'components'>
) {
  const {
    url,
    components: { realmProvider }
  } = context
  try {
    const network = url.searchParams.get('network') ?? 'mainnet'
    return {
      body: {
        servers: await realmProvider.getHealhtyRealms(network)
      }
    }
  } catch (error) {
    console.error(error)
    return {
      status: 500,
      body: {
        error: 'Internal Server Error'
      }
    }
  }
}
