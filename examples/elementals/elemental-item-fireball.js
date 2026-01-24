const CONFIG = {
  ORB: {
    SIZE: 0.08,
    COLOR: 'red',
    EMISSIVE_INTENSITY: 5,
    START_OFFSET: 0.25,
    RADIUS: 0.1
  },
  PROJECTILE: {
    SCALE: 0.05,
    LIFETIME: 5,
    GRAVITY: 9.81,
    TARGET_DISTANCE: 20,
    LAUNCH_ANGLE: Math.PI / 10
  },
  TIMING: {
    SHOOT_COOLDOWN: 4,
    SHOOT_DELAY: 1,
    ORB_HIDE: 3.5,
    ORB_FADE: 1.5,
    POLL_INTERVAL: 1
  },
  ANIMATION: {
    ORBIT_SPEED: 3,
    BOB_SPEED: 1,
    RADIUS: 0.5,
    BASE_HEIGHT: 1.3,
    BOB_AMP: 0.3,
    LERP_FACTOR: 0.1
  },
  GLB_ANIMATION: {
    DURATION: 1.5
  },
  EXPLOSION: {
    RADIUS: 4,
    COLOR: '#FF4500',
    EMISSIVE: '#B32D00',
    EMISSIVE_INTENSITY: 2,
    OPACITY: 0.5,
    DURATION: 2
  },
  TRAIL: {
    SHAPE: ['point'],
    RATE: 50,
    LIFE: '2',
    SIZE: '0.03~0.05',
    COLOR: 'red',
    BLENDING: 'additive',
    ALPHA_OVER_LIFE: '0,1|1,0',
    SIZE_OVER_LIFE: '0,1|1,0',
    COLOR_OVER_LIFE: '0,#FF0000|0.25,#FF4500|0.5,#FFA500|0.75,#FFD700|1,#FFFF00'
  },
  EXPLOSION_PARTICLES: {
    SHAPE: ['point'],
    DIRECTION: 1,
    SPEED: '1~6',
    RATE: 200,
    ALPHA: '0.3~0.8',
    SIZE: '0.05~0.4',
    ROTATE: '0~360',
    COLOR: '#FF4500',
    BLENDING: 'additive',
    ALPHA_OVER_LIFE: '0,0|0.1,1|0.9,1|1,0',
    SIZE_OVER_LIFE: '0,1|1,0',
    COLOR_OVER_LIFE: '0,#FFFF00|0.25,#FFD700|0.5,#FFA500|0.75,#FF4500|1,#FF0000',
    ROTATE_OVER_LIFE: '0,0~360|1,360~720',
    LIFE: '1~2',
    DURATION: 0.5,
    LOOP: false
  },
  SHOCKWAVE: {
    INITIAL_RADIUS: 1,
    HEIGHT: 0.05,
    MAX_SCALE: 5,
    COLOR: '#FF4500',
    EMISSIVE: '#FFA500',
    EMISSIVE_INTENSITY: 2,
    OPACITY: 0.4,
    DURATION: 2
  }
};

// Step 1: Remove Block (if it exists) and create visual
const block = app.get('Block');
if (block) {
  app.remove(block);
  console.log('[fireball] Removed Block');
}

// Step 2: Create the visual fireball orb
const orb = app.create('prim', {
  type: 'sphere',
  size: [CONFIG.ORB.SIZE],
  color: CONFIG.ORB.COLOR,
  emissive: CONFIG.ORB.COLOR,
  emissiveIntensity: CONFIG.ORB.EMISSIVE_INTENSITY,
  opacity: 1
});

console.log('[fireball] Created orb:', {
  position: orb.position.toArray(),
  color: orb.color,
  emissive: orb.emissive,
  emissiveIntensity: orb.emissiveIntensity,
  opacity: orb.opacity,
  visible: orb.visible,
  size: CONFIG.ORB.SIZE
});

const fire = app.create('particles', {
  shape: ['cone', 0.2, 1, 0],
  direction: 0.2,
  life: '0.5',
  rate: 10,
  alpha: '0.5',
  color: 'red',
  blending: 'additive',
  size: '0.5',
  rotate: '0~360',
  sizeOverLife: '0,0.5|0.3,1|1,0',
  rotateOverLife: '0,0|1,45',
  colorOverLife: '0,red|0.4,orange|0.8,black'
});
fire.position.set(0, 0, 0);
orb.add(fire);

const dotsGroup = app.create('group');
const dots = app.create('particles', {
  shape: ['circle', 0.2, 1],
  direction: 1,
  speed: '1',
  size: '0.02',
  rate: 1,
  life: '2',
  emissive: '100',
  alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
  velocityOrbital: new Vector3(0, 1, 0),
  velocityLinear: new Vector3(0, 0, 0),
  color: CONFIG.ORB.COLOR
});

