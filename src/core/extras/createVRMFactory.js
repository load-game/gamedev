import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

import * as THREE from './three'
import { DEG2RAD } from './general'
import { getTrianglesFromGeometry } from './getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from './getTextureBytesFromMaterial'
import { Emotes } from './playerEmotes'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const m1 = new THREE.Matrix4()

const FORWARD = new THREE.Vector3(0, 0, -1)

const DIST_MIN_RATE = 1 / 5 // 5 times per second
const DIST_MAX_RATE = 1 / 60 // 40 times per second
const DIST_MIN = 5 // <= 5m = max rate
const DIST_MAX = 60 // >= 60m = min rate

const MAX_GAZE_DISTANCE = 40

const material = new THREE.MeshBasicMaterial()

const AimAxis = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  NEG_X: new THREE.Vector3(-1, 0, 0),
  NEG_Y: new THREE.Vector3(0, -1, 0),
  NEG_Z: new THREE.Vector3(0, 0, -1),
}

const UpAxis = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  NEG_X: new THREE.Vector3(-1, 0, 0),
  NEG_Y: new THREE.Vector3(0, -1, 0),
  NEG_Z: new THREE.Vector3(0, 0, -1),
}

// TODO: de-dup PlayerLocal.js has a copy
const Modes = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  JUMP: 3,
  FALL: 4,
  FLY: 5,
  TALK: 6,
  FLIP: 7,
  BACKFLIP: 8,
  // [STRAFE FLIP EMOTES] New strafe flip modes:
  SIDEFLIP_LEFT: 9,
  SIDEFLIP_RIGHT: 10,
  STRAFE_JUMP_LEFT: 11,
  STRAFE_JUMP_RIGHT: 12,
  GRINDING: 13,
  CLIMBING: 14,
  LEDGE_HANGING: 15,
  AIR_DIVING: 16,
  WALL_SLIDING: 17,
}

