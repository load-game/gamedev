import assert from 'node:assert/strict'
import EventEmitter from 'eventemitter3'
import { test } from 'vite-plus/test'
import { ClientLiveKit } from '../../packages/core/systems/ClientLiveKit.js'

function fixture() {
  const ready = []
  const settings = new EventEmitter()
  settings.voice = 'spatial'
  const world = {
    settings,
    audio: { ready: fn => ready.push(fn) },
    network: {
      id: 'local',
      send() {
        throw new Error('muting must not leave voice')
      },
    },
  }
  const voice = new ClientLiveKit(world)
  world.livekit = voice
  voice.start()
  const participant = new EventEmitter()
  participant.calls = []
  participant.setMicrophoneEnabled = async value => {
    participant.calls.push(value)
    voice.status.mic = value
  }
  const room = new EventEmitter()
  room.localParticipant = participant
  room.disconnect = async () => {
    room.disconnected = true
  }
  voice.connect = async () => {
    voice.room = room
    voice.status.connected = true
  }
  return { voice, ready, world, room, participant }
}

const opts = () => ({ wsUrl: 'wss://voice.example.com', token: 'fixture', levels: {}, muted: new Set() })

test('listen after the audio gesture without ever requesting a microphone', async () => {
  const { voice, ready, participant } = fixture()
  await voice.deserialize(opts())
  assert.equal(voice.status.connected, false)
  await ready.shift()()
  assert.equal(voice.status.connected, true)
  assert.equal(voice.status.mic, false)
  assert.deepEqual(participant.calls, [])
  voice.destroy()
})

test('muting and ending screen share preserve listening and the room connection', async () => {
  const { voice, room, participant } = fixture()
  await voice.connect()
  await voice.setMicrophoneEnabled(true)
  await voice.setMicrophoneEnabled(false)
  voice.screens = [{ playerId: 'local', destroy() {} }]
  voice.status.screenshare = 'screen'
  await voice.onLocalTrackUnpublished({ source: 'screen_share' })
  assert.equal(voice.room, room)
  assert.equal(voice.status.connected, true)
  assert.equal(voice.status.mic, false)
  assert.deepEqual(participant.calls, [true, false])
  voice.destroy()
})

test('permission denial preserves listening and a later request can retry', async () => {
  const { voice, participant } = fixture()
  await voice.connect()
  const enable = participant.setMicrophoneEnabled
  participant.setMicrophoneEnabled = async () => {
    throw new DOMException('denied', 'NotAllowedError')
  }
  await assert.rejects(voice.setMicrophoneEnabled(true), { name: 'NotAllowedError' })
  assert.equal(voice.status.connected, true)
  participant.setMicrophoneEnabled = enable
  await voice.setMicrophoneEnabled(true)
  assert.equal(voice.status.mic, true)
  voice.destroy()
})

test('rapid microphone requests run in order; moderator mute wins a pending permission request', async () => {
  const { voice, participant } = fixture()
  await voice.connect()
  await Promise.all([
    voice.setMicrophoneEnabled(true),
    voice.setMicrophoneEnabled(false),
    voice.setMicrophoneEnabled(true),
  ])
  assert.deepEqual(participant.calls, [true, false, true])
  await voice.setMicrophoneEnabled(false)
  let finish
  participant.setMicrophoneEnabled = async value => {
    if (value)
      await new Promise(resolve => {
        finish = resolve
      })
    voice.status.mic = value
  }
  const pending = voice.setMicrophoneEnabled(true)
  await Promise.resolve()
  voice.setMuted('local', true)
  finish()
  await pending
  assert.equal(voice.status.mic, false)
  assert.equal(voice.status.connected, true)
  await assert.rejects(voice.setMicrophoneEnabled(true), /muted_by_moderator/)
  voice.destroy()
})

test('destroy cancels deferred listening, closes transport and removes settings listener', async () => {
  const { voice, ready, room, world } = fixture()
  await voice.deserialize(opts())
  voice.destroy()
  await ready.shift()()
  assert.equal(voice.status.connected, false)
  assert.equal(world.settings.listenerCount('change'), 0)
  const active = fixture()
  await active.voice.connect()
  active.voice.destroy()
  assert.equal(active.room.disconnected, true)
  assert.equal(room.disconnected, undefined)
})

test('remote audio has exactly one game-controlled output route and releases nodes/listeners', () => {
  const { voice, world } = fixture()
  const oldMediaStream = globalThis.MediaStream
  globalThis.MediaStream = class {
    constructor(tracks) {
      this.tracks = tracks
    }
  }
  const node = () => ({
    targets: [],
    gain: { value: 1 },
    connect(n) {
      this.targets.push(n)
    },
    disconnect() {
      this.targets = []
    },
  })
  const gain = node()
  world.audio.ctx = { createGain: node, createPanner: node, createMediaStreamSource: node }
  world.audio.groupGains = { voice: gain }
  const player = { data: { id: 'remote' }, setSpeaking() {} }
  world.entities = { getPlayer: () => player }
  const participant = new EventEmitter()
  participant.identity = 'remote'
  const element = {}
  const track = {
    source: 'microphone',
    mediaStreamTrack: {},
    attach: () => element,
    detach() {},
    setAudioContext(ctx) {
      this.context = ctx
    },
  }
  try {
    voice.onTrackSubscribed(track, {}, participant)
    const remote = voice.voices.get('remote')
    assert.equal(element.muted, true)
    assert.equal(track.context, undefined)
    assert.deepEqual(remote.source.targets, [remote.root])
    assert.deepEqual(remote.root.targets, [remote.panner])
    assert.deepEqual(remote.panner.targets, [gain])
    remote.setLevel('global')
    assert.deepEqual(remote.root.targets, [gain])
    assert.deepEqual(remote.panner.targets, [])
    remote.setMuted(true)
    assert.equal(remote.root.gain.value, 0)
    remote.setMuted(false)
    remote.setLevel('disabled')
    assert.equal(remote.root.gain.value, 0)
    remote.setLevel('spatial')
    assert.equal(remote.root.gain.value, 1)
    voice.onTrackUnsubscribed(track, {}, participant)
    assert.deepEqual(remote.source.targets, [])
    assert.deepEqual(remote.root.targets, [])
    assert.deepEqual(remote.panner.targets, [])
    assert.equal(participant.eventNames().length, 0)
  } finally {
    globalThis.MediaStream = oldMediaStream
    voice.destroy()
  }
})