dots.position.set(0, 0, 0);
dots.quaternion.set(0, 0, 0, 1);
dotsGroup.add(dots);
app.add(orb);
app.add(dotsGroup);
world.attach(orb);
world.attach(dotsGroup);

const originalPos = orb.position.clone().add(new Vector3(0, CONFIG.ORB.RADIUS, 0));

// Step 3: Add pickup action for non-admin players
console.log('[fireball] Creating pickup action...');
const pickupAction = app.create('action', {
  label: 'Pick Up Fireball',
  distance: 3,
  position: [0, 1, 0], // Position 1m above the orb (more visible)
  onTrigger: () => {
    console.log('[fireball] Pickup action triggered!');
    const p = world.getPlayer();
    if (p) {
      // Clear previous holder if any
      if (app.state.heldBy && app.state.heldBy !== p.id) {
        console.log(`[fireball] Clearing previous holder ${app.state.heldBy}`);
        app.send('drop', { playerId: app.state.heldBy });
      }
      // Send 'give' event which elemental-core system handles
      console.log(`[fireball] Sending 'give' event for player ${p.id}`);
      app.send('give', p.id);
    } else {
      console.error('[fireball] No local player found');
    }
  }
});
orb.add(pickupAction);
pickupAction.active = true;
console.log(`[fireball] Pickup action created: active=${pickupAction.active}, distance=${pickupAction.distance}`);

console.log('[fireball] Visual fireball created');