export function createVRMFactory(glb, setupMaterial) {
  // we'll update matrix ourselves
  glb.scene.matrixAutoUpdate = false
  glb.scene.matrixWorldAutoUpdate = false
  // NOTE: Preserve VRMExpression nodes so facial expressions (blink/viseme) can work
  // remove VRMHumanoidRig
  const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig') // prettier-ignore
  for (const node of vrmHumanoidRigs) node.removeFromParent()
  // keep `secondary` (VRM0 spring bone container). Previously removed; needed for spring bones to function.
  // const secondaries = glb.scene.children.filter(n => n.name === 'secondary')
  // for (const node of secondaries) node.removeFromParent()
  // enable shadows
  glb.scene.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })
  // calculate root to hips
  const bones = glb.userData.vrm.humanoid._rawHumanBones.humanBones
  const hipsPosition = v1.setFromMatrixPosition(bones.hips.node.matrixWorld)
  const rootPosition = v2.set(0, 0, 0) //setFromMatrixPosition(bones.root.node.matrixWorld)
  const rootToHips = hipsPosition.y - rootPosition.y
  // get vrm version
  const version = glb.userData.vrm.meta?.metaVersion

  // convert skinned mesh to detached bind mode
  // this lets us remove root bone from scene and then only perform matrix updates on the whole skeleton
  // when we actually need to  for massive performance
  const skinnedMeshes = []
  glb.scene.traverse(node => {
    if (node.isSkinnedMesh) {
      node.bindMode = THREE.DetachedBindMode
      node.bindMatrix.copy(node.matrixWorld)
      node.bindMatrixInverse.copy(node.bindMatrix).invert()
      skinnedMeshes.push(node)
    }
    if (node.isMesh) {
      // bounds tree
      node.geometry.computeBoundsTree()
      // fix csm shadow banding
      node.material.shadowSide = THREE.BackSide
      // csm material setup
      setupMaterial(node.material)
    }
  })
  // remove root bone from scene
  // const rootBone = glb.scene.getObjectByName('RootBone')
  // console.log({ rootBone })
  // rootBone.parent.remove(rootBone)
  // rootBone.updateMatrixWorld(true)

  const skeleton = skinnedMeshes[0].skeleton // should be same across all skinnedMeshes

  // pose arms down
  const normBones = glb.userData.vrm.humanoid._normalizedHumanBones.humanBones
  const leftArm = normBones.leftUpperArm.node
  leftArm.rotation.z = 75 * DEG2RAD
  const rightArm = normBones.rightUpperArm.node
  rightArm.rotation.z = -75 * DEG2RAD
  glb.userData.vrm.humanoid.update(0)
  skeleton.update()

  // get height
  let height = 0.5 // minimum
  for (const mesh of skinnedMeshes) {
    if (!mesh.boundingBox) mesh.computeBoundingBox()
    if (height < mesh.boundingBox.max.y) {
      height = mesh.boundingBox.max.y
    }
  }

  // this.headToEyes = this.eyePosition.clone().sub(headPos)
  const headPos = normBones.head.node.getWorldPosition(new THREE.Vector3())
  const headToHeight = height - headPos.y

  const getBoneName = vrmBoneName => {
    return glb.userData.vrm.humanoid.getRawBoneNode(vrmBoneName)?.name
  }

  const noop = () => {
    // ...
  }

  return {
    create,
    applyStats(stats) {
      glb.scene.traverse(obj => {
        if (obj.geometry && !stats.geometries.has(obj.geometry.uuid)) {
          stats.geometries.add(obj.geometry.uuid)
          stats.triangles += getTrianglesFromGeometry(obj.geometry)
        }
        if (obj.material && !stats.materials.has(obj.material.uuid)) {
          stats.materials.add(obj.material.uuid)
          stats.textureBytes += getTextureBytesFromMaterial(obj.material)
        }
      })
    },
  }

  function create(matrix, hooks, node) {
    const vrm = cloneGLB(glb)
    const tvrm = vrm.userData.vrm
    const skinnedMeshes = getSkinnedMeshes(vrm.scene)
    const skeleton = skinnedMeshes[0].skeleton // primary skeleton
    const cloneSkeletons = Array.from(new Set(skinnedMeshes.map(m => m.skeleton)))
    const rootBone = skeleton.bones[0] // should always be 0
    rootBone.parent.remove(rootBone)
    rootBone.updateMatrixWorld(true)
    vrm.scene.matrix = matrix // synced!
    vrm.scene.matrixWorld = matrix // synced!
    hooks.scene.add(vrm.scene)

    const getEntity = () => node?.ctx.entity

    // spatial capsule
    const cRadius = 0.3
    const sItem = {
      matrix,
      geometry: createCapsule(cRadius, height - cRadius * 2),
      material,
      getEntity,
    }
    hooks.octree?.insert(sItem)

    // link back entity for raycasts

    vrm.scene.traverse(o => {
      o.getEntity = getEntity
    })

    // i have no idea how but the mixer only needs one of the skinned meshes
    // and if i set it to vrm.scene it no longer works with detached bind mode
    const mixer = new THREE.AnimationMixer(skinnedMeshes[0])

    const bonesByName = {}
    const findBone = name => {
      // name is the official vrm bone name eg 'leftHand'
      // actualName is the actual bone name used in the skeleton which may different across vrms
      if (!bonesByName[name]) {
        const actualName = glb.userData.vrm.humanoid.getRawBoneNode(name)?.name
        bonesByName[name] = skeleton.getBoneByName(actualName)
      }
      return bonesByName[name]
    }

    const mt = new THREE.Matrix4()
    const getBoneTransform = boneName => {
      const bone = findBone(boneName)
      if (!bone) return null
      // combine the scene's world matrix with the bone's world matrix
      return mt.multiplyMatrices(vrm.scene.matrixWorld, bone.matrixWorld)
    }

    // expressions setup (blink + mouth/viseme)
    const origVRM = glb.userData.vrm
    try {
      const sm = origVRM?.springBoneManager
      // console.log('[vrmFactory] spring manager:', !!sm, 'joints:', sm?.joints?.size ?? 0)
    } catch (_) {}
    const expressionManager = origVRM?.expressionManager || null
    // expressions from the cloned scene (fallback path if no manager)
    // expressions live on the top-level scene of the GLB, not the skinned subtree
    // when we cloned, `vrm.scene` is the cloned top-level scene, so look directly there
    const expressionsByName = (() => {
      const map = new Map()
      // expressions are added as direct children in the VRM loader
      for (const child of vrm.scene.children) {
        if (child && child.type === 'VRMExpression') {
          // cloning may drop the custom .expressionName; derive from .name if needed
          let exprName = child.expressionName
          if (!exprName && typeof child.name === 'string' && child.name.startsWith('VRMExpression_')) {
            exprName = child.name.substring('VRMExpression_'.length)
          }
          if (exprName) map.set(exprName, child)
        }
      }
      return map
    })()
    const expressionWeights = {
      blink: 0,
      blinkLeft: 0,
      blinkRight: 0,
      aa: 0,
      ee: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    }
    const expressionsEnabled = !!expressionManager || expressionsByName.size > 0
    // map canonical names -> actual names present in this VRM
    const resolveName = (...candidates) => {
      // prefer manager lookup
      for (const c of candidates) {
        const v = expressionManager?.getValue?.(c)
        if (v !== null && v !== undefined) return c
      }
      // fallback to cloned expression nodes
      for (const c of candidates) {
        if (expressionsByName.has(c)) return c
      }
      return null
    }
    const nameMap = {
      blink: resolveName('blink', 'Blink', 'BLINK'),
      aa: resolveName('aa', 'A'),
      ee: resolveName('ee', 'E'),
      ih: resolveName('ih', 'I'),
      oh: resolveName('oh', 'O'),
      ou: resolveName('ou', 'U'),
    }
    let blinkingEnabled = true
    // blink state
    let blinkCooldown = 0
    let blinkPhase = 0 // 0 = idle, 1 = closing, 2 = opening
    let blinkTime = 0
    const BLINK_INTERVAL_MIN = 2.5
    const BLINK_INTERVAL_MAX = 5.0
    const BLINK_CLOSE_DURATION = 0.06
    const BLINK_OPEN_DURATION = 0.12
    function resetBlinkCooldown() {
      blinkCooldown = THREE.MathUtils.lerp(BLINK_INTERVAL_MIN, BLINK_INTERVAL_MAX, Math.random())
    }
    resetBlinkCooldown()
    // mouth/viseme state (driven when talking)
    const visemes = ['aa', 'ih', 'oh', 'ee', 'ou']
    let currentViseme = 'aa'
    let visemeTimer = 0
    let visemeSwitchInterval = 0.18 + Math.random() * 0.12 // 180-300ms
    let mouthTime = 0

    function setExpression(name, weight) {
      if (!expressionsEnabled) return
      if (expressionWeights[name] === undefined) return
      const clamped = THREE.MathUtils.clamp(weight, 0, 1)
      expressionWeights[name] = clamped
      const actual = nameMap[name] || name
      expressionManager?.setValue?.(actual, clamped)
    }

    function clearMouth() {
      setExpression('aa', 0)
      setExpression('ee', 0)
      setExpression('ih', 0)
      setExpression('oh', 0)
      setExpression('ou', 0)
    }

    function updateBlink(delta) {
      if (!expressionsEnabled || !blinkingEnabled) return
      if (blinkPhase === 0) {
        blinkCooldown -= delta
        if (blinkCooldown <= 0) {
          blinkPhase = 1
          blinkTime = 0
        }
      }
      if (blinkPhase === 1) {
        blinkTime += delta
        const t = THREE.MathUtils.clamp(blinkTime / BLINK_CLOSE_DURATION, 0, 1)
        const w = t // linear close
        setExpression('blink', w)
        if (t >= 1) {
          blinkPhase = 2
          blinkTime = 0
        }
      } else if (blinkPhase === 2) {
        blinkTime += delta
        const t = THREE.MathUtils.clamp(blinkTime / BLINK_OPEN_DURATION, 0, 1)
        const w = 1 - t // open back to 0
        setExpression('blink', w)
        if (t >= 1) {
          blinkPhase = 0
          resetBlinkCooldown()
        }
      }
    }

    function updateMouth(delta, isTalking) {
      if (!expressionsEnabled) return
      if (!isTalking) {
        clearMouth()
        return
      }
      mouthTime += delta
      visemeTimer += delta
      if (visemeTimer >= visemeSwitchInterval) {
        visemeTimer = 0
        visemeSwitchInterval = 0.18 + Math.random() * 0.12
        currentViseme = visemes[(Math.random() * visemes.length) | 0]
      }
      // simple oscillation for mouth opening while speaking
      const oscillation = (Math.sin(mouthTime * 12 + Math.random() * 0.5) + 1) * 0.5 // 0..1
      const weight = 0.4 + 0.6 * oscillation
      clearMouth()
      setExpression(currentViseme, weight)
    }

    const loco = {
      mode: Modes.IDLE,
      axis: new THREE.Vector3(),
      gazeDir: null,
    }
    const setLocomotion = (mode, axis, gazeDir) => {
      loco.mode = mode
      loco.axis = axis
      loco.gazeDir = gazeDir
    }

    // speaking state (drives mouth and optional talk overlay)
    let talking = false
    const setSpeaking = value => {
      talking = !!value
    }

    // world.updater.add(update)
    const emotes = {
      // [url]: {
      //   url: String
      //   loading: Boolean
      //   action: AnimationAction
      // }
    }

    // Additive animation layer system
    const additiveAnimations = {
      // [url]: {
      //   url: String
      //   action: AnimationAction
      //   affectedBones: Set<String> - bones this animation affects
      //   weight: Number - current blend weight
      //   targetWeight: Number - target blend weight
      //   fadeSpeed: Number - how fast to fade in/out
      // }
    }
    let currentAdditiveAnims = new Map() // Currently playing additive animations

    // Detect which bones an animation clip affects
    function getAffectedBones(clip) {
      const affectedBones = new Set()
      for (const track of clip.tracks) {
        // Extract bone name from track name (format: "boneName.property")
        const boneName = track.name.split('.')[0]
        affectedBones.add(boneName)
      }
      return affectedBones
    }

    // Filter bones for weapon animations - only allow arm bones to prevent conflicts with locomotion
    // This prevents "over-driven" animations where both locomotion and weapon animations control the same bones
    function filterWeaponBones(affectedBones) {
      const weaponBones = new Set()

      // console.log(`[VRM] All affected bones from animation:`, Array.from(affectedBones).sort())

      // Allow upper body bones for weapon animations - exclude lower body to prevent conflicts with locomotion
      const allowedBonePatterns = [
        // VRM bone naming patterns (most common)
        'upper_arm.R',
        'upper_arm.L',
        'upperarm.r',
        'upperarm.l',
        'lower_arm.R',
        'lower_arm.L',
        'lowerarm.r',
        'lowerarm.l',
        'hand.R',
        'hand.L',
        'hand.r',
        'hand.l',
        'shoulder.R',
        'shoulder.L',
        'shoulder.r',
        'shoulder.l',

        // Alternative VRM patterns
        'upperarm.r',
        'upperarm.l',
        'upper_arm.r',
        'upper_arm.l',
        'lowerarm.r',
        'lowerarm.l',
        'lower_arm.r',
        'lower_arm.l',

        // Upper body bones for weapon poses
        'chest',
        'spine',
        'neck',
        'head',

        // Traditional naming patterns
        'leftupperarm',
        'left_upper_arm',
        'upperarml',
        'upper_arml',
        'upperarm_l',
        'upper_arm_l',
        'upperArmL',
        'leftlowerarm',
        'left_lower_arm',
        'lowerarml',
        'lower_arml',
        'lowerarm_l',
        'lower_arm_l',
        'lowerArmL',
        'lefthand',
        'left_hand',
        'handl',
        'hand_l',
        'handL',
        'leftwrist',
        'left_wrist',
        'wristl',
        'wrist_l',
        'wristL',
        'rightupperarm',
        'right_upper_arm',
        'upperarmr',
        'upper_armr',
        'upperarm_r',
        'upper_arm_r',
        'upperArmR',
        'rightlowerarm',
        'right_lower_arm',
        'lowerarmr',
        'lower_armr',
        'lowerarm_r',
        'lower_arm_r',
        'lowerArmR',
        'righthand',
        'right_hand',
        'handr',
        'hand_r',
        'handR',
        'rightwrist',
        'right_wrist',
        'wristr',
        'wrist_r',
        'wristR',

        // VRM standard arm bone names
        'leftUpperArm',
        'leftLowerArm',
        'leftHand',
        'rightUpperArm',
        'rightLowerArm',
        'rightHand',

        // Common variations
        'leftarm',
        'left_arm',
        'arml',
        'arm_l',
        'armL',
        'rightarm',
        'right_arm',
        'armr',
        'arm_r',
        'armR',
        'leftforearm',
        'left_forearm',
        'forearml',
        'forearm_l',
        'forearmL',
        'rightforearm',
        'right_forearm',
        'forearmr',
        'forearm_r',
        'forearmR',

        // Finger bones for weapon grips
        'finger',
        'thumb',
        'index',
        'middle',
        'ring',
        'pinky',
        'proximal',
        'intermediate',
        'distal',
        'leftfinger',
        'rightfinger',
        'leftthumb',
        'rightthumb',
        'leftindex',
        'rightindex',
        'leftmiddle',
        'rightmiddle',
        'leftring',
        'rightring',
        'leftpinky',
        'rightpinky',
      ]

      for (const bone of affectedBones) {
        const boneLower = bone.toLowerCase()

        // Check if bone should be allowed (arm bones only)
        const isAllowed = allowedBonePatterns.some(
          pattern => boneLower.includes(pattern) || pattern.includes(boneLower)
        )

        if (isAllowed) {
          weaponBones.add(bone)
          // console.log(`[VRM] Allowed weapon bone: ${bone}`)
        } else {
          // console.log(`[VRM] Filtered out bone (preserving locomotion): ${bone}`)
        }
      }

      // console.log(`[VRM] Final weapon bones (${weaponBones.size}):`, Array.from(weaponBones).sort())
      return weaponBones
    }

    // Create a filtered animation clip that excludes root bone tracks
    function createFilteredClip(originalClip, allowedBones) {
      const filteredTracks = []

      for (const track of originalClip.tracks) {
        const boneName = track.name.split('.')[0]
        if (allowedBones.has(boneName)) {
          filteredTracks.push(track)
        }
      }

      if (filteredTracks.length === 0) {
        console.warn(`[VRM] No tracks remaining after filtering for bones:`, Array.from(allowedBones))
        return originalClip // Return original if no tracks remain
      }

      // console.log(`[VRM] Filtered clip: ${originalClip.tracks.length} -> ${filteredTracks.length} tracks`)

      // Debug: Show which tracks were kept vs filtered out
      const keptTracks = filteredTracks.map(track => track.name.split('.')[0])
      const filteredOutTracks = originalClip.tracks
        .filter(track => !filteredTracks.includes(track))
        .map(track => track.name.split('.')[0])

      // console.log(`[VRM] Kept tracks (${keptTracks.length}):`, [...new Set(keptTracks)].slice(0, 10))
      // console.log(`[VRM] Filtered out tracks (${filteredOutTracks.length}):`, [...new Set(filteredOutTracks)].slice(0, 10))
      return new THREE.AnimationClip(originalClip.name, originalClip.duration, filteredTracks)
    }

    // Convert animation clip to delta format for additive blending
    function convertToDeltaClip(clip, skeleton) {
      const deltaTracks = []

      for (const track of clip.tracks) {
        const trackName = track.name
        const boneName = trackName.split('.')[0]
        const propertyName = trackName.split('.')[1]

        // Find the bone's bind pose
        const bone = skeleton.getBoneByName(boneName)
        if (!bone) {
          console.warn(`[VRM] Bone not found for delta conversion: ${boneName}`)
          deltaTracks.push(track.clone()) // Keep original if bone not found
          continue
        }

        if (propertyName === 'quaternion' && track instanceof THREE.QuaternionKeyframeTrack) {
          // Convert quaternion track to delta format
          const bindRotation = bone.quaternion.clone()
          const deltaValues = new Float32Array(track.values.length)

          for (let i = 0; i < track.values.length; i += 4) {
            const keyframeQuat = new THREE.Quaternion(
              track.values[i],
              track.values[i + 1],
              track.values[i + 2],
              track.values[i + 3]
            )

            // Calculate delta: delta = keyframe * bindRotation.inverse()
            const deltaQuat = keyframeQuat.premultiply(bindRotation.clone().invert())

            deltaValues[i] = deltaQuat.x
            deltaValues[i + 1] = deltaQuat.y
            deltaValues[i + 2] = deltaQuat.z
            deltaValues[i + 3] = deltaQuat.w
          }

          const deltaTrack = new THREE.QuaternionKeyframeTrack(trackName, track.times, deltaValues)
          deltaTracks.push(deltaTrack)
        } else if (propertyName === 'position' && track instanceof THREE.VectorKeyframeTrack) {
          // For position tracks, we typically want to keep them as absolute
          // or zero them out for pure rotation additive animations
          deltaTracks.push(track.clone())
        } else {
          // Keep other track types as-is
          deltaTracks.push(track.clone())
        }
      }

      return new THREE.AnimationClip(clip.name + '_delta', clip.duration, deltaTracks)
    }

    // Load and setup additive animation
    function loadAdditiveAnimation(url, options = {}) {
      console.log(`[VRM] loadAdditiveAnimation called with url: ${url}, options:`, options)
      const { fadeDuration = 0.15, weight = 1.0 } = options

      if (additiveAnimations[url]) {
        console.log(`[VRM] Animation already loaded, updating weight`)
        // Already loaded, just update weight
        const anim = additiveAnimations[url]
        anim.targetWeight = weight
        anim.fadeSpeed = 1 / fadeDuration
        currentAdditiveAnims.set(url, anim)
        return Promise.resolve(anim)
      }

      console.log(`[VRM] Loading new additive animation from: ${url}`)
      // Load new additive animation
      return hooks.loader
        .load('emote', url)
        .then(emo => {
          console.log(`[VRM] Animation loaded, creating clip`)
          const originalClip = emo.toClip({
            rootToHips,
            version,
            getBoneName,
          })

          // Filter the clip to only include upper body bones
          const allAffectedBones = getAffectedBones(originalClip)
          const filteredBones = filterWeaponBones(allAffectedBones)
          const filteredClip = createFilteredClip(originalClip, filteredBones)

          // Convert to delta format for proper additive blending
          const deltaClip = convertToDeltaClip(filteredClip, skeleton)

          console.log(`[VRM] Creating additive action with blend mode:`, THREE.AdditiveAnimationBlendMode)
          // Create additive action following THREE.js additive blending patterns
          const action = mixer.clipAction(deltaClip)
          action.blendMode = THREE.AdditiveAnimationBlendMode
          action.setLoop(options.loop !== false ? THREE.LoopRepeat : THREE.LoopOnce) // Default to loop unless explicitly set to false
          action.weight = 0 // Start at 0, fade in
          action.enabled = true
          action.clampWhenFinished = false // Allow additive animations to continue
          action.play()

          const anim = {
            url,
            action,
            affectedBones: filteredBones,
            weight: 0,
            targetWeight: weight,
            fadeSpeed: 1 / fadeDuration,
          }

          additiveAnimations[url] = anim
          currentAdditiveAnims.set(url, anim)

          console.log(`[VRM] Loaded additive animation: ${url}`)
          console.log(`[VRM] Delta clip tracks: ${deltaClip.tracks.length}`)
          console.log(`[VRM] Filtered bones (${filteredBones.size}):`, Array.from(filteredBones))
          return anim
        })
        .catch(error => {
          console.error(`[VRM] Failed to load additive animation: ${url}`, error)
          throw error
        })
    }

    // Stop and remove additive animation
    function stopAdditiveAnimation(url, fadeDuration = 0.15) {
      const anim = additiveAnimations[url]
      if (!anim) return

      console.log(`[VRM] Stopping additive animation: ${url}`)
      anim.targetWeight = 0
      anim.fadeSpeed = 1 / fadeDuration

      // Remove from current set immediately for faster clearing
      currentAdditiveAnims.delete(url)
    }

    let currentEmote
    let locomotionDisabled = false // Track if locomotion should be disabled
    // auto-clear currentEmote when a non-looping emote finishes
    mixer.addEventListener('finished', e => {
      if (!currentEmote) return
      if (e?.action === currentEmote.action) {
        if (!currentEmote.loop) {
          try {
            currentEmote.action?.fadeOut?.(0.15)
          } catch (_) {}
          currentEmote = null
          locomotionDisabled = false // Re-enable locomotion when emote finishes

          // Stop facial expressions when TALK emote finishes
          setSpeaking(false)
        }
      }
    })
    const setEmote = (url, options = {}) => {
      const { crossFade = true, fadeDuration = 0.15, warp = true } = options
      // console.log("[VRM DEBUG] setEmote called with:", url, "currentEmote:", currentEmote?.url)

      if (currentEmote?.url === url) {
        // console.log("[VRM DEBUG] setEmote returning early - same emote already playing")
        return
      }

      const prevEmote = currentEmote

      // Stop speaking if switching from TALK to a different emote
      if (prevEmote?.url === Emotes.TALK && url !== Emotes.TALK) {
        setSpeaking(false)
      }

      if (!url) {
        if (currentEmote) {
          currentEmote.action?.fadeOut(fadeDuration)
          currentEmote = null
        }
        locomotionDisabled = false // Re-enable locomotion when clearing emote
        setSpeaking(false) // Stop facial expressions when clearing emote
        return
      }

      const opts = getQueryParams(url)
      const loop = opts.l !== '0'
      const speed = parseFloat(opts.s || 1)
      const gaze = opts.g == '1'

      if (emotes[url]) {
        currentEmote = emotes[url]
        if (currentEmote.action) {
          currentEmote.loop = loop
          currentEmote.action.clampWhenFinished = !loop
          currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)

          // Use crossFadeTo if requested and there's a previous emote playing
          if (crossFade && prevEmote?.action?.isRunning()) {
            currentEmote.action.reset().play()
            prevEmote.action.crossFadeTo(currentEmote.action, fadeDuration, warp)
          } else {
            // Fall back to original fade behavior
            if (prevEmote) {
              prevEmote.action?.fadeOut(fadeDuration)
            }
            currentEmote.action.reset().fadeIn(fadeDuration).play()
          }
          // console.log("[VRM DEBUG] setEmote: locomotion disabled, emote starting")
          locomotionDisabled = true // Regular emotes disable locomotion
          clearLocomotion()

          // Auto-activate facial expressions for TALK emote
          if (url === Emotes.TALK) {
            setSpeaking(true)
          }
        }
      } else {
        const emote = {
          url,
          loading: true,
          action: null,
          gaze,
          loop,
        }
        // console.log('[VRM] Created new emote object:', emote)
        emotes[url] = emote
        currentEmote = emote
        hooks.loader
          .load('emote', url)
          .then(emo => {
            const clip = emo.toClip({
              rootToHips,
              version,
              getBoneName,
            })
            const action = mixer.clipAction(clip)
            action.timeScale = speed
            emote.action = action
            // if its still this emote, play it!
            if (currentEmote === emote) {
              action.clampWhenFinished = !loop
              action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
              locomotionDisabled = true // Regular emotes disable locomotion

              // Check if we should crossfade from previous
              if (crossFade && prevEmote?.action?.isRunning()) {
                action.play()
                prevEmote.action.crossFadeTo(action, fadeDuration, warp)
              } else {
                if (prevEmote?.action) {
                  prevEmote.action.fadeOut(fadeDuration)
                }
                action.fadeIn(fadeDuration).play()
              }
              clearLocomotion()

              // Auto-activate facial expressions for TALK emote
              if (url === Emotes.TALK) {
                setSpeaking(true)
              }
            }
          })
          .catch(error => {
            console.error('Failed to load emote:', url, error)
          })
      }
    }

    // IDEA: we should use a global frame "budget" to distribute across avatars
    // https://chatgpt.com/c/4bbd469d-982e-4987-ad30-97e9c5ee6729

    let elapsed = 0
    let rate = 0
    let rateCheck = true
    let distance

    const updateRate = () => {
      const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix)
      const camPos = v2.setFromMatrixPosition(hooks.camera.matrixWorld) // prettier-ignore
      distance = vrmPos.distanceTo(camPos)
      const clampedDistance = Math.max(distance - DIST_MIN, 0)
      const normalizedDistance = Math.min(clampedDistance / (DIST_MAX - DIST_MIN), 1) // prettier-ignore
      rate = DIST_MAX_RATE + normalizedDistance * (DIST_MIN_RATE - DIST_MAX_RATE) // prettier-ignore
      // console.log('distance', distance)
      // console.log('rate per second', 1 / rate)
    }

    // build morph mirroring map (original -> clone) once
    let morphMirrorInit = false
    const morphPairs = []
    function initMorphMirror() {
      if (morphMirrorInit) return
      if (!origVRM?.scene) return
      const src = []
      const dst = []
      origVRM.scene.traverse(o => {
        if (o.isSkinnedMesh && o.morphTargetInfluences) src.push(o)
      })
      vrm.scene.traverse(o => {
        if (o.isSkinnedMesh && o.morphTargetInfluences) dst.push(o)
      })
      for (let i = 0; i < src.length; i++) {
        const s = src[i]
        const d = dst.find(x => x.name === s.name) || dst[i]
        if (d) morphPairs.push([s, d])
      }
      morphMirrorInit = true
    }

    // spring bone mirroring (original -> clone) and drive original with clone pose
    let springMirrorInit = false
    let hasSprings = false
    const springPairs = []
    const drivePairs = []
    function initSpringMirror() {
      if (springMirrorInit) return
      const spring = origVRM?.springBoneManager
      if (!spring) {
        springMirrorInit = true
        return
      }
      try {
        hasSprings = spring.joints && spring.joints.size > 0
        // Gentle spring bone physics tuning to prevent spazzing
        const tuning = hooks.springTuning || {
          stiffness: 1.2, // Slightly increased responsiveness, but not too high
          dragForce: 1.0, // Keep at 1.0 for stable movement
          gravityPower: 1.0, // Keep at 1.0 for natural gravity
          hitRadius: 1.0, // Default collision radius
        }
        try {
          spring.joints.forEach(joint => {
            const s = joint.settings
            if (!s) return
            if (tuning.stiffness != null) s.stiffness *= tuning.stiffness
            if (tuning.dragForce != null) s.dragForce *= tuning.dragForce
            if (tuning.gravityPower != null) s.gravityPower *= tuning.gravityPower
            if (tuning.hitRadius != null) s.hitRadius *= tuning.hitRadius
            // Only disable colliders if explicitly requested
            if (hooks.disableSpringColliders === true) {
              joint.colliderGroups = []
            }
          })
        } catch (_) {}
        // Enhanced spring initialization with stability checks
        try {
          // Set initial state before applying tuning
          spring.setInitState()

          // Apply per-joint optimization for different body parts
          spring.joints.forEach(joint => {
            const s = joint.settings
            if (!s) return

            // Subtle enhancements for different bone types to prevent instability
            const boneName = joint.bone?.name?.toLowerCase() || ''
            if (boneName.includes('hair') || boneName.includes('tail')) {
              // Only very slight increase for hair/tail to prevent spazzing
              s.stiffness *= 1.05 // Minimal increase (5%)
            }

            // Keep chest/spine bones at default stability
            // No modifications to prevent instability

            // Ensure minimum threshold values to prevent dead springs
            s.stiffness = Math.max(s.stiffness, 0.5)
            s.dragForce = Math.max(s.dragForce, 0.1)
            s.gravityPower = Math.max(s.gravityPower, 0.1)
          })

          // Re-initialize with optimized settings
          spring.setInitState()
        } catch (e) {
          console.warn('[VRM] Spring bone initialization failed:', e)
        }
        // build spring joint pairs (orig -> clone) using clone skeleton lookup by name
        spring.joints.forEach(joint => {
          const src = joint.bone
          if (!src || !src.name) return
          let dst = skeleton.getBoneByName(src.name)
          if (dst) springPairs.push([src, dst])
        })
        // build drive pairs (clone skeleton -> original bones) for joint ancestors
        const origMeshes = []
        glb.scene.traverse(o => {
          if (o.isSkinnedMesh && o.skeleton) origMeshes.push(o)
        })
        const origSkeleton = origMeshes[0]?.skeleton
        const addDrivePair = origObj => {
          if (!origObj || !origObj.name) return
          const cloneBone = skeleton.getBoneByName(origObj.name)
          if (cloneBone) drivePairs.push([cloneBone, origObj])
        }
        spring.joints.forEach(joint => {
          let p = joint.bone
          while (p && p !== glb.scene) {
            addDrivePair(p)
            p = p.parent
          }
        })
        // targeted alias mapping to help common hair/tail chains and path-based fallback
        const alias = new Map([
          ['Hair1', ['hair1', 'hair_1', 'Hair_1']],
          ['Hair2', ['hair2', 'hair_2', 'Hair_2']],
          ['Tail', ['tail', 'Tail_1', 'tail_1']],
        ])
        // rebuild springPairs using alias + path fallback for better coverage
        springPairs.length = 0
        spring.joints.forEach(joint => {
          const src = joint.bone
          if (!src || !src.name) return
          let dst = skeleton.getBoneByName(src.name)
          if (!dst) {
            for (const [key, alts] of alias.entries()) {
              if (src.name.toLowerCase().startsWith(key.toLowerCase())) {
                for (const a of alts) {
                  dst = skeleton.getBoneByName(a)
                  if (dst) break
                }
                if (dst) break
              }
            }
          }
          if (!dst) {
            // path fallback
            const path = []
            let n = src
            while (n && n !== glb.scene) {
              const p = n.parent
              if (!p) break
              const i = p.children.indexOf(n)
              if (i < 0) break
              path.push(i)
              n = p
            }
            if (n === glb.scene) {
              path.reverse()
              let m = vrm.scene
              for (const i of path) {
                m = m.children?.[i]
                if (!m) break
              }
              if (m && m.isBone) dst = m
            }
          }
          if (dst) springPairs.push([src, dst])
        })
        // re-initialize springs after mapping (safe if already initialized)
        try {
          spring.setInitState()
        } catch (_) {}
        // console.log(
        //   '[vrmFactory] Enhanced spring bone system initialized',
        //   'springs:',
        //   spring.joints.size,
        //   'pairs:',
        //   springPairs.length,
        //   'drive:',
        //   drivePairs.length,
        //   'tuning:',
        //   JSON.stringify({
        //     stiffness: tuning.stiffness?.toFixed(2),
        //     dragForce: tuning.dragForce?.toFixed(2),
        //     gravityPower: tuning.gravityPower?.toFixed(2)
        //   })
        // )

        // Log spring bone configuration for debugging
        let activeSprings = 0
        spring.joints.forEach(joint => {
          if (joint.settings && joint.bone) {
            activeSprings++
            if (activeSprings <= 5) {
              // Log first 5 for debugging
              // console.log(`[VRM] Spring ${joint.bone.name}:`, {
              //   stiffness: joint.settings.stiffness?.toFixed(3),
              //   dragForce: joint.settings.dragForce?.toFixed(3),
              //   gravityPower: joint.settings.gravityPower?.toFixed(3)
              // })
            }
          }
        })
      } catch (_) {
        // ignore
      }
      springMirrorInit = true
    }

    // Reusable objects for spring bone updates (allocated once)
    const _springPos = new THREE.Vector3()
    const _springQuat = new THREE.Quaternion()
    const _springScl = new THREE.Vector3()

    const update = delta => {
      elapsed += delta
      // Spring bones need every-frame updates for fluid motion, but we keep performance optimizations
      const doAnim = hasSprings ? true : rateCheck ? elapsed >= rate : true
      if (doAnim) {
        mixer.update(hasSprings ? delta : elapsed)

        // Update additive animation weights
        for (const [url, anim] of currentAdditiveAnims) {
          // Smooth weight transition
          const weightDiff = anim.targetWeight - anim.weight
          if (Math.abs(weightDiff) > 0.01) {
            anim.weight += weightDiff * anim.fadeSpeed * delta
            anim.action.weight = anim.weight
          } else {
            anim.weight = anim.targetWeight
            anim.action.weight = anim.weight
          }

          // Ensure action is properly enabled and playing
          if (anim.weight > 0.01) {
            anim.action.enabled = true
            if (!anim.action.isRunning()) {
              anim.action.play()
            }
          }

          // Debug: Log when additive animations are active (reduced frequency)
          if (anim.weight > 0.01 && Math.random() < 0.005) {
            // 0.5% chance per frame
            // console.log(`[VRM] Additive animation active: ${url.split('/').pop()}, weight: ${anim.weight.toFixed(2)}, bones: ${Array.from(anim.affectedBones).slice(0, 5).join(', ')}...`)
          }

          // Remove if fully faded out
          if (anim.weight <= 0.01 && anim.targetWeight === 0) {
            anim.action.enabled = false
            anim.action.stop()
            currentAdditiveAnims.delete(url)
          }
        }

        skeleton.bones.forEach(bone => bone.updateMatrixWorld())
        skeleton.update = THREE.Skeleton.prototype.update

        // Update base locomotion unless disabled by regular emotes (additive animations layer over it)
        if (!locomotionDisabled) {
          updateLocomotion(delta)
          // Debug: Log when locomotion is running (1% chance per frame)
          if (Math.random() < 0.01) {
            // console.log(`[VRM] Locomotion running, disabled: ${locomotionDisabled}, currentEmote: ${currentEmote?.url || 'none'}`)
          }
        } else {
          // Debug: Log when locomotion is disabled
          if (Math.random() < 0.01) {
            // console.log(`[VRM] Locomotion DISABLED - currentEmote: ${currentEmote?.url || 'none'}`)
          }
        }
        // facial expressions per frame
        if (expressionsEnabled) {
          updateBlink(elapsed)
          updateMouth(elapsed, talking)
          if (expressionManager) {
            // push values to manager and update
            for (const [canon, weight] of Object.entries(expressionWeights)) {
              const actual = nameMap[canon] || canon
              expressionManager.setValue(actual, weight)
            }
            expressionManager.update()
            // mirror morph target influences from original to clone
            if (!morphMirrorInit) initMorphMirror()
            for (const [s, d] of morphPairs) {
              const a = s.morphTargetInfluences
              const b = d.morphTargetInfluences
              if (!a || !b) continue
              const len = Math.min(a.length, b.length)
              for (let j = 0; j < len; j++) b[j] = a[j]
            }
          } else {
            // fallback: apply directly to cloned VRMExpression nodes
            expressionsByName.forEach(expr => expr.clearAppliedWeight())
            for (const [canon, weight] of Object.entries(expressionWeights)) {
              const actual = nameMap[canon] || canon
              const expr = expressionsByName.get(actual)
              if (!expr) continue
              expr.weight = weight
              if (weight > 0) expr.applyWeight({ multiplier: 1.0 })
            }
          }
        }

        // spring bones will also be stepped below every frame (not rate-limited)

        if (loco.gazeDir && distance < MAX_GAZE_DISTANCE && (currentEmote ? currentEmote.gaze : true)) {
          // aimBone('chest', loco.gazeDir, delta, {
          //   minAngle: -90,
          //   maxAngle: 90,
          //   smoothing: 0.7,
          //   weight: 0.7,
          // })
          aimBone('neck', loco.gazeDir, delta, {
            minAngle: -30,
            maxAngle: 30,
            smoothing: 0.4,
            weight: 0.6,
          })
          aimBone('head', loco.gazeDir, delta, {
            minAngle: -30,
            maxAngle: 30,
            smoothing: 0.4,
            weight: 0.6,
          })
        }
        // tvrm.humanoid.update(delta)
        elapsed = 0
      } else {
        skeleton.update = noop
      }

      // Optimized spring bone updates (every frame for fluidity, but optimized)
      if (!springMirrorInit) initSpringMirror()
      if (origVRM && (springPairs.length || drivePairs.length)) {
        // Use pre-allocated objects instead of creating new ones each frame
        vrm.scene.matrix.decompose(_springPos, _springQuat, _springScl)
        origVRM.scene.position.copy(_springPos)
        origVRM.scene.quaternion.copy(_springQuat)
        origVRM.scene.scale.copy(_springScl)
        origVRM.scene.updateMatrixWorld(true)

        // Batch copy clone bone rotations to minimize matrix updates
        const bonesNeedingUpdate = []
        for (const [cloneBone, origBone] of drivePairs) {
          if (origBone && cloneBone) {
            // many VRM spring bones have matrixAutoUpdate=false; force local matrix rebuild
            origBone.quaternion.copy(cloneBone.quaternion)
            origBone.updateMatrix()
            bonesNeedingUpdate.push(origBone)
          }
        }

        // Batch update matrix world operations
        for (const bone of bonesNeedingUpdate) {
          bone.updateMatrixWorld(true)
        }

        // Simple, stable spring bone physics update
        const physicsDelta = Math.min(delta, 0.02) // Clamp to 50fps to prevent instability
        origVRM.update(physicsDelta)

        // Batch mirror spring joints back to clone only
        const clonesNeedingUpdate = []
        for (const [src, dst] of springPairs) {
          if (dst) {
            dst.quaternion.copy(src.quaternion)
            dst.updateMatrix()
            clonesNeedingUpdate.push(dst)
          }
        }

        // Batch update clone matrix world operations
        for (const clone of clonesNeedingUpdate) {
          clone.updateMatrixWorld(true)
        }

        // Update skinned mesh bone matrices only once after all spring updates
        for (const m of skinnedMeshes) {
          THREE.Skeleton.prototype.update.call(m.skeleton)
        }

        // Update bone helpers for debugging visualization
        updateBoneHelpers()
      }
    }

    const aimBone = (() => {
      const smoothedRotations = new Map()
      const normalizedDir = new THREE.Vector3()
      const parentWorldMatrix = new THREE.Matrix4()
      const parentWorldRotationInverse = new THREE.Quaternion()
      const localDir = new THREE.Vector3()
      const currentAimDir = new THREE.Vector3()
      const rot = new THREE.Quaternion()
      const worldUp = new THREE.Vector3()
      const localUp = new THREE.Vector3()
      const rotatedUp = new THREE.Vector3()
      const projectedUp = new THREE.Vector3()
      const upCorrection = new THREE.Quaternion()
      const cross = new THREE.Vector3()
      const targetRotation = new THREE.Quaternion()
      const restToTarget = new THREE.Quaternion()

      return function aimBone(boneName, targetDir, delta, options = {}) {
        // default options
        const {
          aimAxis = AimAxis.NEG_Z,
          upAxis = UpAxis.Y,
          smoothing = 0.3, // smoothing factor (0-1) - reduced for more responsive additive animations
          weight = 1.0,
          maintainOffset = false,
          minAngle = -180,
          maxAngle = 180,
        } = options
        const bone = findBone(boneName)
        const parentBone = glb.userData.vrm.humanoid.humanBones[boneName].node.parent
        if (!bone) return console.warn(`aimBone: missing bone (${boneName})`)
        if (!parentBone) return console.warn(`aimBone: no parent bone`)
        // get or create smoothed state for this bone
        const boneId = bone.uuid
        if (!smoothedRotations.has(boneId)) {
          smoothedRotations.set(boneId, {
            current: bone.quaternion.clone(),
            target: new THREE.Quaternion(),
          })
        }
        const smoothState = smoothedRotations.get(boneId)
        // normalize target direction
        normalizedDir.copy(targetDir).normalize()
        // get parent's world matrix
        parentWorldMatrix.multiplyMatrices(vrm.scene.matrixWorld, parentBone.matrixWorld)
        // extract parent's world rotation
        parentWorldMatrix.decompose(v1, parentWorldRotationInverse, v2)
        parentWorldRotationInverse.invert()
        // convert world direction to parent's local space
        localDir.copy(normalizedDir).applyQuaternion(parentWorldRotationInverse)
        // store initial offset if needed
        if (maintainOffset && !bone.userData.initialRotationOffset) {
          bone.userData.initialRotationOffset = bone.quaternion.clone()
        }
        // calc rotation needed to align aimAxis with localDir
        currentAimDir.copy(aimAxis)
        if (maintainOffset && bone.userData.initialRotationOffset) {
          currentAimDir.applyQuaternion(bone.userData.initialRotationOffset)
        }
        // create rotation
        rot.setFromUnitVectors(aimAxis, localDir)
        // get up direction in parent's local space
        worldUp.copy(upAxis)
        localUp.copy(worldUp).applyQuaternion(parentWorldRotationInverse)
        // apply up axis correction
        rotatedUp.copy(upAxis).applyQuaternion(rot)
        projectedUp.copy(localUp)
        projectedUp.sub(v1.copy(localDir).multiplyScalar(localDir.dot(localUp)))
        projectedUp.normalize()
        if (projectedUp.lengthSq() > 0.001) {
          upCorrection.setFromUnitVectors(rotatedUp, projectedUp)
          const angle = rotatedUp.angleTo(projectedUp)
          cross.crossVectors(rotatedUp, projectedUp)
          if (cross.dot(localDir) < 0) {
            upCorrection.setFromAxisAngle(localDir, -angle)
          } else {
            upCorrection.setFromAxisAngle(localDir, angle)
          }
          rot.premultiply(upCorrection)
        }
        // apply initial offset if maintaining it
        targetRotation.copy(rot)
        if (maintainOffset && bone.userData.initialRotationOffset) {
          targetRotation.multiply(bone.userData.initialRotationOffset)
        }
        // apply angle limits
        if (minAngle > -180 || maxAngle < 180) {
          if (!bone.userData.restRotation) {
            bone.userData.restRotation = bone.quaternion.clone()
          }
          restToTarget.copy(bone.userData.restRotation).invert().multiply(targetRotation)
          const w = restToTarget.w
          const angle = 2 * Math.acos(Math.min(Math.max(w, -1), 1))
          const angleDeg = THREE.MathUtils.radToDeg(angle)
          if (angleDeg > maxAngle || angleDeg < minAngle) {
            const clampedAngleDeg = THREE.MathUtils.clamp(angleDeg, minAngle, maxAngle)
            const clampedAngleRad = THREE.MathUtils.degToRad(clampedAngleDeg)
            const scale = clampedAngleRad / angle
            q1.copy(targetRotation)
            targetRotation.slerpQuaternions(bone.userData.restRotation, q1, scale)
          }
        }
        // apply weight
        if (weight < 1.0) {
          targetRotation.slerp(bone.quaternion, 1.0 - weight)
        }

        // SIMPLIFIED: Filter out lower body bones and apply additive animation
        // With proper delta format, THREE.js handles blending natively

        const boneNameLower = bone.name ? bone.name.toLowerCase() : ''

        // Only filter out lower body bones - allow everything else for weapon poses
        const isLowerBodyBone =
          boneNameLower.includes('leg') ||
          boneNameLower.includes('thigh') ||
          boneNameLower.includes('calf') ||
          boneNameLower.includes('foot') ||
          boneNameLower.includes('toe') ||
          boneNameLower.includes('hip')

        if (isLowerBodyBone) {
          return
        }

        // Apply weight to target rotation
        if (weight < 1.0) {
          targetRotation.slerp(bone.quaternion, 1.0 - weight)
        }

        // Update smooth state and apply to bone
        smoothState.target.copy(targetRotation)
        const hasActiveAdditiveAnimations = currentAdditiveAnims.size > 0
        let configurableSmoothing = smoothing
        let adaptiveSmoothingEnabled = true

        // Look for configuration values passed from weapon apps
        for (const [url, anim] of currentAdditiveAnims) {
          if (anim.configurableSmoothing !== undefined) {
            configurableSmoothing = anim.configurableSmoothing
            adaptiveSmoothingEnabled = anim.adaptiveSmoothing !== false
            break
          }
        }

        // Apply adaptive smoothing if enabled and additive animations are active
        const adaptiveSmoothing =
          hasActiveAdditiveAnimations && adaptiveSmoothingEnabled
            ? Math.min(configurableSmoothing, 0.2)
            : configurableSmoothing

        // Debug logging for smoothing adjustments (1% chance per frame)
        if (Math.random() < 0.01 && hasActiveAdditiveAnimations) {
          console.log(
            `[VRM] Adaptive smoothing: original=${smoothing.toFixed(2)}, configurable=${configurableSmoothing.toFixed(2)}, adaptive=${adaptiveSmoothingEnabled}, final=${adaptiveSmoothing.toFixed(2)}, additiveAnims=${currentAdditiveAnims.size}`
          )
        }

        smoothState.current.slerp(smoothState.target, adaptiveSmoothing)
        // apply smoothed rotation to bone
        bone.quaternion.copy(smoothState.current)
        bone.updateMatrixWorld(true)
      }
    })()

    // position target equivalent of aimBone()
    const aimBoneDir = new THREE.Vector3()
    function aimBoneAt(boneName, targetPos, delta, options = {}) {
      const bone = findBone(boneName)
      if (!bone) return console.warn(`aimBone: missing bone (${boneName})`)
      const boneWorldMatrix = getBoneTransform(boneName)
      const boneWorldPos = v1.setFromMatrixPosition(boneWorldMatrix)
      aimBoneDir.subVectors(targetPos, boneWorldPos).normalize()
      aimBone(boneName, aimBoneDir, delta, options)
    }

    const poses = {}
    function addPose(key, url) {
    // Skip if URL is invalid or undefined
    if (!url || typeof url !== 'string') {
      console.warn('[VRM] Skipping pose with invalid URL:', key, '=', url)
      return
    }
    const pose = {
        loading: false,
        active: false,
        action: null,
        weight: 0,
        target: 0,
        setWeight: value => {
          pose.weight = value
          if (pose.action) {
            pose.action.weight = value
            if (!pose.active) {
              pose.action.reset().fadeIn(0.15).play()
              pose.active = true
            }
          }
        },
        crossFadeTo: (targetPose, duration = 0.15, warp = true) => {
          if (pose.action && targetPose.action && pose.active) {
            pose.action.crossFadeTo(targetPose.action, duration, warp)
            pose.active = false
            targetPose.active = true
          }
        },
        fadeOut: () => {
          pose.weight = 0
          pose.action?.fadeOut(0.15)
          pose.active = false
        },
      }

      const opts = getQueryParams(url)
      const speed = parseFloat(opts.s || 1)
      pose.loading = true

      hooks.loader.load('emote', url).then(emo => {
          console.log('[VRM] Emote loaded:', url)
        const clip = emo.toClip({
          rootToHips,
          version,
          getBoneName,
        })
        pose.action = mixer.clipAction(clip)
        pose.action.timeScale = speed
        pose.action.weight = pose.weight
        pose.action.play()
        pose.loading = false
      }).catch(err => {
        console.error('[VRM] Failed to load emote:', url, err)
        pose.loading = false
      })

      poses[key] = pose
    }
    addPose('idle', Emotes.IDLE)
    addPose('walk', Emotes.WALK)
    addPose('walkLeft', Emotes.WALK_LEFT)
    addPose('walkBack', Emotes.WALK_BACK)
    addPose('walkRight', Emotes.WALK_RIGHT)
    addPose('walkBackLeft', Emotes.WALK_BACK_LEFT)
    addPose('walkBackRight', Emotes.WALK_BACK_RIGHT)
    addPose('run', Emotes.RUN)
    addPose('runLeft', Emotes.RUN_LEFT)
    addPose('runBack', Emotes.RUN_BACK)
    addPose('runRight', Emotes.RUN_RIGHT)
    addPose('runBackLeft', Emotes.RUN_BACK_LEFT)
    addPose('runBackRight', Emotes.RUN_BACK_RIGHT)
    addPose('jump', Emotes.JUMP)
    addPose('fall', Emotes.FALL)
    addPose('fly', Emotes.FLY)
    addPose('talk', Emotes.TALK)
    // Platformer Mechanics Poses
    console.log('[VRM] Adding platformer poses...')
    addPose('grinding', Emotes.GRINDING)
    addPose('climbIdle', Emotes.CLIMB_IDLE)
    addPose('climbUp', Emotes.CLIMB_UP)
    addPose('climbDown', Emotes.CLIMB_DOWN)
    addPose('ledgeHangingIdle', Emotes.LEDGE_HANGING_IDLE)
    addPose('ledgeHangingMoving', Emotes.LEDGE_HANGING_MOVING)
    addPose('airDive', Emotes.AIR_DIVE)
    addPose('wallSlide', Emotes.WALL_SLIDE)
    console.log('[VRM] Platformer poses added. Total poses:', Object.keys(poses).length)
    function clearLocomotion() {
      for (const key in poses) {
        poses[key].fadeOut()
      }
    }
    function updateLocomotion(delta) {
      const { mode, axis } = loco
      // console.log(`[VRM] updateLocomotion called with mode: ${mode}, axis: ${axis.x.toFixed(2)}, ${axis.z.toFixed(2)}`)
      for (const key in poses) {
        poses[key].target = 0
      }
      if (mode === Modes.IDLE) {
        // Check if we have additive animations that should override idle
        const hasAdditiveAnimations = currentAdditiveAnims.size > 0
        let shouldDisableIdle = false

        if (hasAdditiveAnimations) {
          // Check if any additive animation wants to disable engine idle
          for (const [url, anim] of currentAdditiveAnims) {
            if (anim.disableEngineIdle === true) {
              shouldDisableIdle = true
              break
            }
          }
        }

        if (!shouldDisableIdle) {
          poses.idle.target = 1
        } else {
          // Disable engine idle animation when requested by additive animations
          poses.idle.target = 0
        }
      } else if (mode === Modes.WALK || mode === Modes.RUN) {
        const angle = Math.atan2(axis.x, -axis.z)
        const angleDeg = ((angle * 180) / Math.PI + 360) % 360
        const prefix = mode === Modes.RUN ? 'run' : 'walk'
        const forwardKey = prefix // This should be "walk" or "run"
        const leftKey = `${prefix}Left`
        const backKey = `${prefix}Back`
        const rightKey = `${prefix}Right`
        const backLeftKey = `${prefix}BackLeft`
        const backRightKey = `${prefix}BackRight`
        if (axis.length() > 0.01) {
          if (angleDeg >= 337.5 || angleDeg < 22.5) {
            // Pure forward
            poses[forwardKey].target = 1
          } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
            // Forward-right blend
            const blend = (angleDeg - 22.5) / 45
            poses[forwardKey].target = 1 - blend
            poses[rightKey].target = blend
          } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
            // Pure right
            poses[rightKey].target = 1
          } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
            // Back-right diagonal - swap: the file might be named opposite
            poses[backLeftKey].target = 1
          } else if (angleDeg >= 157.5 && angleDeg < 202.5) {
            // Pure back
            poses[backKey].target = 1
          } else if (angleDeg >= 202.5 && angleDeg < 247.5) {
            // Back-left diagonal - swap: the file might be named opposite
            poses[backRightKey].target = 1
          } else if (angleDeg >= 247.5 && angleDeg < 292.5) {
            // Pure left
            poses[leftKey].target = 1
          } else if (angleDeg >= 292.5 && angleDeg < 337.5) {
            // Left-forward blend
            const blend = (angleDeg - 292.5) / 45
            poses[leftKey].target = 1 - blend
            poses[forwardKey].target = blend
          }
        }
      } else if (mode === Modes.JUMP) {
        poses.jump.target = 1
      } else if (mode === Modes.FALL) {
        poses.fall.target = 1
      } else if (mode === Modes.FLY) {
        poses.fly.target = 1
      } else if (mode === Modes.TALK) {
        poses.talk.target = 1
      } else if (mode === Modes.FLIP) {
        // play the dedicated flip emote; locomotion poses will be cleared by setEmote
        // console.log("[VRM] FLIP mode detected, calling setEmote")
        // console.log('[VRM] Triggering FLIP animation')
        setEmote(Emotes.FLIP)
      } else if (mode === Modes.BACKFLIP) {
        // play the dedicated backflip emote for backward double jumps
        // console.log('[VRM] BACKFLIP mode detected, triggering BACKFLIP animation')
        setEmote(Emotes.BACKFLIP)
      }
      // [STRAFE FLIP EMOTES] New strafe flip emotes integrated:
      else if (mode === Modes.SIDEFLIP_LEFT) {
        // play dedicated left strafe flip emote
        // console.log('[VRM] SIDEFLIP_LEFT mode detected, triggering animation')
        setEmote(Emotes.STRAFE_LEFT_FLIP)
      } else if (mode === Modes.SIDEFLIP_RIGHT) {
        // play dedicated right strafe flip emote
        // console.log('[VRM] SIDEFLIP_RIGHT mode detected, triggering animation')
        setEmote(Emotes.STRAFE_RIGHT_FLIP)
      }
      // [STRAFE JUMP EMOTES] New strafe jump emotes:
      else if (mode === Modes.STRAFE_JUMP_LEFT) {
        // play dedicated left strafe jump emote
        // console.log('[VRM DEBUG] Triggering STRAFE_JUMP_LEFT animation → Emote:', Emotes.STRAFE_JUMP_LEFT)
        setEmote(Emotes.STRAFE_JUMP_LEFT)
      } else if (mode === Modes.STRAFE_JUMP_RIGHT) {
        // play dedicated right strafe jump emote
        // console.log('[VRM DEBUG] Triggering STRAFE_JUMP_RIGHT animation → Emote:', Emotes.STRAFE_JUMP_RIGHT)
        setEmote(Emotes.STRAFE_JUMP_RIGHT)
      } else if (mode === Modes.GRINDING) {
        poses.grinding.target = 1
      } else if (mode === Modes.CLIMBING) {
        // Use climbIdle as default, will be overridden by platformer mechanics
        poses.climbIdle.target = 1
      } else if (mode === Modes.LEDGE_HANGING) {
        // Use ledgeHangingIdle as default, will be overridden by platformer mechanics
        poses.ledgeHangingIdle.target = 1
      } else if (mode === Modes.AIR_DIVING) {
        poses.airDive.target = 1
      } else if (mode === Modes.WALL_SLIDING) {
        poses.wallSlide.target = 1
      }
      const lerpSpeed = 16
      for (const key in poses) {
        const pose = poses[key]
        const weight = THREE.MathUtils.lerp(pose.weight, pose.target, 1 - Math.exp(-lerpSpeed * delta))
        pose.setWeight(weight)
      }
    }

    let firstPersonActive = false
    const setFirstPerson = active => {
      if (firstPersonActive === active) return
      const head = findBone('neck')
      head.scale.setScalar(active ? 0 : 1)
      firstPersonActive = active
    }

    // Bone visibility system for debugging
    let bonesVisible = false
    const boneHelpers = new Map()
    const boneLines = new Map()

    const setBonesVisible = visible => {
      if (bonesVisible === visible) return
      bonesVisible = visible

      if (visible) {
        // console.log('[VRM] Showing bone helpers for debugging')
        skeleton.bones.forEach(bone => {
          if (!bone) return

          // Create bone sphere helper if doesn't exist
          if (!boneHelpers.has(bone)) {
            const geometry = new THREE.SphereGeometry(0.03, 6, 4) // Much smaller spheres
            const material = new THREE.MeshBasicMaterial({
              color: 0x00ff00, // Bright green color
              depthTest: false, // Render on top
              depthWrite: false,
              transparent: true,
              opacity: 0.9,
            })
            const helper = new THREE.Mesh(geometry, material)
            helper.matrixAutoUpdate = false
            helper.renderOrder = 9999 // Render last/on top
            boneHelpers.set(bone, helper)
          }

          const helper = boneHelpers.get(bone)
          helper.matrix.copy(bone.matrixWorld)
          helper.visible = true
          vrm.scene.add(helper)

          // Create bone connection lines to parent
          if (bone.parent && bone.parent.isBone && !boneLines.has(bone)) {
            const lineGeometry = new THREE.BufferGeometry()
            const lineMaterial = new THREE.LineBasicMaterial({
              color: 0xffff00, // Yellow lines
              depthTest: false, // Render on top
              depthWrite: false,
              transparent: true,
              opacity: 0.6,
            })
            const line = new THREE.Line(lineGeometry, lineMaterial)
            line.renderOrder = 9998 // Just below spheres
            line.matrixAutoUpdate = false
            boneLines.set(bone, line)
          }

          const line = boneLines.get(bone)
          if (line) {
            // Update line vertices
            const positions = new Float32Array(6) // 2 points * 3 coordinates
            const bonePos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
            const parentPos = new THREE.Vector3().setFromMatrixPosition(bone.parent.matrixWorld)

            positions[0] = parentPos.x
            positions[1] = parentPos.y
            positions[2] = parentPos.z
            positions[3] = bonePos.x
            positions[4] = bonePos.y
            positions[5] = bonePos.z

            line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            line.visible = true
            vrm.scene.add(line)
          }
        })
      } else {
        // console.log('[VRM] Hiding bone helpers')
        boneHelpers.forEach(helper => {
          vrm.scene.remove(helper)
        })
        boneLines.forEach(line => {
          vrm.scene.remove(line)
        })
      }
    }

    // Update bone helpers and lines to follow bones
    const updateBoneHelpers = () => {
      if (!bonesVisible) return

      // Update bone sphere positions
      boneHelpers.forEach((helper, bone) => {
        if (bone && helper) {
          helper.matrix.copy(bone.matrixWorld)
        }
      })

      // Update bone connection lines
      boneLines.forEach((line, bone) => {
        if (bone && line && bone.parent && bone.parent.isBone) {
          const positions = new Float32Array(6)
          const bonePos = new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld)
          const parentPos = new THREE.Vector3().setFromMatrixPosition(bone.parent.matrixWorld)

          positions[0] = parentPos.x
          positions[1] = parentPos.y
          positions[2] = parentPos.z
          positions[3] = bonePos.x
          positions[4] = bonePos.y
          positions[5] = bonePos.z

          line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        }
      })
    }

    return {
      raw: vrm,
      height,
      headToHeight,
      setEmote,
      setAdditiveAnimation(url, options = {}) {
        console.log(`[VRM] setAdditiveAnimation called with url: ${url}, options:`, options)
        if (!url) {
          // Clear all additive animations immediately
          console.log(`[VRM] Clearing all additive animations (${currentAdditiveAnims.size} active)`)
          for (const [animUrl, anim] of currentAdditiveAnims) {
            anim.targetWeight = 0
            anim.fadeSpeed = 1 / (options.fadeDuration || 0.1)
            anim.action.stop()
          }
          currentAdditiveAnims.clear()
          return
        }

        return loadAdditiveAnimation(url, options)
      },
      stopAdditiveAnimation,
      getAdditiveAnimations() {
        return Array.from(currentAdditiveAnims.keys())
      },
      setSpeaking,
      // expression controls
      setExpression,
      setBlinkEnabled(active) {
        blinkingEnabled = !!active
      },
      setFirstPerson,
      setBonesVisible, // Toggle bone visibility for debugging
      update,
      updateRate,
      getBoneTransform,
      setLocomotion,
      // Bone rotation manipulation methods
      addBoneRotation(boneName, euler) {
        // console.log(`[VRM] addBoneRotation called for bone: ${boneName}`)
        if (!skeleton || !skeleton.bones) {
          console.warn('[VRM] No skeleton available for bone rotation')
          return false
        }

        const bone = skeleton.getBoneByName(boneName)
        if (!bone) {
          console.warn(`[VRM] Bone not found: ${boneName}`)
          return false
        }

        // Convert euler to quaternion and apply additive rotation
        const rotationQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(euler.x, euler.y, euler.z))
        bone.quaternion.multiply(rotationQuat)
        bone.updateMatrixWorld()

        // console.log(`[VRM] Applied rotation to bone: ${boneName}`)
        return true
      },
      resetBoneRotation(boneName) {
        // console.log(`[VRM] resetBoneRotation called for bone: ${boneName}`)
        if (!skeleton || !skeleton.bones) {
          console.warn('[VRM] No skeleton available for bone reset')
          return false
        }

        const bone = skeleton.getBoneByName(boneName)
        if (!bone) {
          console.warn(`[VRM] Bone not found: ${boneName}`)
          return false
        }

        // Reset to identity rotation
        bone.quaternion.set(0, 0, 0, 1)
        bone.updateMatrixWorld()

        // console.log(`[VRM] Reset rotation for bone: ${boneName}`)
        return true
      },
      resetAllBoneRotations() {
        // console.log(`[VRM] resetAllBoneRotations called`)
        if (!skeleton || !skeleton.bones) {
          console.warn('[VRM] No skeleton available for bone reset')
          return false
        }

        skeleton.bones.forEach(bone => {
          bone.quaternion.set(0, 0, 0, 1)
          bone.updateMatrixWorld()
        })

        // console.log(`[VRM] Reset all bone rotations`)
        return true
      },
      setVisible(visible) {
        vrm.scene.traverse(o => {
          o.visible = visible
        })
      },
      move(_matrix) {
        matrix.copy(_matrix)
        hooks.octree?.move(sItem)
      },
      disableRateCheck() {
        rateCheck = false
      },
      destroy() {
        // Clean up bone helpers and lines
        boneHelpers.forEach(helper => {
          vrm.scene.remove(helper)
        })
        boneHelpers.clear()

        boneLines.forEach(line => {
          vrm.scene.remove(line)
        })
        boneLines.clear()

        hooks.scene.remove(vrm.scene)
        // world.updater.remove(update)
        hooks.octree?.remove(sItem)
      },
    }
  }
}

