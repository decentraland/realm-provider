import type { IConfigComponent } from '@well-known-components/interfaces'

/**
 * Reads a required config key and fails loudly, at startup, when it is missing or is not an
 * absolute `http(s)` URL. `PULSE_URL` and `COMMS_GATEKEEPER_URL` are read this way so a typo'd or
 * relative value never reaches a per-request fetch as a confusing runtime failure.
 */
export async function requireHttpUrl(config: IConfigComponent, key: string): Promise<string> {
  const value = await config.requireString(key)

  // The URL constructor silently strips leading/trailing C0 control and space characters before
  // parsing, so a value with stray whitespace (a copy-paste artifact, a YAML block scalar) would
  // otherwise pass. Reject it explicitly instead of fetching against a URL nobody intended.
  if (value !== value.trim()) {
    throw new Error(`Configuration: ${key} must be an absolute http(s) URL, got "${value}" (has leading or trailing whitespace)`)
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`Configuration: ${key} must be an absolute http(s) URL, got "${value}"`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Configuration: ${key} must be an absolute http(s) URL, got "${value}"`)
  }

  return value
}
