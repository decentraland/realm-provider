import { HandlerContextWithPath } from '../../types'

type Realm = {
  serverName: string
  url: string
  usersCount: number
}

export async function realmsHandler(
  context: Pick<
    HandlerContextWithPath<'catalystsProvider' | 'mainRealmProvider' | 'config', '/realms'>,
    'components' | 'url'
  >
): Promise<{ body: Realm[] }> {
  const {
    components: { catalystsProvider, mainRealmProvider, config }
  } = context

  const baseUrl = (
    (await config.getString('HTTP_BASE_URL')) || `${context.url.protocol}//${context.url.host}`
  ).toString()

  const catalysts = await catalystsProvider.getHealhtyCatalysts()
  const realms: Realm[] = []

  for (const { url, about } of catalysts) {
    if (about.configurations.realmName) {
      // Catalysts no longer run comms, so their /about carries no comms section and no meaningful
      // user count. The field stays for clients that read it, pinned at 0.
      realms.push({ serverName: about.configurations.realmName, url, usersCount: 0 })
    }
  }

  const mainRealmStatus = await mainRealmProvider.getStatus()
  if (mainRealmStatus.healthy) {
    realms.push({
      serverName: mainRealmStatus.realmName,
      url: `${baseUrl}/main`,
      usersCount: mainRealmStatus.userCount
    })
  }

  return {
    body: realms
  }
}
