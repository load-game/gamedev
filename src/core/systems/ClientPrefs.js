import { isBoolean, isNumber } from 'lodash-es'

import { System } from './System'
import { storage } from '../storage'
import { isTouch } from '../../client/utils'
import { EffectRegistry } from './EffectRegistry'

/**
 * Client Prefs System
 *
 */
export class ClientPrefs extends System {
  constructor(world) {
    super(world)
    this.world = world
    this.effectRegistry = new EffectRegistry(world)

    const isQuest = /OculusBrowser/.test(navigator.userAgent)

    const data = storage.get('prefs', {})

    // v2: reset ui scale for new mobile default (0.9)
    if (!data.v) {
      data.v = 2
      data.ui = null
    }
    // v3: reset shadows for new mobile default (med)
    if (data.v < 3) {
      data.v = 3
      data.shadows = null
    }
    // v4: reset shadows for new defaults (low or med)
    if (data.v < 4) {
      data.v = 4
      data.shadows = null
    }

    this.ui = isNumber(data.ui) ? data.ui : isTouch ? 0.9 : 1
    this.actions = isBoolean(data.actions) ? data.actions : true
    this.stats = isBoolean(data.stats) ? data.stats : false
    this.dpr = isNumber(data.dpr) ? data.dpr : 1
    this.shadows = data.shadows ? data.shadows : isTouch ? 'low' : 'med' // none, low=1, med=2048cascade, high=4096cascade
    this.postprocessing = isBoolean(data.postprocessing) ? data.postprocessing : true
    this.bloom = isBoolean(data.bloom) ? data.bloom : true
    this.ao = isBoolean(data.ao) ? data.ao : true
    this.music = isNumber(data.music) ? data.music : 1
    this.sfx = isNumber(data.sfx) ? data.sfx : 1
    this.voice = isNumber(data.voice) ? data.voice : 1

    // DOF and camera properties
    this.dofEnabled = isBoolean(data.dofEnabled) ? data.dofEnabled : true
    this.dofFocusDistance = isNumber(data.dofFocusDistance) ? data.dofFocusDistance : 50
    this.dofFocalLength = isNumber(data.dofFocalLength) ? data.dofFocalLength : 24
    this.dofBokehScale = isNumber(data.dofBokehScale) ? data.dofBokehScale : 0.01
    this.dofFocusRange = isNumber(data.dofFocusRange) ? data.dofFocusRange : 30
    this.dofFStop = isNumber(data.dofFStop) ? data.dofFStop : 4.0
    this.dofMaxBlur = isNumber(data.dofMaxBlur) ? data.dofMaxBlur : 0.01
    this.dofLuminanceThreshold = isNumber(data.dofLuminanceThreshold) ? data.dofLuminanceThreshold : 0.6
    this.dofLuminanceGain = isNumber(data.dofLuminanceGain) ? data.dofLuminanceGain : 2.5
    this.dofBias = isNumber(data.dofBias) ? data.dofBias : 0.08
    this.dofFringe = isNumber(data.dofFringe) ? data.dofFringe : 0.8
    this.focusSmoothing = isNumber(data.focusSmoothing) ? data.focusSmoothing : 0
    this.focusSpeed = isNumber(data.focusSpeed) ? data.focusSpeed : 8
    this.playerAutofocus = isBoolean(data.playerAutofocus) ? data.playerAutofocus : true
    this.reticleAutofocus = isBoolean(data.reticleAutofocus) ? data.reticleAutofocus : true
    this.scrollZoomEnabled = isBoolean(data.scrollZoomEnabled) ? data.scrollZoomEnabled : true
    this.bloomIntensity = isNumber(data.bloomIntensity) ? data.bloomIntensity : 0.5
    this.bloomRadius = isNumber(data.bloomRadius) ? data.bloomRadius : 0.8
    this.bloomLuminanceThreshold = isNumber(data.bloomLuminanceThreshold) ? data.bloomLuminanceThreshold : 1
    this.bloomLuminanceSmoothing = isNumber(data.bloomLuminanceSmoothing) ? data.bloomLuminanceSmoothing : 0.3

    this.v = data.v

    this.changes = null
  }

  init() {
    this.world.chat.bindCommand('stats', () => {
      this.setStats(!this.stats)
    })
  }

  preFixedUpdate() {
    if (!this.changes) return
    this.emit('change', this.changes)
    this.changes = null
  }

  modify(key, value) {
    if (this[key] === value) return
    const prev = this[key]
    this[key] = value
    if (!this.changes) this.changes = {}
    if (!this.changes[key]) this.changes[key] = { prev, value: null }
    this.changes[key].value = value
    this.persist()
  }

  async persist() {
    // a small delay to ensure prefs that crash dont persist (eg old iOS with UHD shadows etc)
    await new Promise(resolve => setTimeout(resolve, 2000))
    storage.set('prefs', {
      ui: this.ui,
      actions: this.actions,
      stats: this.stats,
      dpr: this.dpr,
      shadows: this.shadows,
      postprocessing: this.postprocessing,
      bloom: this.bloom,
      ao: this.ao,
      music: this.music,
      sfx: this.sfx,
      voice: this.voice,
      v: this.v,
    })
  }

  setUI(value) {
    this.modify('ui', value)
  }

  setActions(value) {
    this.modify('actions', value)
  }

  setStats(value) {
    this.modify('stats', value)
  }

  setDPR(value) {
    this.modify('dpr', value)
  }

  setShadows(value) {
    this.modify('shadows', value)
  }

  setPostprocessing(value) {
    this.modify('postprocessing', value)
  }

  setBloom(value) {
    this.modify('bloom', value)
  }

  setAO(value) {
    this.modify('ao', value)
  }

  setMusic(value) {
    this.modify('music', value)
  }

  setSFX(value) {
    this.modify('sfx', value)
  }

  setVoice(value) {
    this.modify('voice', value)
  }

  setFocusSmoothing(value) {
    this.modify('focusSmoothing', value)
  }

  setFocusSpeed(value) {
    this.modify('focusSpeed', value)
  }

  setDOFEnabled(value) {
    this.modify('dofEnabled', value)
  }

  setDOFBokehScale(value) {
    this.modify('dofBokehScale', value)
  }

  setDOFFocusDistance(value) {
    this.modify('dofFocusDistance', value)
  }

  setDOFFocalLength(value) {
    this.modify('dofFocalLength', value)
  }

  setDOFFocusRange(value) {
    this.modify('dofFocusRange', value)
  }

  setDOffStop(value) {
    this.modify('dofFStop', value)
  }

  setDOFMaxBlur(value) {
    this.modify('dofMaxBlur', value)
  }

  destroy() {
    // ...
  }
}
