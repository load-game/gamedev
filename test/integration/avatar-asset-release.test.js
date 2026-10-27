import { describe, expect, it, vi } from 'vitest'
import * as THREE from '../../packages/core/extras/three.js'
import { ClientLoader } from '../../packages/core/systems/ClientLoader.js'
import { Avatar } from '../../packages/core/nodes/Avatar.js'
import { UIImage } from '../../packages/core/nodes/UIImage.js'
import { Image as WorldImage } from '../../packages/core/nodes/Image.js'
import { createAvatarAssetLifetime } from '../../packages/core/extras/avatarAssetLifetime.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function fixture() {
  const loader = new ClientLoader({ resolveURL: url => url.replace('asset://', '/assets/') })
  const factory = { dispose: vi.fn(() => true) }
  const asset = { factory, hooks: {} }
  const url = 'asset://preview.vrm',
    key = `avatar/${url}`
  loader.files.set('/assets/preview.vrm', new Blob(['model']))
  loader.results.set(key, asset)
  loader.promises.set(key, Promise.resolve(asset))
  return { loader, factory, asset, url, key }
}

describe('client avatar asset release', () => {
  it('evicts unused factory, parse promise and downloaded bytes, then permits a fresh load', async () => {
    const { loader, factory, url, key } = fixture()
    expect(await loader.releaseAsset('avatar', url)).toBe(true)
    expect(factory.dispose).toHaveBeenCalledOnce()
    expect(loader.results.has(key)).toBe(false)
    expect(loader.promises.has(key)).toBe(false)
    expect(loader.files.size).toBe(0)
    expect(await loader.releaseAsset('avatar', url)).toBe(false)
  })

  it('protects shared/live users until the final release; user release is idempotent', async () => {
    const { loader, factory, url } = fixture()
    const preview = loader.retainAvatar(url),
      player = loader.retainAvatar(url)
    preview()
    preview()
    expect(await loader.releaseAsset('avatar', url)).toBe(false)
    expect(factory.dispose).not.toHaveBeenCalled()
    player()
    expect(await loader.releaseAsset('avatar', url)).toBe(true)
  })

  it('protects an avatar mounted while its parse is in flight', async () => {
    const { loader, factory, asset, url, key } = fixture()
    const parse = deferred()
    loader.results.delete(key)
    loader.promises.set(key, parse.promise)
    const releasing = loader.releaseAsset('avatar', url)
    const user = loader.retainAvatar(url)
    loader.results.set(key, asset)
    parse.resolve(asset)
    expect(await releasing).toBe(false)
    expect(factory.dispose).not.toHaveBeenCalled()
    user()
    expect(await loader.releaseAsset('avatar', url)).toBe(true)
  })

  it('waits for an abandoned parse, and never evicts a newer cache generation', async () => {
    const { loader, factory, asset, url, key } = fixture()
    const parse = deferred()
    loader.promises.set(key, parse.promise)
    const releasing = loader.releaseAsset('avatar', url)
    loader.promises.set(key, Promise.resolve(asset))
    parse.resolve(asset)
    expect(await releasing).toBe(false)
    expect(factory.dispose).not.toHaveBeenCalled()
    expect(loader.results.get(key)).toBe(asset)
  })

  it('clears failed parses for retry and preserves bytes used by another loader type', async () => {
    const { loader, url, key } = fixture()
    const parse = deferred()
    loader.results.delete(key)
    loader.promises.set(key, parse.promise)
    loader.promises.set(`model/${url}`, Promise.resolve({}))
    const releasing = loader.releaseAsset('avatar', url)
    parse.reject(new Error('invalid model'))
    expect(await releasing).toBe(true)
    expect(loader.files.size).toBe(1)
    expect(await loader.releaseAsset('model', url)).toBe(false)
  })

  it('lets two concurrent release callers dispose an unused factory only once', async () => {
    const { loader, factory, url } = fixture()
    expect(await Promise.all([loader.releaseAsset('avatar', url), loader.releaseAsset('avatar', url)])).toEqual([
      true,
      false,
    ])
    expect(factory.dispose).toHaveBeenCalledOnce()
  })

  it('pins Avatar.mount before awaiting parse and clears its stale factory on unmount', async () => {
    const { loader, asset, url, key } = fixture()
    const parse = deferred()
    loader.results.delete(key)
    loader.promises.set(key, parse.promise)
    const avatar = new Avatar({ src: url })
    avatar.ctx = { world: { loader } }
    const mounting = avatar.mount()
    expect(loader.avatarUsers.get(url)).toBe(1)
    avatar.unmount()
    expect(loader.avatarUsers.has(url)).toBe(false)
    loader.results.set(key, asset)
    parse.resolve(asset)
    await mounting
    expect(avatar.instance).toBe(null)
    expect(avatar.factory).toBe(null)
    expect(await loader.releaseAsset('avatar', url)).toBe(true)
  })
})

