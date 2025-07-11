import { compareVersions, filterCatalystsByVersion } from '../../src/logic/catalyst-filter'

describe('catalyst-filter', () => {
  describe('when comparing semantic versions', () => {
    it('should return 0 when versions are equal', () => {
      const result = compareVersions('1.0.0', '1.0.0')
      expect(result).toBe(0)
    })

    it('should return 1 when first version is greater', () => {
      const result = compareVersions('1.0.1', '1.0.0')
      expect(result).toBe(1)
    })

    it('should return -1 when first version is less', () => {
      const result = compareVersions('1.0.0', '1.0.1')
      expect(result).toBe(-1)
    })

    it('should handle major version differences', () => {
      const result = compareVersions('2.0.0', '1.9.9')
      expect(result).toBe(1)
    })

    it('should handle different version formats', () => {
      const result = compareVersions('6.19.7', '6.19.7')
      expect(result).toBe(0)
    })

    it('should handle version format differences', () => {
      const result = compareVersions('4.0.0', '3.14.1')
      expect(result).toBe(1)
    })

    it('should handle missing version parts', () => {
      const result = compareVersions('1.0', '1.0.0')
      expect(result).toBe(0)
    })

    it('should handle single digit versions', () => {
      const result = compareVersions('1', '1.0.0')
      expect(result).toBe(0)
    })
  })

  describe('when filtering catalysts by version', () => {
    it('should return empty arrays when input is empty', () => {
      const result = filterCatalystsByVersion([])
      expect(result.updatedCatalysts).toEqual([])
    })

    it('should return empty outdated array when input is empty', () => {
      const result = filterCatalystsByVersion([])
      expect(result.outdatedCatalysts).toEqual([])
    })

    describe('and all catalysts have the same versions', () => {
      let catalysts: any[]
      let result: { updatedCatalysts: any[], outdatedCatalysts: any[] }

      beforeEach(() => {
        catalysts = [
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            }
          },
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            }
          }
        ]
        result = filterCatalystsByVersion(catalysts)
      })

      afterEach(() => {
        catalysts = []
        result = { updatedCatalysts: [], outdatedCatalysts: [] }
      })

      it('should return all catalysts as updated', () => {
        expect(result.updatedCatalysts).toEqual(catalysts)
      })

      it('should return empty outdated array', () => {
        expect(result.outdatedCatalysts).toEqual([])
      })
    })

    describe('and catalysts have different versions', () => {
      let catalysts: any[]
      let result: { updatedCatalysts: any[], outdatedCatalysts: any[] }

      beforeEach(() => {
        catalysts = [
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            }
          },
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '3.14.1' }
            }
          },
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            }
          }
        ]
        result = filterCatalystsByVersion(catalysts)
      })

      afterEach(() => {
        catalysts = []
        result = { updatedCatalysts: [], outdatedCatalysts: [] }
      })

      it('should return correct number of updated catalysts', () => {
        expect(result.updatedCatalysts).toHaveLength(2)
      })

      it('should return correct number of outdated catalysts', () => {
        expect(result.outdatedCatalysts).toHaveLength(1)
      })

      it('should put catalysts with highest versions in updated array', () => {
        expect(result.updatedCatalysts[0].about.lambdas.version).toBe('4.0.0')
      })

      it('should put catalysts with lower versions in outdated array', () => {
        expect(result.outdatedCatalysts[0].about.lambdas.version).toBe('3.14.1')
      })
    })

    describe('and some catalysts have missing version properties', () => {
      let catalysts: any[]
      let result: { updatedCatalysts: any[], outdatedCatalysts: any[] }

      beforeEach(() => {
        catalysts = [
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            }
          },
          {
            about: {
              content: { version: '6.19.7' }
              // missing lambdas version
            }
          }
        ]
        result = filterCatalystsByVersion(catalysts)
      })

      afterEach(() => {
        catalysts = []
        result = { updatedCatalysts: [], outdatedCatalysts: [] }
      })

      it('should handle missing lambdas version', () => {
        expect(result.updatedCatalysts).toHaveLength(1)
      })

      it('should put catalysts with missing versions in outdated array', () => {
        expect(result.outdatedCatalysts).toHaveLength(1)
      })

      it('should treat missing versions as outdated', () => {
        expect(result.outdatedCatalysts[0].about.lambdas).toBeUndefined()
      })
    })

    describe('and some catalysts have missing about property', () => {
      let catalysts: any[]
      let result: { updatedCatalysts: any[], outdatedCatalysts: any[] }

      beforeEach(() => {
        catalysts = [
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            }
          },
          {
            // missing about property
          }
        ]
        result = filterCatalystsByVersion(catalysts)
      })

      afterEach(() => {
        catalysts = []
        result = { updatedCatalysts: [], outdatedCatalysts: [] }
      })

      it('should handle missing about property', () => {
        expect(result.updatedCatalysts).toHaveLength(1)
      })

      it('should put catalysts with missing about in outdated array', () => {
        expect(result.outdatedCatalysts).toHaveLength(1)
      })
    })

    describe('and using real-world catalyst data structure', () => {
      let catalysts: any[]
      let result: { updatedCatalysts: any[], outdatedCatalysts: any[] }

      beforeEach(() => {
        catalysts = [
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '4.0.0' }
            },
            url: 'https://peer.decentral.io'
          },
          {
            about: {
              content: { version: '6.19.7' },
              lambdas: { version: '3.14.1' }
            },
            url: 'https://interconnected.online'
          }
        ]
        result = filterCatalystsByVersion(catalysts)
      })

      afterEach(() => {
        catalysts = []
        result = { updatedCatalysts: [], outdatedCatalysts: [] }
      })

      it('should correctly identify updated catalysts', () => {
        expect(result.updatedCatalysts).toHaveLength(1)
      })

      it('should correctly identify outdated catalysts', () => {
        expect(result.outdatedCatalysts).toHaveLength(1)
      })

      it('should preserve catalyst URLs in updated array', () => {
        expect(result.updatedCatalysts[0].url).toBe('https://peer.decentral.io')
      })

      it('should preserve catalyst URLs in outdated array', () => {
        expect(result.outdatedCatalysts[0].url).toBe('https://interconnected.online')
      })
    })
  })
}) 