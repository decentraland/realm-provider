import { createConfigComponent } from '@well-known-components/env-config-provider'
import { requireHttpUrl } from '../../src/logic/config-validation'

describe('requireHttpUrl', () => {
  it('resolves an absolute http URL', async () => {
    const config = createConfigComponent({ SOME_URL: 'http://example.com' })

    await expect(requireHttpUrl(config, 'SOME_URL')).resolves.toBe('http://example.com')
  })

  it('resolves an absolute https URL', async () => {
    const config = createConfigComponent({ SOME_URL: 'https://example.com/path' })

    await expect(requireHttpUrl(config, 'SOME_URL')).resolves.toBe('https://example.com/path')
  })

  it('fails loudly when the key is missing, same as requireString', async () => {
    const config = createConfigComponent({})

    await expect(requireHttpUrl(config, 'SOME_URL')).rejects.toThrow(/SOME_URL/)
  })

  it('rejects a value that is not a URL at all', async () => {
    const config = createConfigComponent({ SOME_URL: 'not-a-url' })

    await expect(requireHttpUrl(config, 'SOME_URL')).rejects.toThrow(/SOME_URL/)
  })

  it('rejects a non-http(s) scheme', async () => {
    const config = createConfigComponent({ SOME_URL: 'ftp://example.com' })

    await expect(requireHttpUrl(config, 'SOME_URL')).rejects.toThrow(/SOME_URL/)
  })

  it('rejects a relative path', async () => {
    const config = createConfigComponent({ SOME_URL: '/hot-scenes' })

    await expect(requireHttpUrl(config, 'SOME_URL')).rejects.toThrow(/SOME_URL/)
  })
})
