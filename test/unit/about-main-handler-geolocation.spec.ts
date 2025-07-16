import { CatalystsProvider } from '../../src/adapters/realm-provider'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'
import { aboutMainHandler } from '../../src/controllers/handlers/about-main-handler'

describe('about main handler geolocation integration', () => {
  let mockedConfig = {
    getString: jest.fn().mockResolvedValue('')
  } //BLACKLISTED CATALYST 

  function executeHandler(
    catalystsProvider: CatalystsProvider,
    mainRealmProvider: MainRealmProviderComponent,
    cfIpCountry?: string,
    catalyst?: string
  ) {
    let url = new URL('http://localhost/main/about')
    if (catalyst) {
      url = new URL(`http://localhost/main/about?catalyst=${catalyst}`)
    }
    
    const mockRequest = {
      headers: {
        get: jest.fn().mockReturnValue(cfIpCountry || null)
      }
    } as any

    return aboutMainHandler({ 
      components: { catalystsProvider, mainRealmProvider, config: mockedConfig as any }, 
      url,
      request: mockRequest,
      params: {}
    })
  }

  describe('when requesting a realm description', () => {
    describe('and CF-IPCountry header is present', () => {
      describe('and the client is from US', () => {
        it('should use geolocation-based selection for US client', async () => {
          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  },
                  content: {
                    publicUrl: 'https://peer-ec1.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec1.decentraland.org' // US node
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hera'
                  },
                  content: {
                    publicUrl: 'https://peer-ec2.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec2.decentraland.org' // Brazil node
              }
            ])
          }

          const mainRealmProvider = {
            getStatus: jest.fn().mockResolvedValue({
              healthy: true,
              userCount: 100,
              adapter: 'archipelago:archipelago:wss://archipelago-ws-connector.decentraland.zone/ws',
              realmName: 'main'
            })
          }

          const result = await executeHandler(catalysts, mainRealmProvider, 'US')

          expect(catalysts.getHealhtyCatalysts).toHaveBeenCalled()
          expect(mainRealmProvider.getStatus).toHaveBeenCalled()
          expect(result.status).toBe(200)
          // Verify that the US node was selected by checking the content publicUrl
          expect(result.body.content.publicUrl).toBe('https://peer-ec1.decentraland.org/content')
        })
      })

      describe('and the client is from Brazil', () => {
        it('should use geolocation-based selection for Brazil client', async () => {
          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  },
                  content: {
                    publicUrl: 'https://peer-ec1.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec1.decentraland.org' // US node
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hera'
                  },
                  content: {
                    publicUrl: 'https://peer-ec2.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec2.decentraland.org' // Brazil node
              }
            ])
          }

          const mainRealmProvider = {
            getStatus: jest.fn().mockResolvedValue({
              healthy: true,
              userCount: 100,
              adapter: 'adapter',
              realmName: 'main'
            })
          }

          const result = await executeHandler(catalysts, mainRealmProvider, 'BR')

          expect(catalysts.getHealhtyCatalysts).toHaveBeenCalled()
          expect(mainRealmProvider.getStatus).toHaveBeenCalled()
          expect(result.status).toBe(200)
          // Verify that the Brazil node was selected by checking the content publicUrl
          expect(result.body.content.publicUrl).toBe('https://peer-ec2.decentraland.org/content')
        })
      })
    })

    describe('and CF-IPCountry header is not present', () => {
      it('should handle request without CF-IPCountry header and return main realm about', async () => {
        const catalysts = {
          getHealhtyCatalysts: jest.fn().mockResolvedValue([
            {
              healthy: true,
              acceptingUsers: true,
              about: {
                configurations: {
                  realmName: 'hela'
                }
              },
              url: 'https://peer-ec1.decentraland.org'
            }
          ])
        }

        const mainRealmProvider = {
          getStatus: jest.fn().mockResolvedValue({
            healthy: true,
            userCount: 100,
            adapter: 'adapter',
            realmName: 'main'
          })
        }

        const result = await executeHandler(catalysts, mainRealmProvider)

        expect(catalysts.getHealhtyCatalysts).toHaveBeenCalled()
        expect(mainRealmProvider.getStatus).toHaveBeenCalled()
        expect(result.status).toBe(200)
      })
    })

    describe('and a preferred catalyst is provided', () => {
      describe('and the preferred catalyst is found', () => {
        it('should use preferred catalyst if found', async () => {
          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  }
                },
                url: 'https://peer-ec1.decentraland.org'
              }
            ])
          }

          const mainRealmProvider = {
            getStatus: jest.fn().mockResolvedValue({
              healthy: true,
              userCount: 100,
              adapter: 'adapter',
              realmName: 'main'
            })
          }

          const result = await executeHandler(catalysts, mainRealmProvider, 'US', 'https://peer-ec1.decentraland.org')

          expect(catalysts.getHealhtyCatalysts).toHaveBeenCalled()
          expect(mainRealmProvider.getStatus).toHaveBeenCalled()
          expect(result.status).toBe(200)
        })
      })

      describe('and the preferred catalyst is not found', () => {
        it('should fall back to geolocation if preferred catalyst not found', async () => {
          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  },
                  content: {
                    publicUrl: 'https://peer-ec1.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec1.decentraland.org'
              }
            ])
          }

          const mainRealmProvider = {
            getStatus: jest.fn().mockResolvedValue({
              healthy: true,
              userCount: 100,
              adapter: 'adapter',
              realmName: 'main'
            })
          }

          const result = await executeHandler(catalysts, mainRealmProvider, 'US', 'https://unknown-catalyst.com')
          // Verify that the US node was selected by checking the content publicUrl
          expect(result.body.content.publicUrl).toBe('https://peer-ec1.decentraland.org/content')
          expect(catalysts.getHealhtyCatalysts).toHaveBeenCalled()
          expect(mainRealmProvider.getStatus).toHaveBeenCalled()
          expect(result.status).toBe(200)
        })
      })

      describe('and catalysts have unknown URLs', () => {
        it('should handle catalysts with unknown URLs gracefully and return main realm about', async () => {
          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  }
                },
                url: 'https://unknown-catalyst-1.com'
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hera'
                  }
                },
                url: 'https://unknown-catalyst-2.com'
              }
            ])
          }

          const mainRealmProvider = {
            getStatus: jest.fn().mockResolvedValue({
              healthy: true,
              userCount: 100,
              adapter: 'adapter',
              realmName: 'main'
            })
          }

          const result = await executeHandler(catalysts, mainRealmProvider, 'US')

          expect(catalysts.getHealhtyCatalysts).toHaveBeenCalled()
          expect(mainRealmProvider.getStatus).toHaveBeenCalled()
          expect(result.status).toBe(200)
        })
      })
    })
  })
}) 