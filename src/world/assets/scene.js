export default (world, app, fetch, props, setTimeout) => {
  app.get('Block').active = false
  app.configure(() => {
    return [
      {
        key: 'sky',
        label: 'Sky',
        type: 'file',
        kind: 'texture',
        hint: 'The image to use as the background.',
      },
      {
        key: 'hdr',
        label: 'HDR',
        type: 'file',
        kind: 'hdr',
        hint: 'The HDRI to use for reflections and lighting.',
      },
      {
        key: 'rotationY',
        label: 'Rotation',
        type: 'number',
        step: 10,
        bigStep: 50,
      },
      {
        key: '002',
        type: 'section',
        label: 'Sun',
      },
      {
        key: 'horizontalRotation',
        label: 'Direction',
        type: 'number',
        min: 0,
        max: 360,
        step: 10,
        bigStep: 50,
        initial: 0,
        dp: 0,
        hint: 'The direction of the sun in degrees',
      },
      {
        key: 'verticalRotation',
        label: 'Elevation',
        type: 'number',
        min: 0,
        max: 360,
        step: 10,
        bigStep: 50,
        initial: 0,
        dp: 0,
        hint: 'The elevation of the sun in degrees',
      },
      {
        key: 'intensity',
        label: 'Intensity',
        type: 'number',
        min: 0,
        max: 10,
        step: 0.1,
        initial: 1,
        dp: 1,
      },
      {
        key: '003',
        type: 'section',
        label: 'Fog',
      },
      {
        key: 'fogColor',
        label: 'Color',
        type: 'text',
        hint: 'The fog color. Leave blank to disable fog',
      },
      {
        key: 'fogNear',
        label: 'Near',
        type: 'number',
        dp: 0,
        min: 0,
        step: 10,
        initial: 0,
        hint: 'The near distance for fog in metres',
      },
      {
        key: 'fogFar',
        label: 'Far',
        type: 'number',
        dp: 0,
        min: 0,
        step: 10,
        initial: 1000,
        hint: 'The far distance for fog in metres',
      },
    ]
  })

  const sky = app.create('sky')

  sky.bg = app.config.sky?.url
  sky.hdr = app.config.hdr?.url
  sky.rotationY = app.config.rotationY * -DEG2RAD

  sky.shader = `
    float y = direction.y;
    float t = clamp(0.5 + 0.5 * y, 0.0, 1.0);

    vec3 nightLow = vec3(0.01, 0.01, 0.03);
    vec3 nightMid = vec3(0.02, 0.02, 0.08);
    vec3 nightHigh = vec3(0.0, 0.0, 0.04);
    vec3 base = mix(nightLow, mix(nightMid, nightHigh, t), t);

    float angle = atan(direction.x, direction.z);

    float wave1 = sin(angle * 3.0 + uTime * 0.15) * 0.5 + 0.5;
    float wave2 = sin(angle * 5.0 - uTime * 0.1 + 1.5) * 0.5 + 0.5;
    float wave3 = sin(angle * 7.0 + uTime * 0.08 + 3.0) * 0.5 + 0.5;

    float curtain = wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2;

    float band = smoothstep(0.15, 0.4, y) * smoothstep(0.85, 0.5, y);
    float shimmer = sin(angle * 20.0 + y * 30.0 + uTime * 0.5) * 0.5 + 0.5;
    float auroraShape = band * curtain * (0.7 + 0.3 * shimmer);

    vec3 green = vec3(0.1, 0.9, 0.3);
    vec3 teal = vec3(0.0, 0.7, 0.7);
    vec3 purple = vec3(0.4, 0.1, 0.8);
    vec3 pink = vec3(0.7, 0.1, 0.5);

    float colorMix = sin(angle * 2.0 + uTime * 0.12) * 0.5 + 0.5;
    float colorMix2 = sin(angle * 3.5 - uTime * 0.07 + 2.0) * 0.5 + 0.5;
    vec3 auroraColor = mix(mix(green, teal, colorMix), mix(purple, pink, colorMix2), smoothstep(0.3, 0.7, y));

    vec3 aurora = auroraColor * auroraShape * 1.5;

    float stars = 0.0;
    vec3 starDir = normalize(direction);
    float sx = atan(starDir.x, starDir.z) * 50.0;
    float sy = starDir.y * 100.0;
    float cell = floor(sx) * 137.0 + floor(sy) * 241.0;
    float starRand = fract(sin(cell) * 43758.5453);
    if (starRand > 0.97) {
      float fx = fract(sx) - 0.5;
      float fy = fract(sy) - 0.5;
      float dist = fx * fx + fy * fy;
      float twinkle = sin(uTime * (2.0 + starRand * 4.0) + starRand * 6.28) * 0.4 + 0.6;
      stars = smoothstep(0.02, 0.0, dist) * twinkle * step(0.0, y);
    }

    color = base + aurora + vec3(stars);
  `

  const sunDirection = calculateSunDirection(app.config.verticalRotation || 0, app.config.horizontalRotation || 0)
  sky.sunDirection = sunDirection
  sky.sunIntensity = app.config.intensity

  sky.fogNear = app.config.fogNear
  sky.fogFar = app.config.fogFar
  sky.fogColor = app.config.fogColor

  app.add(sky)

  // Create large opaque checkered floor (about 10x larger)
  const floorGroup = app.create('group')
  const tileSize = 12.5
  const gridCount = 10
  const start = -(gridCount * tileSize) / 2 + tileSize / 2
  for (let x = 0; x < gridCount; x++) {
    for (let z = 0; z < gridCount; z++) {
      const isDark = (x + z) % 2 === 0
      const tile = app.create('prim', {
        type: 'box',
        size: [tileSize, 0.1, tileSize],
        position: [start + x * tileSize, -0.05, start + z * tileSize],
        color: isDark ? '#111111' : '#444444',
        roughness: 0.6,
        physics: 'static',
        receiveShadow: true,
        castShadow: false,
      })
      floorGroup.add(tile)
    }
  }
  app.add(floorGroup)

  function calculateSunDirection(verticalDegrees, horizontalDegrees) {
    const verticalRad = verticalDegrees * DEG2RAD
    const horizontalRad = horizontalDegrees * DEG2RAD
    const x = Math.sin(verticalRad) * Math.sin(horizontalRad)
    const y = -Math.cos(verticalRad) // Negative because 0° should point down
    const z = Math.sin(verticalRad) * Math.cos(horizontalRad)
    return new Vector3(x, y, z)
  }
}
