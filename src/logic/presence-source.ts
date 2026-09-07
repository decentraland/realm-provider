import type { IConfigComponent, ILoggerComponent } from '@well-known-components/interfaces'

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

export async function getPresenceSource(config: IConfigComponent, logs?: ILoggerComponent): Promise<PresenceSource> {
  const raw = (await config.getString('PRESENCE_SOURCE')) ?? ''
  const configured = raw.trim().toLowerCase()

  if (configured === 'pulse') {
    return 'pulse'
  }

  // A value we do not recognise falls back to today's behaviour rather than failing to boot — but
  // silently keeping the old path on a typo is exactly the surprise worth a warning.
  if (configured !== '' && configured !== DEFAULT_PRESENCE_SOURCE) {
    logs
      ?.getLogger('presence-source')
      .warn(`Unknown PRESENCE_SOURCE "${raw}", falling back to ${DEFAULT_PRESENCE_SOURCE}`)
  }

  return DEFAULT_PRESENCE_SOURCE
}

/**
 * Fails startup when the selected presence source is missing configuration, so a `pulse` deploy
 * cannot boot into per-request 500s. In `archipelago` mode nothing new is required: a deploy that
 * does not touch the flag keeps booting on today's config.
 */
export async function requirePresenceSourceConfig(
  config: IConfigComponent,
  logs?: ILoggerComponent
): Promise<PresenceSource> {
  const presenceSource = await getPresenceSource(config, logs)

  if (presenceSource === 'pulse') {
    await config.requireString('PULSE_URL')
    await config.requireString('COMMS_GATEKEEPER_URL')
  }

  return presenceSource
}
