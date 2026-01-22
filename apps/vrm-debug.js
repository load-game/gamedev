// VRM Debug Tool
// Add this app to your world to debug VRM expression issues

export default function vrmDebug(world, node) {
  const app = world.getApp(node)

  app.configure([
    {
      key: 'avatarEntity',
      type: 'text',
      label: 'Avatar Entity Name',
      initial: 'avatar',
    },
    {
      key: 'debugBones',
      type: 'switch',
      label: 'Debug Bone Visibility',
      options: [
        { label: 'Enabled', value: 'enabled' },
        { label: 'Disabled', value: 'disabled' },
      ],
      initial: 'disabled',
    },
    {
      key: 'testMode',
      type: 'switch',
      label: 'Test Mode',
      options: [
        { label: 'Auto', value: 'auto' },
        { label: 'Manual', value: 'manual' },
      ],
      initial: 'auto',
    },
  ])

  let avatar = null
  let vrmApi = null
  let debugUI = null
  let statusTexts = {}
  let testInterval = null

  // Create debug UI
  const createDebugUI = () => {
    if (debugUI) return

    debugUI = app.create('ui', {
      space: 'screen',
      position: [0.1, 0.1, 0],
      width: 400,
      height: 300,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
    })

    // Title
    const title = app.create('uitext', {
      value: 'VRM Debug Tool',
      color: '#00ff00',
      fontSize: 18,
      height: 30,
      position: [10, 10, 0],
    })
    debugUI.add(title)

    // Status lines
    const statusItems = [
      { key: 'detected', label: '✓ Expressions detected', y: 50 },
      { key: 'enabled', label: '✓ Expressions enabled', y: 75 },
      { key: 'blinking', label: '✓ Auto-blink enabled', y: 100 },
      { key: 'expressionManager', label: '✗ No expressionManager', y: 125 },
      { key: 'expressionNodes', label: '✗ No expression nodes', y: 150 },
    ]

    statusItems.forEach(item => {
      const text = app.create('uitext', {
        value: item.label,
        color: '#cccccc',
        fontSize: 14,
        height: 20,
        position: [10, item.y, 0],
      })
      statusTexts[item.key] = text
      debugUI.add(text)
    })

    // Controls
    const controlsY = 180
    const testBlinkBtn = app.create('uibutton', {
      label: 'Test Blink',
      width: 120,
      height: 30,
      position: [10, controlsY, 0],
      backgroundColor: '#4444ff',
      onClick: () => {
        if (vrmApi) {
          vrmApi.setExpression('blink', 1)
          setTimeout(() => vrmApi.setExpression('blink', 0), 200)
        }
      },
    })

    const testMouthBtn = app.create('uibutton', {
      label: 'Test Mouth',
      width: 120,
      height: 30,
      position: [140, controlsY, 0],
      backgroundColor: '#ff4444',
      onClick: () => {
        if (vrmApi) {
          vrmApi.setExpression('aa', 0.8)
          setTimeout(() => vrmApi.setExpression('aa', 0), 500)
        }
      },
    })

    const toggleBlinkBtn = app.create('uibutton', {
      label: 'Toggle Blink',
      width: 120,
      height: 30,
      position: [270, controlsY, 0],
      backgroundColor: vrmApi?.blinkingEnabled ? '#44ff44' : '#ff4444',
      onClick: () => {
        if (vrmApi) {
          const newState = !vrmApi.blinkingEnabled
          vrmApi.setBlinkEnabled(newState)
          toggleBlinkBtn.backgroundColor = newState ? '#44ff44' : '#ff4444'
        }
      },
    })

    debugUI.add(testBlinkBtn)
    debugUI.add(testMouthBtn)
    debugUI.add(toggleBlinkBtn)

    node.add(debugUI)
  }

  // Update status display
  const updateStatus = () => {
    if (!vrmApi || !statusTexts) return

    const hasManager = !!vrmApi.raw?.userData?.vrm?.expressionManager
    const expressions = []
    if (vrmApi.raw?.scene) {
      for (const child of vrmApi.raw.scene.children) {
        if (child?.type === 'VRMExpression') {
          expressions.push(child.expressionName || child.name)
        }
      }
    }

    const expressionsEnabled = hasManager || expressions.length > 0

    // Update status texts
    if (statusTexts.detected) {
      statusTexts.detected.color = expressionsEnabled ? '#00ff00' : '#ff0000'
      statusTexts.detected.value = expressionsEnabled
        ? `✓ Expressions detected (${expressions.length} found)`
        : '✗ No expressions detected'
    }

    if (statusTexts.enabled) {
      statusTexts.enabled.color = expressionsEnabled ? '#00ff00' : '#ff0000'
      statusTexts.enabled.value = expressionsEnabled ? '✓ Expressions enabled' : '✗ Expressions disabled'
    }

    if (statusTexts.blinking) {
      const blinkingEnabled = true // This is the hardcoded default
      statusTexts.blinking.color = blinkingEnabled ? '#00ff00' : '#ff0000'
      statusTexts.blinking.value = blinkingEnabled ? '✓ Auto-blink enabled' : '✗ Auto-blink disabled'
    }

    if (statusTexts.expressionManager) {
      statusTexts.expressionManager.color = hasManager ? '#00ff00' : '#ffaaaa'
      statusTexts.expressionManager.value = hasManager ? '✓ ExpressionManager present' : '✗ No expressionManager (VRM 0.x fallback)'
    }

    if (statusTexts.expressionNodes) {
      statusTexts.expressionNodes.color = expressions.length > 0 ? '#00ff00' : '#ffaaaa'
      statusTexts.expressionNodes.value =
        expressions.length > 0 ? `✓ Expression nodes: ${expressions.join(', ')}` : '✗ No expression nodes'
    }
  }

  // Find avatar entity
  const findAvatar = () => {
    avatar = world.entities.find(e => e.key === app.props.avatarEntity)
    if (avatar) {
      vrmApi = avatar.raw
      if (vrmApi) {
        console.log('[VRM Debug] Found avatar:', app.props.avatarEntity)
        console.log('[VRM Debug] VRM API available:', Object.keys(vrmApi))
        createDebugUI()
        updateStatus()
      }
    }
  }

  // Auto-test mode
  const startAutoTest = () => {
    if (testInterval) clearInterval(testInterval)

    let testPhase = 0
    testInterval = setInterval(() => {
      if (!vrmApi) return

      switch (testPhase) {
        case 0:
          // Test blinking
          vrmApi.setExpression('blink', 1)
          setTimeout(() => vrmApi.setExpression('blink', 0), 100)
          break
        case 1:
          // Test mouth shapes
          vrmApi.setExpression('aa', 0.6)
          setTimeout(() => vrmApi.setExpression('aa', 0), 500)
          break
        case 2:
          // Test speaking mode
          vrmApi.setSpeaking(true)
          setTimeout(() => vrmApi.setSpeaking(false), 2000)
          break
      }

      testPhase = (testPhase + 1) % 4
    }, 3000)
  }

  const stopAutoTest = () => {
    if (testInterval) {
      clearInterval(testInterval)
      testInterval = null
    }
  }

  // Bind to world events
  if (world.isClient) {
    world.on('start', () => {
      console.log('[VRM Debug] App started')
      findAvatar()
    })

    world.on('update', () => {
      if (!avatar) {
        avatar = world.entities.find(e => e.key === app.props.avatarEntity)
        if (avatar) {
          vrmApi = avatar.raw
          createDebugUI()
        }
      }
      updateStatus()
    })

    // Watch for debug bones toggle
    app.on('props', props => {
      if (props.debugBones === 'enabled' && vrmApi?.setBonesVisible) {
        vrmApi.setBonesVisible(true)
      } else if (props.debugBones === 'disabled' && vrmApi?.setBonesVisible) {
        vrmApi.setBonesVisible(false)
      }

      if (props.testMode === 'auto' && !testInterval) {
        startAutoTest()
      } else if (props.testMode !== 'auto' && testInterval) {
        stopAutoTest()
      }
    })

    // Start auto test if enabled
    if (app.props.testMode === 'auto') {
      setTimeout(startAutoTest, 2000)
    }
  }
}
