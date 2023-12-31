import { Entity } from '@dcl/schemas'
import { createContentClient } from 'dcl-catalyst-client'
import { IBaseComponent } from '@well-known-components/interfaces'
import { AppComponents } from '../types'

export type IContentComponent = IBaseComponent & {
  fetchScenes: (tiles: string[]) => Promise<Entity[]>
  calculateThumbnail: (scene: Entity) => string | undefined
}

export async function createContentComponent(
  components: Pick<AppComponents, 'config' | 'fetch'>
): Promise<IContentComponent> {
  const { config, fetch } = components
  const url = (await config.getString('CONTENT_URL')) || 'https://peer.decentraland.org/content/'
  const contentClient = createContentClient({ url, fetcher: fetch })

  function fetchScenes(tiles: string[]): Promise<Entity[]> {
    if (tiles.length === 0) {
      return Promise.resolve([])
    }
    return contentClient.fetchEntitiesByPointers(tiles)
  }

  function calculateThumbnail(scene: Entity): string | undefined {
    let thumbnail: string | undefined = scene.metadata?.display?.navmapThumbnail
    if (thumbnail && !thumbnail.startsWith('http')) {
      // We are assuming that the thumbnail is an uploaded file. We will try to find the matching hash

      const thumbnailHash = scene.content?.find(({ file }) => file === thumbnail)?.hash
      if (thumbnailHash) {
        thumbnail = `${url}/contents/${thumbnailHash}`
      } else {
        // If we couldn't find a file with the correct path, then we ignore whatever was set on the thumbnail property
        thumbnail = undefined
      }
    }
    return thumbnail
  }

  return {
    fetchScenes,
    calculateThumbnail
  }
}
