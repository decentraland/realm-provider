import { findClosestNode, getCountryCentroid, haversineDistance, getCountryForCatalystUrl } from '../../src/logic/geolocation'
import { RealmInfo } from '../../src/types'
import { About } from '@dcl/catalyst-api-specs/lib/client'

describe('geolocation', () => {
  describe('when getting country centroids', () => {
    describe('and the country code is valid', () => {
      it('should return coordinates for US', () => {
        const usCoords = getCountryCentroid('US')
        expect(usCoords).toEqual([39.8283, -98.5795])
      })

      it('should return coordinates for Brazil', () => {
        const brCoords = getCountryCentroid('BR')
        expect(brCoords).toEqual([-14.2350, -51.9253])
      })
    })

    describe('and the country code is invalid', () => {
      it('should return undefined', () => {
        const invalidCoords = getCountryCentroid('XX')
        expect(invalidCoords).toBeUndefined()
      })
    })

    describe('and the country code is case-insensitive', () => {
      it('should return coordinates for lowercase code', () => {
        const usCoords = getCountryCentroid('us')
        expect(usCoords).toEqual([39.8283, -98.5795])
      })
    })
  })

  describe('when getting country for catalyst URL', () => {
    describe('and the URL is a known catalyst', () => {
      it('should return US for peer-ec1', () => {
        const country = getCountryForCatalystUrl('peer-ec1.decentraland.org')
        expect(country).toBe('US')
      })

      it('should return Brazil for peer-ec2', () => {
        const country = getCountryForCatalystUrl('https://peer-ec2.decentraland.org')
        expect(country).toBe('BR')
      })
    })

    describe('and the URL is unknown', () => {
      it('should return undefined', () => {
        const country = getCountryForCatalystUrl('unknown-catalyst.com')
        expect(country).toBeUndefined()
      })
    })
  })

  describe('when calculating Haversine distance', () => {
    describe('and the points are different', () => {
      it('should calculate distance between two points', () => {
        const distance = haversineDistance(0, 0, 0, 1)
        expect(distance).toBeGreaterThan(0)
      })
    })

    describe('and the points are the same', () => {
      it('should return 0', () => {
        const distance = haversineDistance(5, 5, 5, 5)
        expect(distance).toBe(0)
      })
    })

    describe('and calculating real-world distances', () => {
      it('should calculate reasonable distance between US and Brazil', () => {
        const usCoords = getCountryCentroid('US')!
        const brCoords = getCountryCentroid('BR')!
        const distance = haversineDistance(usCoords[0], usCoords[1], brCoords[0], brCoords[1])
        expect(distance).toBeGreaterThan(5000) // Should be more than 5000 km
        expect(distance).toBeLessThan(10000) // Should be less than 10000 km
      })
    })
  })

  describe('when finding closest node', () => {
    let mockCatalysts: RealmInfo[]
    const mockAbout: About = { 
      configurations: { 
        realmName: 'test-realm',
        globalScenesUrn: ['urn:decentraland:entity:bafkreicnobirrtldiykfepdo5uoqjrc6ik67mfk6u25nyl74736lfxum2y'],
        networkId: 1,
        scenesUrn: ['urn:decentraland:entity:bafkreicnobirrtldiykfepdo5uoqjrc6ik67mfk6u25nyl74736lfxum2y']
      }, 
      content: { 
        version: '1.0.0',
        healthy: true,
        publicUrl: 'https://test.com',
        synchronizationStatus: 'synced'
      }, 
      lambdas: { 
        version: '1.0.0',
        healthy: true,
        publicUrl: 'https://test.com'
      },
      comms: { 
        usersCount: 0,
        healthy: true,
        protocol: 'v3'
      },
      acceptingUsers: true,
      healthy: true
    }

    beforeEach(() => {
      mockCatalysts = [
        { url: 'peer-ec1.decentraland.org', about: mockAbout }, // US
        { url: 'peer-ec2.decentraland.org', about: mockAbout }, // Brazil
        { url: 'peer-eu.decentraland.org', about: mockAbout },  // Ireland
        { url: 'peer-ap1.decentraland.org', about: mockAbout }, // Singapore
        { url: 'unknown-catalyst.com', about: mockAbout }       // Unknown country
      ]
    })

    afterEach(() => {
      mockCatalysts = []
    })

    describe('and the client is from a known country', () => {
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
    })

    describe('and the client is from a country with regional affinity', () => {
      it('should select France node for Belgium client', () => {
        // France node is at index 5 in mockCatalysts
        mockCatalysts.push({ url: 'peer.kyllian.me', about: mockAbout }) // France
        const index = findClosestNode('BE', mockCatalysts)
        expect(index).toBe(5)
      })

      it('should select Singapore node for Japan client', () => {
        const index = findClosestNode('JP', mockCatalysts)
        expect(index).toBe(3) // Singapore node
      })

      it('should select US node for Bahamas client', () => {
        const index = findClosestNode('BS', mockCatalysts)
        expect(index).toBe(0) // US node
      })

      it('should select Brazil node for Argentina client', () => {
        const index = findClosestNode('AR', mockCatalysts)
        expect(index).toBe(1) // Brazil node
      })
    })

    describe('and the client country is unknown', () => {
      it('should return random node', () => {
        const index = findClosestNode('XX', mockCatalysts)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(mockCatalysts.length)
      })
    })

    describe('and some catalysts have unknown countries', () => {
      it('should handle catalysts with unknown countries', () => {
        const catalystsWithUnknown = [
          { url: 'unknown-catalyst.com', about: mockAbout }, // Unknown country
          { url: 'peer-ec1.decentraland.org', about: mockAbout }  // US
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
          { url: 'unknown-catalyst-1.com', about: mockAbout },
          { url: 'unknown-catalyst-2.com', about: mockAbout },
          { url: 'unknown-catalyst-3.com', about: mockAbout }
        ]
        
        const index = findClosestNode('US', catalystsWithUnknownUrls)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(catalystsWithUnknownUrls.length)
      })
    })

    describe('and the catalysts array is empty', () => {
      it('should return 0', () => {
        const index = findClosestNode('US', [])
        expect(index).toBe(0) // Should return 0 for empty array
      })
    })
  })
}) 