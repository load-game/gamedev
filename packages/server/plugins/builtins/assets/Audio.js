export default (world, app, fetch, props, setTimeout) => {
  app.configure([
    {
      type: 'toggle',
      key: 'showBox',
      label: 'Show Box',
      initial: false,
    },
    {
      type: 'file',
      key: 'audio',
      label: 'Audio File',
      kind: 'audio',
    },
    {
      type: 'toggle',
      key: 'autoplay',
      label: 'Autoplay',
      initial: false,
    },
    {
      type: 'range',
      key: 'volume',
      label: 'Volume',
      min: 0,
      max: 1,
      step: 0.05,
      initial: 1,
    },
    {
      type: 'toggle',
      key: 'loop',
      label: 'Loop',
      initial: false,
    },
    {
      type: 'switch',
      key: 'group',
      label: 'Audio Group',
      options: [
        { label: 'Music', value: 'music' },
        { label: 'SFX', value: 'sfx' },
      ],
      initial: 'music',
    },
    {
      type: 'toggle',
      key: 'spatial',
      label: 'Spatial Audio',
      initial: true,
    },
    {
      type: 'switch',
      key: 'distanceModel',
      label: 'Distance Model',
      options: [
        { label: 'Linear', value: 'linear' },
        { label: 'Inverse', value: 'inverse' },
        { label: 'Exponential', value: 'exponential' },
      ],
      initial: 'inverse',
    },
    {
      type: 'number',
      key: 'refDistance',
      label: 'Ref Distance',
      dp: 1,
      min: 0,
      initial: 1,
    },
    {
      type: 'number',
      key: 'maxDistance',
      label: 'Max Distance',
      dp: 1,
      min: 0,
      initial: 40,
    },
    {
      type: 'number',
      key: 'rolloffFactor',
      label: 'Rolloff Factor',
      dp: 2,
      min: 0,
      initial: 3,
    },
  ])

  const audio = app.create('audio', {
    src: props.audio?.url ?? null,
    volume: props.volume ?? 1,
    loop: props.loop ?? false,
    group: props.group ?? 'music',
    spatial: props.spatial ?? true,
    distanceModel: props.distanceModel ?? 'inverse',
    refDistance: props.refDistance ?? 1,
    maxDistance: props.maxDistance ?? 40,
    rolloffFactor: props.rolloffFactor ?? 3,
  })
  const mesh = app.get('Block')
  if (mesh) {
    mesh.active = props.showBox ?? false
  }

  app.add(audio)

  if (props.autoplay && props.audio?.url) {
    audio.play()
  }
}
