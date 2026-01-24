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

const state = {
  heldBy: app.state.heldBy || null,
  control: null,
  lastShootTime: 0,
  orbVisible: true,
  originalPos: new Vector3(),
  lastPollTime: 0,
  animationNode: null,
  shootPending: false,
  shootTimer: 0,
  dotsGroup: null,
  server: world.isServer ? { projectiles: new Map(), nextId: 0 } : null,
  client: world.isClient ? { projectiles: new Map(), lastSend: 0, sendRate: 1 / 30, explosions: new Map(), nextExplosionId: 0 } : null
};

function initializeOrbAndParticles() {
  app.remove(app.get('Block'));
  app.configure([
    { key: 'shootAnimation', type: 'file', kind: 'emote', label: 'Shoot Animation GLB' }
  ]);

  const orb = app.create('prim', {
    type: 'sphere',
    size: [CONFIG.ORB.SIZE],
    color: CONFIG.ORB.COLOR,
    emissive: CONFIG.ORB.COLOR,
    emissiveIntensity: CONFIG.ORB.EMISSIVE_INTENSITY,
    opacity: 1
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

  state.originalPos.copy(orb.position).add(new Vector3(0, CONFIG.ORB.RADIUS, 0));
  state.dotsGroup = dotsGroup;

  return { orb, dots, fire };
}

const { orb, dots, fire } = initializeOrbAndParticles();

function loadGLBAnimation() {
  if (!world.isClient || !app.props.shootAnimation?.url) return;

  try {
    const glbNode = app.create('glb', { url: app.props.shootAnimation.url });
    app.add(glbNode);
    state.animationNode = glbNode;
  } catch (error) {
    console.error('Error loading GLB:', error);
  }
}

function setupPickupAction() {
  const pickupAction = app.create('action', {
    label: 'Pick Up',
    onTrigger: () => app.send('pickup', world.getPlayer().id)
  });
  orb.add(pickupAction);
  pickupAction.active = !state.heldBy;
  return pickupAction;
}

const pickupAction = setupPickupAction();

function applyPlayerAnimation(playerId) {
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
}

function updateOrbVisibility(time) {
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
}

function updateNodeTransforms(delta, player, isLocal) {
  const time = world.getTime();
  const angle = time * CONFIG.ANIMATION.ORBIT_SPEED;
  const bob = CONFIG.ANIMATION.BOB_AMP * Math.sin(time * CONFIG.ANIMATION.BOB_SPEED);
  const localOffset = new Vector3(
    CONFIG.ANIMATION.RADIUS * Math.cos(angle),
    CONFIG.ANIMATION.BASE_HEIGHT + bob,
    CONFIG.ANIMATION.RADIUS * Math.sin(angle)
  );
  const worldOffset = localOffset.applyQuaternion(player.quaternion);
  const newPos = player.position.clone().add(worldOffset);
  const newQuat = new Quaternion().setFromEuler(new Euler(0, angle, 0));

  if (isLocal) {
    orb.position.copy(newPos);
    orb.quaternion.copy(newQuat);
    state.dotsGroup.position.copy(newPos);
    state.dotsGroup.quaternion.copy(newQuat);
    if (state.animationNode) {
      state.animationNode.position.copy(newPos);
      state.animationNode.quaternion.copy(newQuat);
    }
    if (time - state.client.lastSend >= state.client.sendRate) {
      app.send('updatePos', { playerId: state.heldBy, pos: orb.position.toArray() });
      state.client.lastSend = time;
    }
  } else {
    orb.position.lerp(newPos, CONFIG.ANIMATION.LERP_FACTOR);
    orb.quaternion.slerp(newQuat, CONFIG.ANIMATION.LERP_FACTOR);
    state.dotsGroup.position.lerp(newPos, CONFIG.ANIMATION.LERP_FACTOR);
    state.dotsGroup.quaternion.slerp(newQuat, CONFIG.ANIMATION.LERP_FACTOR);
    if (state.animationNode) {
      state.animationNode.position.lerp(newPos, CONFIG.ANIMATION.LERP_FACTOR);
      state.animationNode.quaternion.slerp(newQuat, CONFIG.ANIMATION.LERP_FACTOR);
    }
  }
  dots.active = state.orbVisible;
  fire.active = state.orbVisible;
}

function setupServerLogic() {
  if (!world.isServer) return;

  world.on('leave', player => {
    if (state.heldBy === player.id) {
      state.heldBy = null;
      app.state.heldBy = null;
      orb.position.copy(state.originalPos);
      app.send('dropped', { position: state.originalPos.toArray() });
    }
    for (const [id, proj] of state.server.projectiles.entries()) {
      if (proj.owner === player.id) {
        clearTimeout(proj.timeout);
        app.send('projectile:cleanup', id);
        state.server.projectiles.delete(id);
      }
    }
  });

  app.on('pickup', id => {
    if (!state.heldBy) {
      state.heldBy = id;
      app.state.heldBy = id;
      app.send('held', id);
    }
  });

  app.on('drop', ({ playerId }) => {
    if (state.heldBy === playerId) {
      state.heldBy = null;
      app.state.heldBy = null;
      orb.position.copy(state.originalPos);
      app.send('dropped', { position: state.originalPos.toArray() });
    }
  });

  app.on('shoot', ({ playerId, position, forward }) => {
    if (state.heldBy === playerId) {
      const id = state.server.nextId++;
      const pos = new Vector3().fromArray(position);
      const forwardVec = new Vector3().fromArray(forward).normalize();
      
      const g = CONFIG.PROJECTILE.GRAVITY;
      const d = CONFIG.PROJECTILE.TARGET_DISTANCE;
      const theta = CONFIG.PROJECTILE.LAUNCH_ANGLE;
      const v0 = Math.sqrt(g * d / Math.sin(2 * theta));
      const vel = forwardVec.clone().multiplyScalar(v0 * Math.cos(theta));
      vel.y += v0 * Math.sin(theta);

      app.send('projectile:spawn', { id, pos: pos.toArray(), scale: CONFIG.PROJECTILE.SCALE, vel: vel.toArray() });
      app.send('playAnimation', { playerId });
      app.send('shootTime', { time: world.getTime(), playerId });

      const vy = vel.y;
      const y = pos.y;
      const lifetime = CONFIG.PROJECTILE.LIFETIME;

      let timeout;
      if (y <= 0) {
        app.send('explosion:spawn', { position: pos.toArray() });
        world.send('orb_explosion', { position: pos.toArray() });
        app.send('projectile:cleanup', id);
        return;
      }

      const discriminant = vy * vy + 2 * g * y;
      if (discriminant < 0) {
        timeout = setTimeout(() => {
          app.send('projectile:cleanup', id);
          state.server.projectiles.delete(id);
        }, lifetime * 1000);
      } else {
        const sqrtDisc = Math.sqrt(discriminant);
        const hitT = (vy + sqrtDisc) / g;

        if (hitT < lifetime) {
          const gravityVec = new Vector3(0, -g, 0);
          const displacement = vel.clone().multiplyScalar(hitT).add(gravityVec.clone().multiplyScalar(0.5 * hitT * hitT));
          const hitPos = pos.clone().add(displacement);
          timeout = setTimeout(() => {
            app.send('explosion:spawn', { position: hitPos.toArray() });
            world.send('orb_explosion', { position: hitPos.toArray() });
            app.send('projectile:cleanup', id);
            state.server.projectiles.delete(id);
          }, hitT * 1000);
        } else {
          timeout = setTimeout(() => {
            app.send('projectile:cleanup', id);
            state.server.projectiles.delete(id);
          }, lifetime * 1000);
        }
      }

      state.server.projectiles.set(id, { owner: playerId, timeout });
    }
  });

  app.on('update', delta => {
    const currentTime = world.getTime();
    if (currentTime - state.lastPollTime >= CONFIG.TIMING.POLL_INTERVAL) {
      if (state.heldBy && !world.getPlayers().map(p => p.id).includes(state.heldBy)) {
        state.heldBy = null;
        app.state.heldBy = null;
        orb.position.copy(state.originalPos);
        app.send('dropped', { position: state.originalPos.toArray() });
      }
      state.lastPollTime = currentTime;
    }
  });

  app.on('updatePos', ({ playerId, pos }) => {
    if (state.heldBy === playerId) {
      orb.position.fromArray(pos);
      app.send('orb:position', orb.position.toArray());
    }
  });
}

function setupClientLogic() {
  if (!world.isServer) {
    loadGLBAnimation();

    if (state.heldBy === world.getPlayer().id) {
      state.control = app.control();
    }

    app.on('held', id => {
      state.heldBy = id;
      pickupAction.active = false;
      state.orbVisible = true;
      orb.opacity = 1;
      orb.emissiveIntensity = CONFIG.ORB.EMISSIVE_INTENSITY;
      dots.active = true;
      fire.active = true;
      if (id === world.getPlayer().id) {
        state.control = app.control();
      }
      if (state.animationNode) state.animationNode.active = true;
    });

    app.on('dropped', ({ position }) => {
      state.heldBy = null;
      pickupAction.active = true;
      state.orbVisible = true;
      orb.opacity = 1;
      orb.emissiveIntensity = CONFIG.ORB.EMISSIVE_INTENSITY;
      orb.position.fromArray(position);
      state.dotsGroup.position.copy(state.originalPos);
      state.dotsGroup.quaternion.set(0, 0, 0, 1);
      dots.active = false;
      fire.active = true;
      if (state.control) {
        state.control.release();
        state.control = null;
      }
      if (state.animationNode) state.animationNode.active = false;
    });

    app.on('orb:position', posArray => {
      if (!state.heldBy) orb.position.fromArray(posArray);
    });

    app.on('projectile:spawn', ({ id, pos, scale, vel }) => {
      const initialPos = new Vector3().fromArray(pos);
      const initialVel = new Vector3().fromArray(vel);
      const proj = app.create('prim', {
        type: 'sphere',
        size: [scale],
        position: initialPos,
        color: CONFIG.ORB.COLOR,
        emissive: CONFIG.ORB.COLOR,
        emissiveIntensity: CONFIG.ORB.EMISSIVE_INTENSITY
      });

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

      world.add(proj);
      state.client.projectiles.set(id, { object: proj, initialPos, vel: initialVel, startTime: world.getTime() });
    });

    app.on('projectile:cleanup', id => {
      const proj = state.client.projectiles.get(id);
      if (proj) {
        world.remove(proj.object);
        state.client.projectiles.delete(id);
      }
    });

    app.on('explosion:spawn', ({ position }) => {
      const expPos = new Vector3().fromArray(position);
      const id = state.client.nextExplosionId++;
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
      setTimeout(() => {
        world.remove(particles);
      }, 2500);

      state.client.explosions.set(id, { sphere, shockwave, startTime: world.getTime() });
    });

    app.on('playAnimation', ({ playerId }) => applyPlayerAnimation(playerId));

    app.on('shootTime', ({ time, playerId }) => {
      if (state.heldBy === playerId) {
        state.lastShootTime = time;
        state.orbVisible = false;
      }
    });

    app.on('update', delta => {
      const time = world.getTime();

      if (state.heldBy === world.getPlayer().id) {
        if (state.control.mouseLeft.pressed && time - state.lastShootTime >= CONFIG.TIMING.SHOOT_COOLDOWN && !state.shootPending) {
          state.shootPending = true;
          state.shootTimer = time;
          applyPlayerAnimation(world.getPlayer().id);
        }
        if (state.shootPending && time - state.shootTimer >= CONFIG.TIMING.SHOOT_DELAY) {
          const fwd = new Vector3(0, 0, -1).applyQuaternion(state.control.camera.quaternion);
          const start = orb.position.clone().add(fwd.clone().normalize().multiplyScalar(CONFIG.ORB.START_OFFSET));
          app.send('shoot', { playerId: state.heldBy, position: start.toArray(), forward: fwd.toArray() });
          state.lastShootTime = time;
          state.orbVisible = false;
          state.shootPending = false;
        }

        if (state.control.keyX.pressed) {
          app.send('drop', { playerId: state.heldBy });
          state.shootPending = false;
        }
      }

      updateOrbVisibility(time);

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
    });

    app.on('lateUpdate', delta => {
      if (state.heldBy) {
        const player = world.getPlayer(state.heldBy);
        if (player) {
          updateNodeTransforms(delta, player, state.heldBy === world.getPlayer().id);
        }
      } else {
        orb.position.copy(state.originalPos);
        orb.quaternion.set(0, 0, 0, 1);
        state.dotsGroup.position.copy(state.originalPos);
        state.dotsGroup.quaternion.set(0, 0, 0, 1);
        dots.active = false;
        fire.active = true;
        if (state.animationNode) {
          state.animationNode.position.copy(state.originalPos);
          state.animationNode.quaternion.set(0, 0, 0, 1);
          state.animationNode.active = false;
        }
      }

      for (const proj of state.client.projectiles.values()) {
        const timeAlive = world.getTime() - proj.startTime;
        const gravityVec = new Vector3(0, -CONFIG.PROJECTILE.GRAVITY, 0);
        const displacement = proj.vel.clone().multiplyScalar(timeAlive).add(gravityVec.multiplyScalar(0.5 * timeAlive * timeAlive));
        proj.object.position.copy(proj.initialPos).add(displacement);
      }
    });
  }
}

setupServerLogic();
setupClientLogic();