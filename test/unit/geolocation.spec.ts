import { findClosestNode, getCountryCentroid, haversineDistance, getCountryForCatalystUrl } from '../../src/logic/geolocation'

describe('geolocation', () => {
  describe('when getting country centroids', () => {
    it('should return coordinates for valid country codes', () => {
      const usCoords = getCountryCentroid('US')
      expect(usCoords).toEqual([39.8283, -98.5795])

      const brCoords = getCountryCentroid('BR')
      expect(brCoords).toEqual([-14.2350, -51.9253])
    })

    it('should return undefined for invalid country codes', () => {
      const invalidCoords = getCountryCentroid('XX')
      expect(invalidCoords).toBeUndefined()
    })

    it('should handle case-insensitive country codes', () => {
      const usCoords = getCountryCentroid('us')
      expect(usCoords).toEqual([39.8283, -98.5795])
    })
  })

  describe('when getting country for catalyst URL', () => {
    it('should return country for known catalyst URLs', () => {
      const country = getCountryForCatalystUrl('peer-ec1.decentraland.org')
      expect(country).toBe('US')
    })

    it('should return country for URLs with protocol', () => {
      const country = getCountryForCatalystUrl('https://peer-ec2.decentraland.org')
      expect(country).toBe('BR')
    })

    it('should return undefined for unknown URLs', () => {
      const country = getCountryForCatalystUrl('unknown-catalyst.com')
      expect(country).toBeUndefined()
    })
  })

  describe('when calculating Haversine distance', () => {
    it('should calculate distance between two points', () => {
      const distance = haversineDistance(0, 0, 0, 1)
      expect(distance).toBeGreaterThan(0)
    })

    it('should return 0 for same point', () => {
      const distance = haversineDistance(5, 5, 5, 5)
      expect(distance).toBe(0)
    })

    it('should calculate reasonable distance between US and Brazil', () => {
      const usCoords = getCountryCentroid('US')!
      const brCoords = getCountryCentroid('BR')!
      const distance = haversineDistance(usCoords[0], usCoords[1], brCoords[0], brCoords[1])
      expect(distance).toBeGreaterThan(5000) // Should be more than 5000 km
      expect(distance).toBeLessThan(10000) // Should be less than 10000 km
    })
  })

  describe('when finding closest node', () => {
    let mockCatalysts: { url: string }[]

    beforeEach(() => {
      mockCatalysts = [
        { url: 'peer-ec1.decentraland.org' }, // US
        { url: 'peer-ec2.decentraland.org' }, // Brazil
        { url: 'peer-eu.decentraland.org' },  // Ireland
        { url: 'peer-ap1.decentraland.org' }, // Singapore
        { url: 'unknown-catalyst.com' }       // Unknown country
      ]
    })

    afterEach(() => {
      mockCatalysts = []
    })

    it('should select US node for US client', () => {
      const index = findClosestNode('US', mockCatalysts)
      expect(index).toBe(0) // US node
    })

    it('should select Brazil node for Brazil client', () => {
      const index = findClosestNode('BR', mockCatalysts)
      expect(index).toBe(1) // Brazil node
    })

    it('should select Ireland node for Ireland client', () => {
      const index = findClosestNode('IE', mockCatalysts)
      expect(index).toBe(2) // Ireland node
    })

    it('should select Singapore node for Singapore client', () => {
      const index = findClosestNode('SG', mockCatalysts)
      expect(index).toBe(3) // Singapore node
    })

    it('should return random node for unknown country', () => {
      const index = findClosestNode('XX', mockCatalysts)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(mockCatalysts.length)
    })

    it('should handle catalysts with unknown countries', () => {
      const catalystsWithUnknown = [
        { url: 'unknown-catalyst.com' }, // Unknown country
        { url: 'peer-ec1.decentraland.org' }  // US
      ]
      
      const index = findClosestNode('US', catalystsWithUnknown)
      expect(index).toBe(1) // Should select the known US node
    })

    it('should handle request with unknown country', () => {
      const index = findClosestNode('XX', mockCatalysts)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(mockCatalysts.length)
    })

    it('should handle catalysts with unknown URLs gracefully', () => {
      const catalystsWithUnknownUrls = [
        { url: 'unknown-catalyst-1.com' },
        { url: 'unknown-catalyst-2.com' },
        { url: 'unknown-catalyst-3.com' }
      ]
      
      const index = findClosestNode('US', catalystsWithUnknownUrls)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(catalystsWithUnknownUrls.length)
    })

    it('should handle empty catalysts array', () => {
      const index = findClosestNode('US', [])
      expect(index).toBe(0) // Should return 0 for empty array
    })
  })
}) 