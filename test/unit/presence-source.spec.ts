import { createConfigComponent } from '@well-known-components/env-config-provider'
import { getPresenceSource, requirePresenceSourceConfig } from '../../src/logic/presence-source'

const GATEKEEPER_URL = 'https://comms-gatekeeper.decentraland.org'
const PULSE_URL = 'https://pulse.decentraland.org'

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
const logs = { getLogger: jest.fn(() => logger) } as any

function configWith(values: Record<string, string>) {
  return createConfigComponent(values)
}

describe('presence source', () => {
  beforeEach(() => {
    logger.warn.mockClear()
  })

  describe('when reading PRESENCE_SOURCE', () => {
    it('reads `pulse` as pulse', async () => {
      await expect(getPresenceSource(configWith({ PRESENCE_SOURCE: 'pulse' }), logs)).resolves.toBe('pulse')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('reads `PULSE` as pulse, case does not matter', async () => {
      await expect(getPresenceSource(configWith({ PRESENCE_SOURCE: 'PULSE' }), logs)).resolves.toBe('pulse')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('reads ` pulse ` as pulse, surrounding whitespace does not matter', async () => {
      await expect(getPresenceSource(configWith({ PRESENCE_SOURCE: ' pulse ' }), logs)).resolves.toBe('pulse')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('reads an unset value as archipelago, today’s behaviour, without complaining', async () => {
      await expect(getPresenceSource(configWith({}), logs)).resolves.toBe('archipelago')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('reads `archipelago` as archipelago without complaining', async () => {
      await expect(getPresenceSource(configWith({ PRESENCE_SOURCE: 'archipelago' }), logs)).resolves.toBe(
        'archipelago'
      )
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('falls back to archipelago on an unknown value, and warns about it', async () => {
      // A typo must not fail the boot, but it must not be silent either: the deploy stays on the
      // old path and the operator needs to know why.
      await expect(getPresenceSource(configWith({ PRESENCE_SOURCE: 'puse' }), logs)).resolves.toBe('archipelago')

      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.warn.mock.calls[0][0]).toContain('puse')
      expect(logger.warn.mock.calls[0][0]).toContain('archipelago')
    })

    it('works without a logs component', async () => {
      await expect(getPresenceSource(configWith({ PRESENCE_SOURCE: 'puse' }))).resolves.toBe('archipelago')
    })
  })

  describe('when validating the presence configuration at startup', () => {
    it('requires PULSE_URL in pulse mode', async () => {
      const config = configWith({ PRESENCE_SOURCE: 'pulse', COMMS_GATEKEEPER_URL: GATEKEEPER_URL })

      await expect(requirePresenceSourceConfig(config, logs)).rejects.toThrow(/PULSE_URL/)
    })

    it('requires COMMS_GATEKEEPER_URL in pulse mode, at startup and not per request', async () => {
      const config = configWith({ PRESENCE_SOURCE: 'pulse', PULSE_URL })

      await expect(requirePresenceSourceConfig(config, logs)).rejects.toThrow(/COMMS_GATEKEEPER_URL/)
    })

    it('accepts a pulse deployment that configures both', async () => {
      const config = configWith({ PRESENCE_SOURCE: 'pulse', PULSE_URL, COMMS_GATEKEEPER_URL: GATEKEEPER_URL })

      await expect(requirePresenceSourceConfig(config, logs)).resolves.toBe('pulse')
    })

    it('requires neither of them on a deploy that leaves the flag alone', async () => {
      // Rollback default: today's config must keep booting untouched.
      await expect(requirePresenceSourceConfig(configWith({}), logs)).resolves.toBe('archipelago')
    })
  })
})
