app.configure([
	{
		key: 'portalConfigSection',
		type: 'section',
		label: 'Portal Config',
	},
	{
		key: 'portalDest',
		type: 'text',
		label: 'Portal Destination',
		initial: 'Place Name',
		placeholder: 'Enter Destination',
		description: 'Where it goes'
	},
	{
		key: 'visibility',
		type: 'switch',
		label: 'SphereaPortal Visibility',
		options: [
			{ label: 'Visible', value: 'visible' },
			{ label: 'Invisible', value: 'invisible' }
		],
		initial: 'visible'
	},
	{
		key: 'uiConfigSection',
		type: 'section',
		label: 'UI Config',
	},
	{
		key: 'portalName',
		type: 'text',
		label: 'Portal Name',
		initial: 'Portal',
		placeholder: 'Enter a name for this portal',
		description: 'Name displayed above the portal'
	},
	{
		key: 'uiVisibility',
		type: 'switch',
		label: 'UI Visibility',
		options: [
			{ label: 'Visible', value: 'visible' },
			{ label: 'Invisible', value: 'invisible' }
		],
		initial: 'visible',
		description: 'Controls visibility of the UI container'
	},
	{
		key: 'uiWidth',
		type: 'number',
		label: 'UI Width',
		initial: 200,
		description: 'Width of the UI container',
	},
	{
		key: 'uiHeight',
		type: 'number',
		label: 'UI Height',
		initial: 80,
		description: 'Height of the UI container',
	},
	{
		key: 'uiYOffset',
		type: 'number',
		label: 'UI Y Offset',
		initial: 2,
		description: 'Y offset of the UI container',
		dp: 2,
	},
	{
		key: 'uiFontSize',
		type: 'number',
		label: 'UI Font Size',
		initial: 20,
		description: 'Font size of the UI title',
	},
	{
		key: 'uiFontColor',
		type: 'text',
		label: 'UI Font Color',
		initial: 'white',
		placeholder: 'Enter color (e.g., white, #FFFFFF)',
		description: 'Color of the UI title text'
	},
])

//SphereaPortalMesh visibility
const mesh = app.get('Sphere');
const lod = app.get('LOD');

if (props.visibility === 'invisible') {
	mesh.active = false
	lod.active = false
}
//EndSphereaPortalMeshRegion

//ServerSide
if (world.isServer) {
	world.on(props.portalDest, (eventData) => {
		if (!eventData || !eventData.position) {
			console.error('Invalid data received for portal position event');
			return;
		}

		const { x, y, z } = eventData.position;
		const position = [x, y, z];

		app.send('position', position);
	});
}
//EndServerSideRegion

//ClientSide
if (world.isClient) {
	let position = null;
	app.on('position', arr => {
		position = new Vector3().fromArray(arr);
	});

	// Teleport on trigger enter
	const body = app.get('AreaTrigger');
	body.onTriggerEnter = e => {
		if (e.playerId && position) {
			const player = world.getPlayer(e.playerId);
			player.teleport(position); //if your rotation on exit is weird, add , and 1.23 to 3.14 to mess with rotation
		}
	}

	// Create UI container
	const ui = app.create('ui')
	ui.width = props.uiWidth
	ui.height = props.uiHeight
	ui.billboard = 'y'
	ui.position.y = props.uiYOffset
	ui.backgroundColor = 'transparent'

	if (props.uiVisibility === 'invisible') {
		ui.active = false
	}

	// Create portal name label
	const label = app.create('uitext')
	label.value = props.portalName
	label.fontSize = props.uiFontSize
	label.color = props.uiFontColor
	label.textAlign = 'center'

	ui.add(label)
	body.add(ui)
}
//EndClientSideRegion