import { HandlerContextWithPath } from '../../types'
import { About } from '@dcl/catalyst-api-specs/lib/client'

export async function aboutMainHandler(
  context: Pick<HandlerContextWithPath<'metrics', '/main/about'>, 'components'>
): Promise<{ status: 200 | 503; body: About }> {
  const about = {}
  return {
    status: 200,
    body: {
      about
    }
  }
}
