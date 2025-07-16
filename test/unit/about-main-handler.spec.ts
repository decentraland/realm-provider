import { CatalystsProvider } from '../../src/adapters/realm-provider'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'
import { aboutMainHandler } from '../../src/controllers/handlers/about-main-handler'

describe('about main handler', () => {
  let mockedConfig = {
    getString: jest.fn().mockResolvedValue('')
  }

  function executeHandler(
    catalystsProvider: CatalystsProvider,
    mainRealmProvider: MainRealmProviderComponent,
    catalyst?: string
  ) {
    let url = new URL('http://localhost/main/about')
    if (catalyst) {
      url = new URL(`http://localhost/main/about?catalyst=${catalyst}`)
    }
    return aboutMainHandler({ 
      components: { catalystsProvider, mainRealmProvider, config: mockedConfig as any }, 
      url,
      request: {
        headers: {
          get: jest.fn().mockReturnValue(null)
        }
      } as any,
      params: {}
    })
  }

  describe('when requesting a realm description', () => {
    describe('and no preferred catalyst is provided', () => {
      it('should return main realm about', async () => {
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
              url: 'https://peer-ec2.decentraland.org'
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

        const { body } = await executeHandler(catalysts, mainRealmProvider)

        expect(body).toEqual({
          configurations: { 
            realmName: 'main'
          },
          healthy: true,
          acceptingUsers: true,
          comms: {
            healthy: true,
            protocol: 'v3',
            usersCount: 100,
            adapter: 'adapter',
            version: undefined,
            commitHash: undefined
          }
        })
      })
    })

    describe('and a preferred catalyst is provided', () => {
      describe('and the catalyst is a DAO catalyst', () => {
        it('should return main with preferred catalyst content', async () => {
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
                    healthy: true,
                    publicUrl: 'https://peer-ec2.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec2.decentraland.org'
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  },
                  content: {
                    healthy: true,
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

          const { body } = await executeHandler(catalysts, mainRealmProvider, 'https://peer-ec1.decentraland.org')

          expect(body).toEqual({
            configurations: { 
              realmName: 'main'
            },
            healthy: true,
            acceptingUsers: true,
            comms: {
              healthy: true,
              protocol: 'v3',
              usersCount: 100,
              adapter: 'adapter',
              version: undefined,
              commitHash: undefined
            },
            content: {
              healthy: true,
              publicUrl: 'https://peer-ec1.decentraland.org/content'
            }
          })
        })
      })

      describe('and the catalyst is not a DAO catalyst', () => {
        it('should ignore preferred catalyst', async () => {
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
                    healthy: true,
                    publicUrl: 'https://peer-ec2.decentraland.org/content'
                  }
                },
                url: 'https://peer-ec2.decentraland.org'
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'hela'
                  },
                  content: {
                    healthy: true,
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

          const { body } = await executeHandler(catalysts, mainRealmProvider, 'https://my-catalyst.decentraland.org')
          expect(body.content.publicUrl).not.toEqual('https://my-catalyst.decentraland.org')
        })
      })
    })

    describe('and blacklisted catalysts are configured', () => {
      describe('and the blacklist contains catalysts', () => {
        it('should filter out blacklisted catalysts', async () => {
          const BLACKLISTED_CATALYSTS = 'https://peer-ec1.decentraland.org'
          mockedConfig.getString.mockResolvedValue(BLACKLISTED_CATALYSTS)

          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  content: {
                    publicurl: 'https://peer-ec2.decentraland.org/content'
                  },
                  configurations: {
                    realmName: 'ec2'
                  }
                },
                url: 'https://peer-ec2.decentraland.org'
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  content: {
                    publicurl: 'https://peer-ec1.decentraland.org/content'
                  },
                  configurations: {
                    realmName: 'ec1'
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

          const { body } = await executeHandler(catalysts, mainRealmProvider, 'https://peer-ec1.decentraland.org')

          expect(body.configurations.realmName).not.toEqual('https://peer-ec1.decentraland.org')
          expect(body.content.publicUrl).not.toEqual('https://peer-ec1.decentraland.org/content')
        })
      })

      describe('and the blacklist is empty', () => {
        it('should not filter out any catalysts', async () => {
          const BLACKLISTED_CATALYSTS = ''
          mockedConfig.getString.mockResolvedValue(BLACKLISTED_CATALYSTS)

          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'ec2'
                  }
                },
                url: 'https://peer-ec2.decentraland.org'
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'ec1'
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

          const { body } = await executeHandler(catalysts, mainRealmProvider, 'https://peer-ec1.decentraland.org')

          expect(body.configurations.realmName).toEqual('main')
        })
      })

      describe('and the blacklist is undefined', () => {
        it('should not filter out any catalysts', async () => {
          mockedConfig.getString.mockResolvedValue(undefined)

          const catalysts = {
            getHealhtyCatalysts: jest.fn().mockResolvedValue([
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'ec2'
                  }
                },
                url: 'https://peer-ec2.decentraland.org'
              },
              {
                healthy: true,
                acceptingUsers: true,
                about: {
                  configurations: {
                    realmName: 'ec1'
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

          const { body } = await executeHandler(catalysts, mainRealmProvider, 'https://peer-ec1.decentraland.org')

          expect(body.configurations.realmName).toEqual('main')
        })
      })
    })
  })
})