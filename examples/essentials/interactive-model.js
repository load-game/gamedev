app.configure([
  {
    key: 'url',
    type: 'text',
    label: 'URL',
    initial: '',
    placeholder: 'https://example.com',
    description: 'The URL to open when clicked (opens in new tab)'
  },
  {
    key: 'uiText',
    type: 'text',
    label: 'UI Text',
    initial: 'Click to learn more',
    placeholder: 'Click to learn more',
    description: 'Text displayed above the model when nearby'
  },
  {
    key: 'actionDistance',
    type: 'number',
    label: 'Action Distance',
    initial: 3,
    min: 0.5,
    max: 20,
    dp: 1,
    description: 'Distance in meters at which the action becomes available'
  },
  {
    key: 'uiYOffset',
    type: 'number',
    label: 'UI Y Offset',
    initial: 1.5,
    min: 0,
    max: 10,
    dp: 2,
    description: 'Vertical offset for UI above the model'
  },
  {
    key: 'uiFontSize',
    type: 'number',
    label: 'UI Font Size',
    initial: 18,
    min: 10,
    max: 50,
    description: 'Font size of the UI text'
  },
  {
    key: 'uiFontColor',
    type: 'text',
    label: 'UI Font Color',
    initial: 'white',
    placeholder: 'white, #FFFFFF, etc.',
    description: 'Color of the UI text'
  }
])

if (world.isClient) {
  // Create action node for proximity detection and click handling
  const action = app.create('action', {
    distance: props.actionDistance || 3,
    onTrigger: () => {
      if (props.url) {
        world.open(props.url, true) // Open in new tab
      }
    }
  })
  action.position.y = props.uiYOffset || 1.5
  app.add(action)

  // Create UI container positioned above the model
  const ui = app.create('ui', {
    billboard: 'y',
    position: [0, props.uiYOffset || 1.5, 0],
    backgroundColor: 'transparent',
    width: 200,
    height: 60,
    padding: 10
  })

  // Create text label
  const label = app.create('uitext', {
    value: props.uiText || 'Click to learn more',
    fontSize: props.uiFontSize || 18,
    color: props.uiFontColor || 'white',
    textAlign: 'center'
  })

  ui.add(label)
  app.add(ui)

  // Sync UI visibility with action active state
  app.on('update', () => {
    if (ui && action) {
      ui.active = action.active
    }
  })
}

