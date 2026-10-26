import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFeature, PluginRequiredError, pluginSnapshot, setPluginEnabled } from './featurePlugins'

describe('optional feature loading', () => {
  beforeEach(() => setPluginEnabled('heic', true))
  it('does not invoke a disabled feature, even when its module was loaded earlier', async () => {
    const loader = vi.fn(async () => 'decoded')
    await expect(loadFeature('heic', loader, 'disable')).resolves.toBe('decoded')
    setPluginEnabled('heic', false)
    await expect(loadFeature('heic', loader, 'disable')).rejects.toBeInstanceOf(PluginRequiredError)
    expect(loader).toHaveBeenCalledTimes(1)
  })
  it('deduplicates concurrent requests and can load multiple assets in one pack', async () => {
    const loader = vi.fn(async () => 'one')
    expect(await Promise.all([loadFeature('heic', loader, 'dedupe'), loadFeature('heic', loader, 'dedupe')])).toEqual(['one', 'one'])
    expect(loader).toHaveBeenCalledTimes(1)
    await expect(loadFeature('heic', async () => 'two', 'other-asset')).resolves.toBe('two')
  })
  it('clears a failed request so a retry can recover', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce('ready')
    await expect(loadFeature('heic', loader, 'retry')).rejects.toBeInstanceOf(PluginRequiredError)
    expect(pluginSnapshot().heic.phase).toBe('error')
    await expect(loadFeature('heic', loader, 'retry')).resolves.toBe('ready')
    expect(pluginSnapshot().heic.phase).toBe('ready')
  })
  it('contains synchronous loader failures within the same recovery path', async () => {
    await expect(loadFeature('heic', () => { throw new Error('unavailable') }, 'sync')).rejects.toBeInstanceOf(PluginRequiredError)
    await expect(loadFeature('heic', async () => true, 'sync')).resolves.toBe(true)
  })
})