// Step 4: Wrap with elemental item system
createItem(({ player, hooks }) => {
  // Initialize orb state based on whether it's held
  const initiallyHeld = app.state.heldBy === player.id;

  const state = {
    heldBy: app.state.heldBy || null,
    control: null,
    lastShootTime: 0,
    orbVisible: !initiallyHeld, // Hide orb if already held (it will be shown in init)
    lastPollTime: 0,
    animationNode: null,
    shootPending: false,
    shootTimer: 0,
    server: world.isServer ? { projectiles: new Map(), nextId: 0 } : null,
    client: world.isClient ? { projectiles: new Map(), lastSend: 0, sendRate: 1 / 30, explosions: new Map(), nextExplosionId: 0 } : null
  };

  // Set initial visibility
  if (initiallyHeld) {
    orb.opacity = 0;
    orb.emissiveIntensity = 0;
    dots.active = false;
    fire.active = false;
  }

  return {
    loadGLBAnimation() {
      // Only even attempt to load GLB if URL is provided
    if (!world.isClient || !app.props.shootAnimation || !app.props.shootAnimation.url) {
      console.log('[fireball] No shoot animation URL configured, skipping GLB load');
      return;
    }

    console.log(`[fireball] Loading GLB animation from ${app.props.shootAnimation.url}`);

    try {
      // Verify 'glb' node type is available
      if (typeof app.create !== 'function') {
        console.warn('[fireball] app.create not available');
        return;
      }

      // Try to create GLB node with error handling
      const glbNode = app.create('glb', { url: app.props.shootAnimation.url });
      if (glbNode) {
        app.add(glbNode);
        state.animationNode = glbNode;
        console.log('[fireball] Loaded shoot animation GLB successfully');
      } else {
        console.warn('[fireball] Failed to create GLB node');
      }
    } catch (error) {
      console.error('[fireball] Error loading GLB animation:', error.message);
      // Non-fatal error, continue without animation
    }
  },

  applyPlayerAnimation(playerId) {
    if (!app.props.shootAnimation?.url) return;
    try {
      const player = world.getPlayer(playerId);
      if (player) {
        player.applyEffect({
          emote: `${app.props.shootAnimation.url}?l=0`,
          duration: CONFIG.GLB_ANIMATION.DURATION,
          freeze: true,
          turn: false
        });
      }
    } catch (error) {
      console.error('Error playing animation:', error);
    }
  },

  updateOrbVisibility(time) {
    if (!state.orbVisible) {
      const timeSinceShot = time - state.lastShootTime;
      const totalDuration = CONFIG.TIMING.ORB_HIDE + CONFIG.TIMING.ORB_FADE;
      if (timeSinceShot < CONFIG.TIMING.ORB_HIDE) {
        orb.opacity = 0;
        orb.emissiveIntensity = 0;
      } else if (timeSinceShot < totalDuration) {
        const fadeProgress = (timeSinceShot - CONFIG.TIMING.ORB_HIDE) / CONFIG.TIMING.ORB_FADE;
        orb.opacity = fadeProgress;
        orb.emissiveIntensity = fadeProgress * CONFIG.ORB.EMISSIVE_INTENSITY;
      } else {
        state.orbVisible = true;
        orb.opacity = 1;
        orb.emissiveIntensity = CONFIG.ORB.EMISSIVE_INTENSITY;
      }
      if (state.animationNode) state.animationNode.active = state.orbVisible;
    }
  },

  updateNodeTransforms(delta, targetPlayer, isLocal) {
    const time = world.getTime();
    const angle = time * CONFIG.ANIMATION.ORBIT_SPEED;
    const bob = CONFIG.ANIMATION.BOB_AMP * Math.sin(time * CONFIG.ANIMATION.BOB_SPEED);
    const localOffset = new Vector3(
      CONFIG.ANIMATION.RADIUS * Math.cos(angle),
      CONFIG.ANIMATION.BASE_HEIGHT + bob,
      CONFIG.ANIMATION.RADIUS * Math.sin(angle)
    );
    const worldOffset = localOffset.applyQuaternion(targetPlayer.quaternion);
    const newPos = targetPlayer.position.clone().add(worldOffset);
    const newQuat = new Quaternion().setFromEuler(new Euler(0, angle, 0));

    if (isLocal) {
      // For local player, set position directly
      orb.position.copy(newPos);
      orb.quaternion.copy(newQuat);
      dotsGroup.position.copy(newPos);
      dotsGroup.quaternion.copy(newQuat);
      if (state.animationNode) {
        state.animationNode.position.copy(newPos);
        state.animationNode.quaternion.copy(newQuat);
      }
      // Send position update to server periodically
      if (time - state.lastPollTime >= CONFIG.TIMING.POLL_INTERVAL) {
        app.send('updatePos', { playerId: state.heldBy, pos: orb.position.toArray() });
        state.lastPollTime = time;
      }
    } else {
      // For remote players, lerp for smooth movement
      orb.position.lerp(newPos, CONFIG.ANIMATION.LERP_FACTOR);
      orb.quaternion.slerp(newQuat, CONFIG.ANIMATION.LERP_FACTOR);
      dotsGroup.position.lerp(newPos, CONFIG.ANIMATION.LERP_FACTOR);
      dotsGroup.quaternion.slerp(newQuat, CONFIG.ANIMATION.LERP_FACTOR);
      if (state.animationNode) {
        state.animationNode.position.lerp(newPos, CONFIG.ANIMATION.LERP_FACTOR);
        state.animationNode.quaternion.slerp(newQuat, CONFIG.ANIMATION.LERP_FACTOR);
      }
    }

    // Update particle visibility
    dots.active = state.orbVisible;
    fire.active = state.orbVisible;
  },

    client: {
      init() {
        console.log(`[fireball] Client init for player ${player.id}, heldBy=${state.heldBy}, initiallyHeld=${state.heldBy === player.id}`);

        this.loadGLBAnimation();

        if (state.heldBy === player.id) {
          console.log('[fireball] Player already holding fireball at init, making orb visible');
          state.control = app.control();
          state.orbVisible = true;
          orb.opacity = 1;
          orb.emissiveIntensity = CONFIG.ORB.EMISSIVE_INTENSITY;
          dots.active = true;
          fire.active = true;
          if (state.animationNode) state.animationNode.active = true;
          console.log(`[fireball] Orb made visible: opacity=${orb.opacity}, emissive=${orb.emissiveIntensity}`);
        } else {
          console.log('[fireball] Player not holding fireball at init, orb should be hidden');
        }

        app.on('held', id => {
          console.log(`[fireball] Item held by ${id}, local=${player.local}`);
          state.heldBy = id;
          pickupAction.active = false;
          state.orbVisible = true;

          // CRITICAL: Ensure orb is visible
          orb.opacity = 1;
          orb.emissiveIntensity = CONFIG.ORB.EMISSIVE_INTENSITY;
          console.log(`[fireball] Setting orb opacity=${orb.opacity}, emissive=${orb.emissiveIntensity}`);

          dots.active = true;
          fire.active = true;

          if (id === player.id) {
            console.log('[fireball] Local player picked up fireball');
            state.control = app.control();
          }
          if (state.animationNode) state.animationNode.active = true;
        });

        app.on('dropped', ({ position }) => {
          console.log(`[fireball] Client received dropped event`);
          console.log(`[fireball] Dropped position:`, position);
          state.heldBy = null;
          state.orbVisible = true;

          // Return orb to original position
          orb.position.fromArray(position);
          orb.quaternion.set(0, 0, 0, 1);
          console.log(`[fireball] Orb returned to position:`, orb.position.toArray());

          // Reset particle positions
          dotsGroup.position.copy(originalPos);
          dotsGroup.quaternion.set(0, 0, 0, 1);

          // Show particles again
          dots.active = false; // dots off when in world
          fire.active = true;
          console.log(`[fireball] Particles active - dots: ${dots.active}, fire: ${fire.active}`);

          // Release controls
          if (state.control) {
            state.control.release();
            state.control = null;
          }

          // Hide any animation node
          if (state.animationNode) {
            state.animationNode.position.copy(originalPos);
            state.animationNode.quaternion.set(0, 0, 0, 1);
            state.animationNode.active = false;
          }

          // CRITICAL: Re-enable pickup action
          console.log(`[fireball] Reactivating pickup action`);
          pickupAction.active = true;
          console.log(`[fireball] Pickup action active state: ${pickupAction.active}`);
        });

        app.on('orb:position', posArray => {
          if (!state.heldBy) orb.position.fromArray(posArray);
        });

        app.on('projectile:spawn', ({ id, pos, scale, vel }) => {
          console.log(`[fireball] CLIENT received projectile:spawn event for id ${id}`);
          console.log(`[fireball] Projectile data: pos=`, pos, 'scale=', scale, 'vel=', vel);

          const initialPos = new Vector3().fromArray(pos);
          const initialVel = new Vector3().fromArray(vel);

          // Make sure we're creating a visible projectile
          console.log(`[fireball] Creating projectile sphere with size [${scale}]`);
          // Make projectile more visible for testing (bigger and brighter)
          const projectileScale = Math.max(scale, 0.1); // Minimum 0.1 size
          const proj = app.create('prim', {
            type: 'sphere',
            size: [projectileScale],
            position: initialPos,
            color: CONFIG.ORB.COLOR,
            emissive: CONFIG.ORB.COLOR,
            emissiveIntensity: 20, // Much brighter
            opacity: 1
          });

          console.log(`[fireball] Created projectile sphere size [${projectileScale}] at`, initialPos.toArray());
          console.log(`[fireball] Projectile properties: color=${CONFIG.ORB.COLOR}, emissive=${CONFIG.ORB.COLOR}, emissiveIntensity=20, opacity=1`);

          // Create trail particles - ensure they're actively emitting
          const trail = app.create('particles', {
            shape: CONFIG.TRAIL.SHAPE,
            rate: CONFIG.TRAIL.RATE,
            life: CONFIG.TRAIL.LIFE,
            size: CONFIG.TRAIL.SIZE,
            color: CONFIG.TRAIL.COLOR,
            blending: CONFIG.TRAIL.BLENDING,
            alphaOverLife: CONFIG.TRAIL.ALPHA_OVER_LIFE,
            sizeOverLife: CONFIG.TRAIL.SIZE_OVER_LIFE,
            colorOverLife: CONFIG.TRAIL.COLOR_OVER_LIFE,
            emitting: true,
            velocityLinear: new Vector3(0, 0, 0)
          });
          proj.add(trail);
          console.log(`[fireball] Added trail to projectile - emitting=${trail.emitting}`);

          // Ensure trail is actively emitting from the start
          trail.emit();

          world.add(proj);
          console.log(`[fireball] Added projectile to world`);

          state.client.projectiles.set(id, { object: proj, initialPos, vel: initialVel, startTime: world.getTime() });
        });

        app.on('projectile:cleanup', id => {
          console.log(`[fireball] Cleaning up projectile ${id}`);
          const proj = state.client.projectiles.get(id);
          if (proj) {
            console.log(`[fireball] Removing projectile from world`);
            world.remove(proj.object);
            state.client.projectiles.delete(id);
          } else {
            console.log(`[fireball] Projectile ${id} not found for cleanup`);
          }
        });

        app.on('explosion:spawn', ({ position }) => {
          console.log(`[fireball] CLIENT received explosion:spawn event`);
          console.log(`[fireball] Explosion position:`, position);

          const expPos = new Vector3().fromArray(position);
          const id = state.client.nextExplosionId++;

          console.log(`[fireball] Creating explosion at`, position);

          // Create main explosion sphere
          const sphere = app.create('prim', {
            type: 'sphere',
            size: [CONFIG.EXPLOSION.RADIUS],
            position: expPos,
            color: CONFIG.EXPLOSION.COLOR,
            emissive: CONFIG.EXPLOSION.EMISSIVE,
            emissiveIntensity: CONFIG.EXPLOSION.EMISSIVE_INTENSITY,
            opacity: 1
          });
          sphere.scale.set(0, 0, 0);
          world.add(sphere);
          console.log(`[fireball] Created explosion sphere`);

          // Create shockwave ring
          const shockwave = app.create('prim', {
            type: 'sphere',
            size: [CONFIG.SHOCKWAVE.INITIAL_RADIUS],
            position: expPos,
            quaternion: new Quaternion().set(0, 0, 0, 1),
            color: CONFIG.SHOCKWAVE.COLOR,
            emissive: CONFIG.SHOCKWAVE.EMISSIVE,
            emissiveIntensity: CONFIG.SHOCKWAVE.EMISSIVE_INTENSITY,
            opacity: 1
          });
          shockwave.scale.set(0, CONFIG.SHOCKWAVE.HEIGHT / (2 * CONFIG.SHOCKWAVE.INITIAL_RADIUS), 0);
          world.add(shockwave);

          // Create explosion particles
          const particles = app.create('particles', {
            shape: CONFIG.EXPLOSION_PARTICLES.SHAPE,
            direction: CONFIG.EXPLOSION_PARTICLES.DIRECTION,
            speed: CONFIG.EXPLOSION_PARTICLES.SPEED,
            rate: CONFIG.EXPLOSION_PARTICLES.RATE,
            alpha: CONFIG.EXPLOSION_PARTICLES.ALPHA,
            size: CONFIG.EXPLOSION_PARTICLES.SIZE,
            rotate: CONFIG.EXPLOSION_PARTICLES.ROTATE,
            color: CONFIG.EXPLOSION_PARTICLES.COLOR,
            blending: CONFIG.EXPLOSION_PARTICLES.BLENDING,
            alphaOverLife: CONFIG.EXPLOSION_PARTICLES.ALPHA_OVER_LIFE,
            sizeOverLife: CONFIG.EXPLOSION_PARTICLES.SIZE_OVER_LIFE,
            colorOverLife: CONFIG.EXPLOSION_PARTICLES.COLOR_OVER_LIFE,
            rotateOverLife: CONFIG.EXPLOSION_PARTICLES.ROTATE_OVER_LIFE,
            life: CONFIG.EXPLOSION_PARTICLES.LIFE,
            emitting: true,
            duration: CONFIG.EXPLOSION_PARTICLES.DURATION,
            loop: CONFIG.EXPLOSION_PARTICLES.LOOP
          });
          particles.position.copy(expPos);
          world.add(particles);

          // Clean up particles after duration
          setTimeout(() => {
            world.remove(particles);
          }, 2500);

          state.client.explosions.set(id, { sphere, shockwave, startTime: world.getTime() });

          // Apply damage to nearby entities
          console.log(`[fireball] Checking for entities in explosion radius at`, expPos.toArray());
          this.applyExplosionDamage(expPos, CONFIG.EXPLOSION.RADIUS);
        });

        app.on('playAnimation', ({ playerId }) => this.applyPlayerAnimation(playerId));

        app.on('shootTime', ({ time, playerId }) => {
          if (state.heldBy === playerId) {
            state.lastShootTime = time;
            state.orbVisible = false;
          }
        });
      },

      applyExplosionDamage(position, radius) {
          console.log(`[fireball] Applying damage - position:`, position.toArray(), `radius:`, radius);

          // Check all players
          const players = world.getPlayers();
          for (const player of players) {
            const distance = player.position.distanceTo(position);
            if (distance <= radius) {
              const damage = Math.floor((1 - distance / radius) * 50); // 50 max damage at center
              console.log(`[fireball] Player ${player.id} hit for ${damage} damage`);
              // Emit damage event for elemental-combat.js
              app.emit('elemental-item:dmg', [player.id, damage, false]);
            }
          }

          // Check all mobs (elemental-mob instances)
          for (const mobApp of world.apps) {
            if (mobApp.isMob) { // Mob app should set this flag
              const distance = mobApp.position.distanceTo(position);
              if (distance <= radius) {
                const damage = Math.floor((1 - distance / radius) * 50);
                console.log(`[fireball] Mob ${mobApp.instanceId} hit for ${damage} damage`);
                // Emit damage event for mob
                app.emit('elemental-mob:dmg', [mobApp.instanceId, damage, false]);
              }
            }
          }
        },

      update(delta) {
        const time = world.getTime();

        if (state.heldBy === player.id) {
          // Shooting mechanics
          if (state.control.mouseLeft.pressed && time - state.lastShootTime >= CONFIG.TIMING.SHOOT_COOLDOWN && !state.shootPending) {
            console.log('[fireball] Mouse left pressed - starting shoot sequence');
            state.shootPending = true;
            state.shootTimer = time;
            this.applyPlayerAnimation(player.id);
          }
          if (state.shootPending && time - state.shootTimer >= CONFIG.TIMING.SHOOT_DELAY) {
            console.log('[fireball] Shoot delay complete - firing projectile');
            const fwd = new Vector3(0, 0, -1).applyQuaternion(state.control.camera.quaternion);
            const start = orb.position.clone().add(fwd.clone().normalize().multiplyScalar(CONFIG.ORB.START_OFFSET));
            console.log('[fireball] Calling server shoot with position:', start.toArray(), 'forward:', fwd.toArray());
            hooks.call('shoot', { playerId: state.heldBy, position: start.toArray(), forward: fwd.toArray() });
            state.lastShootTime = time;
            state.orbVisible = false;
            state.shootPending = false;
          }

          // Drop with Q key
          if (state.control.keyQ && state.control.keyQ.pressed) {
            console.log(`[fireball] Q pressed, dropping fireball`);
            hooks.call('drop', { playerId: state.heldBy });
            state.shootPending = false;
          }

          this.updateOrbVisibility(time);
        }

        for (const [id, exp] of state.client.explosions.entries()) {
          const timeAlive = world.getTime() - exp.startTime;
          if (timeAlive >= CONFIG.EXPLOSION.DURATION) {
            world.remove(exp.sphere);
            world.remove(exp.shockwave);
            state.client.explosions.delete(id);
          } else {
            const progress = timeAlive / CONFIG.EXPLOSION.DURATION;
            const scaleValue = progress;
            exp.sphere.scale.set(scaleValue, scaleValue, scaleValue);
            exp.sphere.opacity = 1 - progress;
            exp.sphere.emissiveIntensity = CONFIG.EXPLOSION.EMISSIVE_INTENSITY * (1 - progress);

            const shockProgress = timeAlive / CONFIG.SHOCKWAVE.DURATION;
            const shockScale = shockProgress * CONFIG.SHOCKWAVE.MAX_SCALE;
            exp.shockwave.scale.set(shockScale, CONFIG.SHOCKWAVE.HEIGHT / (2 * CONFIG.SHOCKWAVE.INITIAL_RADIUS), shockScale);
            exp.shockwave.opacity = 1 - shockProgress;
            exp.shockwave.emissiveIntensity = CONFIG.SHOCKWAVE.EMISSIVE_INTENSITY * (1 - shockProgress);
          }
        }
      },

      lateUpdate(delta) {
        console.log(`[fireball] lateUpdate: heldBy=${state.heldBy}, player.id=${player.id}, orbVisible=${state.orbVisible}`);

        if (state.heldBy) {
          console.log(`[fireball] Item is held, updating position`);
          const targetPlayer = world.getPlayer(state.heldBy);
          if (targetPlayer) {
            console.log(`[fireball] Found target player, updating transforms`);
            this.updateNodeTransforms(delta, targetPlayer, state.heldBy === player.id);
          } else {
            console.warn(`[fireball] Could not find player ${state.heldBy}`);
          }
        } else {
          orb.position.copy(originalPos);
          orb.quaternion.set(0, 0, 0, 1);
          dotsGroup.position.copy(originalPos);
          dotsGroup.quaternion.set(0, 0, 0, 1);
          dots.active = false;
          fire.active = true;
          if (state.animationNode) {
            state.animationNode.position.copy(originalPos);
            state.animationNode.quaternion.set(0, 0, 0, 1);
            state.animationNode.active = false;
          }
        }

        // Update projectile positions
        for (const proj of state.client.projectiles.values()) {
          const timeAlive = world.getTime() - proj.startTime;
          const gravityVec = new Vector3(0, -CONFIG.PROJECTILE.GRAVITY, 0);
          const displacement = proj.vel.clone().multiplyScalar(timeAlive).add(gravityVec.multiplyScalar(0.5 * timeAlive * timeAlive));
          const newPos = proj.initialPos.clone().add(displacement);
          proj.object.position.copy(newPos);

          // Log projectile position occasionally for debugging
          if (Math.floor(timeAlive * 10) % 50 === 0) { // Log every ~5 seconds of simulation
            console.log(`[fireball] Projectile ${proj} at`, newPos.toArray());
          }
        }
      },

      destroy() {
        if (orb) world.remove(orb);
        if (dotsGroup) world.remove(dotsGroup);
        if (state.animationNode) world.remove(state.animationNode);
        state.control?.release();
      }
    },

    server: {
      init() {
        console.log('[fireball] Server init');
      },

      shoot({ playerId, position, forward }) {
        console.log(`[fireball] Server received shoot from player ${playerId}`);
        if (state.heldBy !== playerId) {
          console.log(`[fireball] Shoot rejected - not held by this player`);
          return;
        }

        const id = state.server.nextId++;
        const pos = new Vector3().fromArray(position);
        const forwardVec = new Vector3().fromArray(forward).normalize();

        const g = CONFIG.PROJECTILE.GRAVITY;
        const d = CONFIG.PROJECTILE.TARGET_DISTANCE;
        const theta = CONFIG.PROJECTILE.LAUNCH_ANGLE;
        const v0 = Math.sqrt(g * d / Math.sin(2 * theta));
        const vel = forwardVec.clone().multiplyScalar(v0 * Math.cos(theta));
        vel.y += v0 * Math.sin(theta);

        console.log(`[fireball] Server spawning projectile ${id} from player ${playerId}`);

        app.send('projectile:spawn', { id, pos: pos.toArray(), scale: CONFIG.PROJECTILE.SCALE, vel: vel.toArray() });
        app.send('playAnimation', { playerId });
        app.send('shootTime', { time: world.getTime(), playerId });

        const vy = vel.y;
        const y = pos.y;
        const lifetime = CONFIG.PROJECTILE.LIFETIME;

        // Calculate when projectile hits ground
        let hitT = lifetime;
        if (y > 0) {
          const discriminant = vy * vy + 2 * g * y;
          if (discriminant >= 0) {
            const sqrtDisc = Math.sqrt(discriminant);
            hitT = Math.min((vy + sqrtDisc) / g, lifetime);
          }
        }

        // Calculate hit position
        const gravityVec = new Vector3(0, -g, 0);
        const displacement = vel.clone().multiplyScalar(hitT).add(gravityVec.clone().multiplyScalar(0.5 * hitT * hitT));
        const hitPos = pos.clone().add(displacement);

        console.log(`[fireball] Projectile will hit at`, hitPos.toArray(), `in ${hitT}s`);

        // Schedule explosion
        const timeout = setTimeout(() => {
          app.send('explosion:spawn', { position: hitPos.toArray() });

          // Apply server-side damage
          applyServerDamage(hitPos, CONFIG.EXPLOSION.RADIUS, playerId);

          app.send('projectile:cleanup', id);
          state.server.projectiles.delete(id);
        }, hitT * 1000);

        state.server.projectiles.set(id, { owner: playerId, timeout });
      },

      applyServerDamage(position, radius, attackerId) {
        console.log(`[fireball] Server applying damage at`, position.toArray(), `radius:`, radius);

        // Apply damage with falloff
        const maxDamage = 50;

        // Check all players
        const players = world.getPlayers();
        for (const player of players) {
          if (player.id === attackerId) continue; // Don't damage self

          const distance = player.position.distanceTo(position);
          if (distance <= radius) {
            const damage = Math.floor((1 - distance / radius) * maxDamage);
            console.log(`[fireball] Damaging player ${player.id} for ${damage}`);
            player.damage(damage);
          }
        }

        // Notify mobs in radius
        app.emit('elemental:explosion', { position: position.toArray(), radius, damage: maxDamage, attackerId });
      },

      drop({ playerId }) {
        if (state.heldBy === playerId) {
          console.log(`[fireball] Dropping fireball from player ${playerId}`);
          state.heldBy = null;
          app.state.heldBy = null;

          // Send drop event to all clients
          app.send('dropped', { position: originalPos.toArray() });
          console.log(`[fireball] Sent dropped event with position`, originalPos.toArray());
        }
      },

      update(delta) {
        const currentTime = world.getTime();
        if (currentTime - state.lastPollTime >= CONFIG.TIMING.POLL_INTERVAL) {
          if (state.heldBy && !world.getPlayers().map(p => p.id).includes(state.heldBy)) {
            state.heldBy = null;
            app.state.heldBy = null;
            orb.position.copy(originalPos);
            app.send('dropped', { position: originalPos.toArray() });
          }
          state.lastPollTime = currentTime;
        }
      },

      destroy() {
        for (const [id, proj] of state.server.projectiles.entries()) {
          clearTimeout(proj.timeout);
        }
        state.server.projectiles.clear();
      }
    }
  };
});

