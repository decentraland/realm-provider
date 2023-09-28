import { realmsHandler } from '../../src/controllers/handlers/realms-handler'
import querystring from 'node:querystring'
import { Network } from '../../src/types'
import { CatalystsProvider } from '../../src/adapters/realm-provider'

describe('events handler unit test', () => {
  function executeHandler(catalystsProvider: CatalystsProvider, qs: any) {
    const url = new URL(`http://localhost/realms?${querystring.stringify(qs)}`)
    return realmsHandler({ components: { catalystsProvider }, url })
  }

  it('should use mainnet if network is not provided', async () => {
    const catalysts = {
      getHealhtyRealms: jest.fn(),
      getHealhtyCatalysts: jest.fn()
    }

    await executeHandler(catalysts, {})

    expect(catalysts.getHealhtyRealms).toHaveBeenCalledWith(Network.mainnet)
  })

  it('should use network if provided', async () => {
    const catalysts = {
      getHealhtyRealms: jest.fn(),
      getHealhtyCatalysts: jest.fn()
    }

    await executeHandler(catalysts, { network: 'sepolia' })

    expect(catalysts.getHealhtyRealms).toHaveBeenCalledWith(Network.sepolia)
  })
})
