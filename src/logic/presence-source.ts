import type { IConfigComponent } from '@well-known-components/interfaces'

/**
 * Where online-player information comes from.
 *
 * - `archipelago` (the default): archipelago-stats, exactly as this service behaves today.
 * - `pulse`: Pulse for user counts and comms-gatekeeper for hot scenes.
 *
 * The flag is a rollback switch: anything other than `pulse` keeps today's behaviour, so a deploy
 * with no config change is a no-op.
 */
export type PresenceSource = 'archipelago' | 'pulse'

export const DEFAULT_PRESENCE_SOURCE: PresenceSource = 'archipelago'

export async function getPresenceSource(config: IConfigComponent): Promise<PresenceSource> {
  const configured = ((await config.getString('PRESENCE_SOURCE')) ?? '').trim().toLowerCase()
  return configured === 'pulse' ? 'pulse' : DEFAULT_PRESENCE_SOURCE
}
