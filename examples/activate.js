const action = app.create('action')
action.onTrigger = () => { app.emit('PortalPowerSwitch', {}) }
action.position.set(0,.75,0)

app.add(action)