function createItem(createInstance) {
  app.configure([
    { key: 'id', type: 'text', label: 'ID', initial: 'fireball' },
    { key: 'icon', type: 'file', kind: 'texture', label: 'Icon' },
    { key: 'name', type: 'text', label: 'Name', initial: 'Fireball Orb' },
    { key: 'desc', type: 'textarea', label: 'Desc', initial: 'A magical orb that shoots explosive fireballs' },
    { key: 'stack', type: 'number', label: 'Stack', initial: 1 },
    { key: 'droppable', type: 'switch', label: 'Droppable', options: [{ label: 'No', value: false }, { label: 'Yes', value: true }], initial: false },
    { key: 'shootAnimation', type: 'file', kind: 'emote', label: 'Shoot Animation GLB' },
    {
      key: 'give',
      type: 'button',
      label: 'Give to Local Player',
      onClick: () => {
        const p = world.getPlayer();
        app.send('give', p.id);
      }
    }
  ]);

  const id = props.id;
  const icon = props.icon?.url || null;
  const name = props.name || null;
  const desc = props.desc || null;
  const stack = props.stack || 1;
  const droppable = props.droppable;

  if (!id) return console.error(`item does not have an id`);

  let unique = true;
  world.on(`elemental-item:check:${id}`, (instanceId) => {
    if (app.instanceId === instanceId) return;
    app.emit(`elemental-item:check:${id}:reply`);
  });
  world.on(`elemental-item:check:${id}:reply`, () => {
    unique = false;
  });
  app.emit(`elemental-item:check:${id}`, app.instanceId);
  if (!unique) return console.error(`item with id '${id}' exists more than once in the world`);

  if (world.isServer) {
    const state = app.state;
    state.active = new Set();
    state.ready = true;
    state.heldBy = null;
    const instances = new Map();
    app.send('init', state);

    app.on('give', (playerId) => {
      app.emit('elemental-item:give', [playerId, id, 1]);
    });

    world.on(`elemental-shop:request-spec:${id}`, () => {
      app.emit('elemental-item:spec', { id, icon, name, desc, stack });
    });

    world.on('elemental-core:request-specs', () => {
      app.emit('elemental-item:spec', { id, icon, name, desc, stack });
    });

    world.on(`elemental-shop:purchase:${id}`, (playerId) => {
      app.emit('elemental-item:give', [playerId, id, 1]);
    });

    world.on(`elemental-core:activate:${id}`, (playerId) => {
      if (state.active.has(playerId)) {
        return console.warn(`${id} activate: already active`);
      }
      const player = world.getPlayer(playerId);
      if (!player) {
        return console.warn(`${id} activate: player not found`);
      }
      state.active.add(playerId);
      const instance = createInstance({
        player,
        hooks: {
          call(method, data) {
            app.send('call', [playerId, method, data]);
          },
          take(qty) {
            app.emit('elemental-item:take', [playerId, id, qty]);
          },
          damage(player, amount, crit) {
            player.damage(amount);
            app.send('dmg', [player.id, amount, crit]);
            app.emit('health', { playerId: player.id, health: player.health });
          }
        }
      });
      instances.set(playerId, instance);
      instance.server?.init?.();
      app.send('activate', playerId);
      app.send('held', playerId); // Tell client it's held
    });

    world.on(`elemental-core:deactivate:${id}`, (playerId) => {
      if (!state.active.has(playerId)) {
        return console.warn(`${id} deactivate: player not active`);
      }
      state.active.delete(playerId);
      instances.get(playerId).server.destroy?.();
      instances.delete(playerId);
      app.send('deactivate', playerId);
    });

    world.on(`elemental-core:drop:${id}`, (playerId) => {
      if (!droppable) return;
      if (!state.active.has(playerId)) {
        return console.warn(`${id} drop: player not active`);
      }
      app.emit('elemental-item:take', [playerId, id, 1]);
    });

    app.on('call', ([method, data], playerId) => {
      const instance = instances.get(playerId);
      if (!instance) return console.error('[item] instance not found');
      instance.server?.[method]?.(data);
    });

    world.on('leave', (e) => {
      if (!state.active.has(e.playerId)) return;
      state.active.delete(e.playerId);
      instances.get(e.playerId).server.destroy?.();
      instances.delete(e.playerId);
      app.send('deactivate', e.playerId);
    });

    app.on('fixedUpdate', (delta) => {
      instances.forEach((instance) => instance.server?.fixedUpdate?.(delta));
    });

    app.on('update', (delta) => {
      instances.forEach((instance) => instance.server?.update?.(delta));
    });

    app.on('lateUpdate', (delta) => {
      instances.forEach((instance) => instance.server?.lateUpdate?.(delta));
    });

    app.emit('elemental-item:spec', { id, icon, name, desc, stack });
  }

  if (world.isClient) {
    const localPlayer = world.getPlayer();

    let state = app.state;

    if (state.ready) {
      init(state);
    } else {
      app.on('init', init);
    }

    function init(_state) {
      state = _state;
      const instances = new Map();

      const activate = (playerId) => {
        const player = world.getPlayer(playerId);
        const instance = createInstance({
          player,
          hooks: {
            call(method, data) {
              app.send('call', [method, data]);
            },
            take(qty) {
              console.error('[item] hooks.take() not available on client');
            },
            damage(player, amount, crit) {
              console.error('[item] hooks.damage() not available on client');
            }
          }
        });
        instances.set(playerId, instance);
        instance.client?.init?.();
      };

      for (const playerId of state.active) {
        activate(playerId);
      }

      app.on('activate', (playerId) => {
        activate(playerId);
      });

      app.on('call', ([playerId, method, data]) => {
        const instance = instances.get(playerId);
        if (!instance) return console.error('[item] instance not found');
        instance.client?.[method]?.(data);
      });

      app.on('deactivate', (playerId) => {
        const instance = instances.get(playerId);
        instance.client?.destroy?.();
        instances.delete(playerId);
      });

      app.on('fixedUpdate', (delta) => {
        instances.forEach((instance) => instance.client?.fixedUpdate?.(delta));
      });

      app.on('update', (delta) => {
        instances.forEach((instance) => instance.client?.update?.(delta));
      });

      app.on('lateUpdate', (delta) => {
        instances.forEach((instance) => instance.client?.lateUpdate?.(delta));
      });
    }
  }
}
