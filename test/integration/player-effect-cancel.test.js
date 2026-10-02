import { describe, expect, it, vi } from 'vitest'
import { createPlayerProxy } from '../../packages/core/extras/createPlayerProxy.js'

function fixture() {
  const world = { network: { isServer: true, send: vi.fn() }, apps: {} }
  const player = {
    world,
    data: { id: 'seated-player', effect: null },
    setEffect(effect, onEnd) {
      const previous = this.onEnd
      this.onEnd = undefined
      this.data.effect = effect
      previous?.()
      this.onEnd = onEnd
    },
  }
  const proxy = createPlayerProxy({ on: vi.fn() }, player)
  return { proxy, player, sent: world.network.send }
}

describe('player effect cancellation', () => {
  it('applyEffect(null) releases the anchor and publishes the release to every client', () => {
    const { proxy, player, sent } = fixture()
    const onEnd = vi.fn()
    const handle = proxy.applyEffect({ anchor: { anchorId: 'chair-0' }, emote: 'sit.glb', onEnd })
    expect(player.data.effect.anchorId).toBe('chair-0')
    proxy.applyEffect(null)
    expect(player.data.effect).toBeNull()
    expect(handle.active).toBe(false)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(sent).toHaveBeenLastCalledWith('entityModified', { id: 'seated-player', ef: null })
    handle.cancel()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('handle cancellation and movement cancellation both publish a cleared effect once', () => {
    for (const cancel of [f => f.handle.cancel(), f => f.player.onEnd()]) {
      const f = fixture()
      const onEnd = vi.fn()
      f.handle = f.proxy.applyEffect({ anchor: { anchorId: 'chair-0' }, cancellable: true, onEnd })
      cancel(f)
      expect(f.player.data.effect).toBeNull()
      expect(f.sent.mock.calls.filter(([, data]) => data.ef === null)).toHaveLength(1)
      expect(onEnd).toHaveBeenCalledTimes(1)
    }
  })

  it('replacing an effect does not publish a late clear over the new effect', () => {
    const { proxy, player, sent } = fixture()
    const old = proxy.applyEffect({ anchor: { anchorId: 'chair-0' } })
    proxy.applyEffect({ emote: 'wave.glb' })
    old.cancel()
    expect(player.data.effect).toEqual({ emote: 'wave.glb' })
    expect(sent).toHaveBeenLastCalledWith('entityModified', { id: 'seated-player', ef: { emote: 'wave.glb' } })
  })
})