describe('shared avatar GPU lifetime', () => {
  it('disposes each shared resource and bitmap once, only after every instance is gone', () => {
    const geometry = new THREE.BoxGeometry(),
      texture = new THREE.Texture()
    const bitmap = { close: vi.fn() }
    texture.source.data = bitmap
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const scene = new THREE.Group()
    scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material))
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')
    const textureDispose = vi.spyOn(texture, 'dispose')
    const lifetime = createAvatarAssetLifetime(scene)
    const first = lifetime.retain(),
      second = lifetime.retain()
    first()
    first()
    expect(lifetime.dispose()).toBe(false)
    expect(geometryDispose).not.toHaveBeenCalled()
    second()
    expect(lifetime.dispose()).toBe(true)
    expect(lifetime.dispose()).toBe(true)
    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
    expect(textureDispose).toHaveBeenCalledOnce()
    expect(bitmap.close).toHaveBeenCalledOnce()
    expect(() => lifetime.retain()).toThrow('released')
  })
})

describe('image asset release', () => {
  function imageFixture() {
    const loader = new ClientLoader({ resolveURL: url => url.replace('asset://', '/assets/') })
    const image = { src: 'blob:decoded-image', width: 400, height: 400 }
    const url = '/assets/artwork.png',
      key = `image/${url}`
    loader.files.set(url, new Blob(['image']))
    loader.promises.set(key, Promise.resolve(image))
    loader.results.set(key, image)
    return { loader, image, url, key }
  }

  it('protects shared image users, then clears the decoded image and cache', async () => {
    const { loader, image, url, key } = imageFixture()
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const first = loader.retainImage(url),
      second = loader.retainImage('asset://artwork.png')
    first()
    first()
    expect(await loader.releaseAsset('image', url)).toBe(false)
    expect(image.src).toBe('blob:decoded-image')
    second()
    expect(await loader.releaseAsset('image', 'asset://artwork.png')).toBe(true)
    expect(revoke).toHaveBeenCalledWith('blob:decoded-image')
    expect(image.src).toBe('')
    expect(loader.files.size).toBe(0)
    expect(loader.promises.has(key)).toBe(false)
    expect(loader.results.has(key)).toBe(false)
    revoke.mockRestore()
  })

  it('pins a loading UIImage, ignores a stale source completion and releases on unmount', async () => {
    const { loader, image, url, key } = imageFixture()
    const first = deferred(),
      second = deferred()
    loader.results.clear()
    loader.promises.set(key, first.promise)
    loader.promises.set('image//assets/next.png', second.promise)
    const node = new UIImage()
    node.ctx = { world: { loader, network: { isServer: false }, resolveURL: value => value } }
    node.mounted = true
    node.ui = { redraw: vi.fn() }
    const loadingFirst = node.loadImage(url)
    expect(loader.imageUsers.get(url)).toBe(1)
    const loadingSecond = node.loadImage('/assets/next.png')
    expect(loader.imageUsers.has(url)).toBe(false)
    first.resolve(image)
    await loadingFirst
    expect(node.img).toBe(null)
    const replacement = { width: 800, height: 800 }
    second.resolve(replacement)
    await loadingSecond
    expect(node.img).toBe(replacement)
    node.unmount()
    expect(loader.imageUsers.size).toBe(0)
  })

  it('clearing a UIImage source or abandoning a world image releases loading pins', async () => {
    const { loader, image, url, key } = imageFixture()
    const parse = deferred()
    loader.results.clear()
    loader.promises.set(key, parse.promise)
    const world = { loader, network: { isServer: false }, resolveURL: value => value }
    const ui = new UIImage({ src: url })
    ui.ctx = { world }
    ui.mounted = true
    ui.ui = { redraw: vi.fn() }
    const uiLoading = ui.loadImage(url)
    ui.src = null
    const board = new WorldImage({ src: url })
    board.ctx = { world }
    const boardLoading = board.build()
    expect(loader.imageUsers.get(url)).toBe(1)
    board.unmount()
    expect(loader.imageUsers.size).toBe(0)
    parse.resolve(image)
    await Promise.all([uiLoading, boardLoading])
    expect(ui.img).toBe(null)
    expect(board.mesh).toBeUndefined()
    expect(await loader.releaseAsset('image', url)).toBe(true)
  })
})