function cloneGLB(glb) {
  // returns a shallow clone of the gltf but a deep clone of the scene.
  // uses SkeletonUtils.clone which is the same as Object3D.clone except also clones skinned meshes etc
  return { ...glb, scene: SkeletonUtils.clone(glb.scene) }
}

function getSkinnedMeshes(scene) {
  let meshes = []
  scene.traverse(o => {
    if (o.isSkinnedMesh) {
      meshes.push(o)
    }
  })
  return meshes
}

function createCapsule(radius, height) {
  const fullHeight = radius + height + radius
  const geometry = new THREE.CapsuleGeometry(radius, height)
  geometry.translate(0, fullHeight / 2, 0)
  return geometry
}

let queryParams = {}
function getQueryParams(url) {
  if (!queryParams[url]) {
    // Validate URL before trying to parse it
    if (!url || typeof url !== 'string') {
      console.warn('[VRM] Invalid URL passed to getQueryParams:', url, '(type:', typeof url, ')')
      queryParams[url] = {}
      return queryParams[url]
    }
    try {
      url = new URL(url)
    } catch (e) {
      console.warn('[VRM] Failed to parse URL:', url, 'Error:', e.message)
      queryParams[url] = {}
      return queryParams[url]
    }
    const params = {}
    for (const [key, value] of url.searchParams.entries()) {
      params[key] = value
    }
    queryParams[url] = params
  }
  return queryParams[url]
}
