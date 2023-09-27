import { RealmProvider } from '../../src/adapters/realm-provider'
import { realmsHandler } from '../../src/controllers/handlers/realms-handler'
import querystring from 'node:querystring'

describe('events handler unit test', () => {
  function executeHandler(realmProvider: RealmProvider, qs: any) {
    const url = new URL(`http://localhost/realms?${querystring.stringify(qs)}`)
    return realmsHandler({ components: { realmProvider }, url })
  }

  it('should register and unregister the client', async () => {
    await executeHandler(eventsDispatcher)

    expect(eventsDispatcher.addClient).toHaveBeenCalledTimes(1)

    clientStream.destroy()

    expect(eventsDispatcher.removeClient).toHaveBeenCalledWith('session1')
  })
})
