import { COUNTRY_CENTROIDS } from './country-centroids'
import { CATALYST_NODES, CatalystNode } from './catalyst-nodes'

/**
 * Get the centroid [lat, lon] for a country code. Returns undefined if not found.
 */
export function getCountryCentroid(countryCode: string): [number, number] | undefined {
  return COUNTRY_CENTROIDS[countryCode.toUpperCase()]
}

/**
 * Calculate the Haversine distance (in km) between two lat/lon points.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  function toRad(deg: number): number {
    return (deg * Math.PI) / 180
  }
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Find the country code for a catalyst URL by matching against known nodes.
 */
export function getCountryForCatalystUrl(url: string): string | undefined {
  const normalizedUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const node = CATALYST_NODES.find((n) => n.url === normalizedUrl)
  return node?.country
}

/**
 * Given a request country code and a list of catalyst objects (each with a url),
 * return the index of the closest node.
 * If there are multiple nodes at the same minimum distance, pick one at random.
 */
export function findClosestNode(requestCountry: string, catalysts: { url: string }[]): number {
  const reqCentroid = getCountryCentroid(requestCountry)
  if (!reqCentroid) return 0 // fallback: first node

  let minDist = Infinity
  let minIndices: number[] = []
  catalysts.forEach((catalyst, idx) => {
    const country = getCountryForCatalystUrl(catalyst.url)
    if (!country) return // skip if country not found
    const nodeCentroid = getCountryCentroid(country)
    if (!nodeCentroid) return
    const dist = haversineDistance(reqCentroid[0], reqCentroid[1], nodeCentroid[0], nodeCentroid[1])
    if (dist < minDist) {
      minDist = dist
      minIndices = [idx]
    } else if (dist === minDist) {
      minIndices.push(idx)
    }
  })
  if (minIndices.length === 1) return minIndices[0]
  // Randomly select among ties
  return minIndices[Math.floor(Math.random() * minIndices.length)]
}

/**
 * Find the closest catalyst node based on request country code.
 * Returns the URL of the closest node, or undefined if no nodes are available.
 */
export function findClosestCatalystNode(requestCountry: string): string | undefined {
  if (CATALYST_NODES.length === 0) return undefined

  const reqCentroid = getCountryCentroid(requestCountry)
  if (!reqCentroid) {
    // Fallback: return first node if request country not found
    return CATALYST_NODES[0]?.url
  }

  let minDist = Infinity
  let closestNode: CatalystNode | undefined

  CATALYST_NODES.forEach((node) => {
    const nodeCentroid = getCountryCentroid(node.country)
    if (!nodeCentroid) return

    const dist = haversineDistance(reqCentroid[0], reqCentroid[1], nodeCentroid[0], nodeCentroid[1])

    if (dist < minDist) {
      minDist = dist
      closestNode = node
    }
  })

  return closestNode?.url
}

/**
 * Get all available catalyst node URLs.
 */
export function getCatalystNodeUrls(): string[] {
  return CATALYST_NODES.map((node) => node.url)
}
