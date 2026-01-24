({
  configure() {
    return {
      name: 'Wiggle Test Helper',
      description: 'Helper app to trigger different movement states for spring bone testing',
    }
  },

  init() {
    console.log('🎮 Wiggle Test Helper - Controls:')
    console.log('Press 1-9 for different movement states:')
    console.log('1 = Jump, 2 = Run, 3 = Walk, 4 = Flip, 5 = Backflip')
    console.log('6 = Idle, 7 = Talk, 8 = Fly, 0 = Status report')
    console.log('H = Toggle bone visibility')
  },

  update(delta) {
    const control = app.control()
    if (!control) return

    const player = world.entities.player
    if (!player || !player.avatar?.instance) return

    const vrm = player.avatar.instance

    // Movement state triggers
    if (control.key1 && !this.pressed1) {
      this.pressed1 = true
      console.log('🦘 Triggering JUMP')
      vrm.setLocomotion('JUMP', new THREE.Vector3(0, 0, 1))
    } else if (!control.key1) {
      this.pressed1 = false
    }

    if (control.key2 && !this.pressed2) {
      this.pressed2 = true
      console.log('🏃 Triggering RUN')
      vrm.setLocomotion('RUN', new THREE.Vector3(0, 0, 1))
    } else if (!control.key2) {
      this.pressed2 = false
    }

    if (control.key3 && !this.pressed3) {
      this.pressed3 = true
      console.log('🚶 Triggering WALK')
      vrm.setLocomotion('WALK', new THREE.Vector3(0, 0, 1))
    } else if (!control.key3) {
      this.pressed3 = false
    }

    if (control.key4 && !this.pressed4) {
      this.pressed4 = true
      console.log('🔄 Triggering FLIP')
      vrm.setLocomotion('FLIP', new THREE.Vector3(0, 0, 0))
    } else if (!control.key4) {
      this.pressed4 = false
    }

    if (control.key5 && !this.pressed5) {
      this.pressed5 = true
      console.log('🔄 Triggering BACKFLIP')
      vrm.setLocomotion('BACKFLIP', new THREE.Vector3(0, 0, 0))
    } else if (!control.key5) {
      this.pressed5 = false
    }

    if (control.key6 && !this.pressed6) {
      this.pressed6 = true
      console.log('😴 Triggering IDLE')
      vrm.setLocomotion('IDLE', new THREE.Vector3(0, 0, 0))
    } else if (!control.key6) {
      this.pressed6 = false
    }

    if (control.key7 && !this.pressed7) {
      this.pressed7 = true
      console.log('💬 Triggering TALK')
      vrm.setLocomotion('TALK', new THREE.Vector3(0, 0, 0))
    } else if (!control.key7) {
      this.pressed7 = false
    }

    if (control.key8 && !this.pressed8) {
      this.pressed8 = true
      console.log('🦅 Triggering FLY')
      vrm.setLocomotion('FLY', new THREE.Vector3(0, 0, 1))
    } else if (!control.key8) {
      this.pressed8 = false
    }

    if (control.key0 && !this.pressed0) {
      this.pressed0 = true
      console.log('📊 Status Report:')
      this.reportStatus()
    } else if (!control.key0) {
      this.pressed0 = false
    }

    if (control.keyH && !this.pressedH) {
      this.pressedH = true
      const isVisible = !this BonesVisible
      try {
        const inst = world.entities.player?.avatar?.instance
        if (inst?.setBonesVisible) {
          inst.setBonesVisible(isVisible)
          console.log(`🦴 Bones ${isVisible ? 'SHOWN' : 'HIDDEN'}`)
          this.bonesVisible = isVisible
        }
      } catch (_) {}
    } else if (!control.keyH) {
      this.pressedH = false
    }
  },

  reportStatus() {
    const player = world.entities.player
    if (!player || !player.avatar?.instance) return

    const vrm = player.avatar.instance
    const velocity = player?.rigidbody?.getLinearVelocity() || { x: 0, y: 0, z: 0 }
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2)

    console.log(`
🎯 Current Status:
  🏃 Speed: ${speed.toFixed(3)}m/s
  🏃 Loco Mode: ${vrm.loco?.mode || 'unknown'}
  🦴 Bones Visible: ${this.bonesVisible || false}
  🎬 Current Emote: ${vrm.currentEmote?.url || 'none'}

🎮 Movement Test Guide:
  🥊 Try combinations: RUN → FLIP → IDLE to see hood response
  🧘 Try talking while flipping for complex bone interactions
  🏎️ High speed flips may trigger different spring bones than slow ones
    `)
  },

  BonesVisible: false,
})