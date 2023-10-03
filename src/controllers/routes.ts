import { Router } from '@well-known-components/http-server'
import { GlobalContext } from '../types'
import { aboutMainHandler } from './handlers/about-main-handler'
import { errorHandler } from './handlers/error-handler'
import { pingHandler } from './handlers/ping-handler'
import { realmsHandler } from './handlers/realms-handler'
import { statusHandler } from './handlers/status-handler'
import { hotScenesHandler } from './handlers/hot-scenes-handler'

// We return the entire router because it will be easier to test than a whole server
export async function setupRouter(_globalContext: GlobalContext): Promise<Router<GlobalContext>> {
  const router = new Router<GlobalContext>()
  router.use(errorHandler)

  router.get('/ping', pingHandler)
  router.get('/status', statusHandler)
  router.get('/realms', realmsHandler)
  router.get('/hot-scenes', hotScenesHandler)
  router.get('/main/about', aboutMainHandler)

  return router
}
