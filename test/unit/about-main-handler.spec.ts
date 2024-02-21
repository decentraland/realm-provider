import { CatalystsProvider } from '../../src/adapters/realm-provider'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'
import { aboutMainHandler } from '../../src/controllers/handlers/about-main-handler'

describe('about main handler unit test', () => {
  function executeHandler(
    catalystsProvider: CatalystsProvider,
    mainRealmProvider: MainRealmProviderComponent,
    catalyst?: string
  ) {
    let url = new URL('http://localhost/main/about')
    if (catalyst) {
      url = new URL(`http://localhost/main/about?catalyst=${catalyst}`)
    }
    return aboutMainHandler({ components: { catalystsProvider, mainRealmProvider }, url })
  }

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
      configurations: { realmName: 'main' },
      healthy: true,
      acceptingUsers: true,
      comms: {
        healthy: true,
        protocol: 'v3',
        usersCount: 100,
        adapter: 'adapter'
      }
    })
  })

  it('should return main with preferred catalyst if provided', async () => {
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
      configurations: { realmName: 'main' },
      healthy: true,
      acceptingUsers: true,
      comms: {
        healthy: true,
        protocol: 'v3',
        usersCount: 100,
        adapter: 'adapter'
      },
      content: {
        healthy: true,
        publicUrl: 'https://peer-ec1.decentraland.org/content'
      }
    })
  })

  it('should ignore preferred catalyst if not a DAO catalyst', async () => {
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
