import { InvalidRequestError, Network } from '../types'

export function getNetworkFromUrl(url: URL): Network {
  const value = url.searchParams.get('network') ?? 'mainnet'
  const network = Network[value as keyof typeof Network]

  if (!network) {
    throw new InvalidRequestError(`Invalid network ${value}`)
  }
  return network
}
