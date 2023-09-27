import { HandlerContextWithPath, InvalidRequestError, Network } from '../../types'

export async function realmsHandler(
  context: Pick<HandlerContextWithPath<'metrics' | 'realmProvider', '/realms'>, 'url' | 'components'>
) {
  const {
    url,
    components: { realmProvider }
  } = context
  const value = url.searchParams.get('network') ?? 'mainnet'
  const network = Network[value as keyof typeof Network]

  if (!network) {
    throw new InvalidRequestError(`Invalid network ${value}`)
  }

  return {
    body: {
      servers: await realmProvider.getHealhtyRealms(network)
    }
  }
}
