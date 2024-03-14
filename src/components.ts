import { createDotEnvConfigComponent } from '@well-known-components/env-config-provider'
import {
  createServerComponent,
  createStatusCheckComponent,
  instrumentHttpServerWithPromClientRegistry
} from '@well-known-components/http-server'
import { createLogComponent } from '@well-known-components/logger'
import { createMetricsComponent } from '@well-known-components/metrics'
import { AppComponents, GlobalContext } from './types'
import { metricDeclarations } from './metrics'
import { createCatalystsProvider } from './adapters/realm-provider'
import { createFetchComponent } from '@well-known-components/fetch-component'
import { createMainRealmProviderComponent } from './adapters/main-realm-provider'
import { createContentComponent } from './adapters/content'

// Initialize all the components of the app
export async function initComponents(): Promise<AppComponents> {
  const config = await createDotEnvConfigComponent({ path: ['.env.default', '.env'] })
  const metrics = await createMetricsComponent(metricDeclarations, { config })
  const logs = await createLogComponent({ metrics })
  const server = await createServerComponent<GlobalContext>(
    { config, logs },
    {
      cors: {
        maxAge: 36000
      }
    }
  )
  const statusChecks = await createStatusCheckComponent({ server, config })
  const fetch = createFetchComponent()
  const catalystsProvider = await createCatalystsProvider({ logs, fetch, config })
  const mainRealmProvider = await createMainRealmProviderComponent({ logs, fetch, config })
  const content = await createContentComponent({ fetch, config })

  await instrumentHttpServerWithPromClientRegistry({ metrics, server, config, registry: metrics.registry! })

  return {
    config,
    logs,
    server,
    statusChecks,
    fetch,
    metrics,
    catalystsProvider,
    mainRealmProvider,
    content
  }
}
