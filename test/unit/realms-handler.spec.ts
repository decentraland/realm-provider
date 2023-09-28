import { RealmProvider } from '../../src/adapters/realm-provider'
import { realmsHandler } from '../../src/controllers/handlers/realms-handler'
import querystring from 'node:querystring'
import { Network } from '../../src/types'

describe('events handler unit test', () => {
  function executeHandler(realmProvider: RealmProvider, qs: any) {
    const url = new URL(`http://localhost/realms?${querystring.stringify(qs)}`)
    return realmsHandler({ components: { realmProvider }, url })
  }

  it('should use mainnet if network is not provided', async () => {
    const realms = {
      getHealhtyRealms: jest.fn(),
      getHealhtyCatalysts: jest.fn()
    }

    await executeHandler(realms, {})

    expect(realms.getHealhtyRealms).toHaveBeenCalledWith(Network.mainnet)
  })

  it('should use network if provided', async () => {
    const realms = {
      getHealhtyRealms: jest.fn(),
      getHealhtyCatalysts: jest.fn()
    }

    await executeHandler(realms, { network: 'sepolia' })

    expect(realms.getHealhtyRealms).toHaveBeenCalledWith(Network.sepolia)
  })
})
