import { initComponents } from '../../src/components'

/**
 * `src/components.ts` is the boot-time guard for `PULSE_URL` and `COMMS_GATEKEEPER_URL`: it must
 * fail loudly, before any other component does real work, when either is missing or malformed.
 * `main-realm-provider.spec.ts` and `hot-scenes-handler.spec.ts` already prove that *those*
 * consumers reject a bad URL on their own, but neither proves `initComponents` itself still calls
 * the guard — a later edit could drop `requireHttpUrl(config, 'PULSE_URL')` from this file and
 * both of those specs would stay green (see the review round 1 major finding on
 * WP6-boot-requires-urls). These tests call the real `initComponents()` so that a dropped guard
 * fails here too.
 *
 * The guard runs immediately after the config component is created, before metrics, logs, the
 * server or the catalysts provider (which makes a real Ethereum RPC call at construction time) —
 * so a rejection here never touches the network.
 */
describe('initComponents boot validation', () => {
  const ORIGINAL_ENV = { ...process.env }
  // This checkout has no optional `.env` file (by design — see .env.default's own comment), and
  // createDotEnvConfigComponent warns about that on every call. Expected, not a failure: silenced
  // so it does not read as test noise.
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    warnSpy.mockRestore()
  })

  it('fails to boot when PULSE_URL is not configured', async () => {
    delete process.env.PULSE_URL

    await expect(initComponents()).rejects.toThrow(/PULSE_URL/)
  })

  it('fails to boot when PULSE_URL is not an absolute http(s) URL', async () => {
    process.env.PULSE_URL = 'pulse.example.com'

    await expect(initComponents()).rejects.toThrow(/PULSE_URL/)
  })

  it('fails to boot when COMMS_GATEKEEPER_URL is empty', async () => {
    process.env.PULSE_URL = 'https://pulse.example.com'
    process.env.COMMS_GATEKEEPER_URL = ''

    await expect(initComponents()).rejects.toThrow(/COMMS_GATEKEEPER_URL/)
  })

  it('fails to boot when COMMS_GATEKEEPER_URL is not an absolute http(s) URL', async () => {
    process.env.PULSE_URL = 'https://pulse.example.com'
    process.env.COMMS_GATEKEEPER_URL = 'ftp://comms-gatekeeper.example.com'

    await expect(initComponents()).rejects.toThrow(/COMMS_GATEKEEPER_URL/)
  })
})
