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

  function makeMainRealm(healthy: boolean, userCount: number): MainRealmProviderComponent {
    return {
      getStatus: jest.fn().mockResolvedValue({ healthy, userCount, adapter: 'adapter', realmName: 'main' })
    }
  }

  function makeCatalysts() {
    return {
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
  }

  describe('when requesting available realms', () => {
    describe('and the main realm is available', () => {
      it('should return every catalyst that reports comms + main realm', async () => {
        const { body } = await executeHandler(makeCatalysts(), makeMainRealm(true, 100))

        expect(body).toHaveLength(2)
        expect(body.find((c) => c.serverName === 'main')).toEqual({
          serverName: 'main',
          url: 'https://localhost/main',
          usersCount: 100
        })
      })
    })

    describe('and the main realm is not available', () => {
      it('should return only healthy catalysts', async () => {
        const { body } = await executeHandler(makeCatalysts(), makeMainRealm(false, 100))

        expect(body).toHaveLength(1)
        expect(body.find((c) => c.serverName === 'main')).toBeFalsy()
      })
    })

    describe('and a catalyst has no comms section in its /about', () => {
      it('should leave it out, exactly as before this work package', async () => {
        // WP6 drops the *user count* read from about.comms, not the guard: which realms /realms
        // lists must not change on a deploy that only ships this code.
        const { body } = await executeHandler(makeCatalysts(), makeMainRealm(false, 0))

        expect(body.find((c) => c.serverName === 'hela')).toBeUndefined()
        expect(body.map((c) => c.serverName)).toEqual(['hera'])
      })
    })

    describe('and a catalyst still reports a comms user count', () => {
      it('should report 0 users for it, since the catalyst count is meaningless', async () => {
        const { body } = await executeHandler(makeCatalysts(), makeMainRealm(false, 0))

        expect(body.find((c) => c.serverName === 'hera')).toEqual({
          serverName: 'hera',
          url: 'http://peer-ec1.decentraland.org',
          usersCount: 0
        })
      })
    })
  })
})
