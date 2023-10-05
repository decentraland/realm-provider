import { CatalystsProvider } from '../../src/adapters/realm-provider'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'
import { aboutMainHandler } from '../../src/controllers/handlers/about-main-handler'

describe('about main handler unit test', () => {
  function executeHandler(catalystsProvider: CatalystsProvider, mainRealmProvider: MainRealmProviderComponent) {
    return aboutMainHandler({ components: { catalystsProvider, mainRealmProvider } })
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
          url: 'http://peer-ec2.decentraland.org'
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
      comms: {
        healthy: true,
        protocol: 'v3',
        usersCount: 100,
        adapter: 'adapter'
      }
    })
  })
})
