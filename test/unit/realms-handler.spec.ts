import { realmsHandler } from '../../src/controllers/handlers/realms-handler'
import { CatalystsProvider } from '../../src/adapters/realm-provider'
import { createConfigComponent } from '@well-known-components/env-config-provider'
import { MainRealmProviderComponent } from '../../src/adapters/main-realm-provider'

describe('realms handler', () => {
  function executeHandler(catalystsProvider: CatalystsProvider, mainRealmProvider: MainRealmProviderComponent) {
    const config = createConfigComponent({})
    const url = new URL(`https://localhost/realms`)
    return realmsHandler({ components: { catalystsProvider, config, mainRealmProvider }, url })
  }

  describe('when the main realm is available', () => {
    it('should return healthy catalyst + main realm', async () => {
      const catalysts = {
        getHealhtyCatalysts: jest.fn().mockResolvedValue([
          {
            healthy: true,
            acceptingUsers: true,
            about: {
              configurations: {
                realmName: 'hera'
              },
              comms: {
                healthy: true,
                usersCount: 10
              }
            },
            url: 'http://peer-ec1.decentraland.org'
          },
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
      expect(body).toHaveLength(2)

      const hera = body.find((c) => c.serverName === 'hera')
      const main = body.find((c) => c.serverName === 'main')

      expect(hera).toEqual({
        serverName: 'hera',
        url: 'http://peer-ec1.decentraland.org',
        usersCount: 10
      })
      expect(main).toEqual({
        serverName: 'main',
        url: 'https://localhost/main',
        usersCount: 100
      })
    })
  })

  describe('when the main realm is not available', () => {
    it('should return only healthy catalysts', async () => {
      const catalysts = {
        getHealhtyCatalysts: jest.fn().mockResolvedValue([
          {
            healthy: true,
            acceptingUsers: true,
            about: {
              configurations: {
                realmName: 'hera'
              },
              comms: {
                healthy: true,
                usersCount: 10
              }
            },
            url: 'http://peer-ec1.decentraland.org'
          },
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
          healthy: false,
          userCount: 100,
          adapter: 'adapter',
          realmName: 'main'
        })
      }

      const { body } = await executeHandler(catalysts, mainRealmProvider)
      expect(body).toHaveLength(1)

      const hera = body.find((c) => c.serverName === 'hera')
      const main = body.find((c) => c.serverName === 'main')

      expect(hera).toEqual({
        serverName: 'hera',
        url: 'http://peer-ec1.decentraland.org',
        usersCount: 10
      })
      expect(main).toBeFalsy()
    })
  })
})
