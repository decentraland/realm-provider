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
    // The `about.comms` half of the guard is unchanged on purpose: it decides *which* realms are
    // advertised, and this work package must not change that. Only the count it used to carry is
    // gone — catalysts no longer run comms, so `about.comms.usersCount` is always 0. The field
    // stays in the response for clients that read it, pinned at 0.
    if (about.comms && about.configurations.realmName) {
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
