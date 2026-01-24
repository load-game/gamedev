/*============================================================================
 * Spherea
 *============================================================================
 * Emits a signal when an object enters or leaves the trigger area.
 * - Only requires a 'Collider' object as the trigger volume.
 * - Emits the configured signal with value 1 on enter, 0 on leave.
 *============================================================================*/

app.configure([
	{
		key: 'signal',
		type: 'text',
		label: 'Signal Name',
		initial: 'Trigger'
	},
	{
		key: 'visibleType',
		type: 'switch',
		label: 'Visbility Type',
		options: [
			{ value: 'visible', label: 'Visible' },
			{ value: 'invisible', label: 'Invisible' }
		],
		initial: 'Invisible'
	}
])

const signal = props.signal;

const mesh = app.get('Sphere')
const lod = app.get('LOD')
const rigidBody = app.get('AreaTrigger');
const collider = app.get('Collider');

// Occupancy tracking for multiplayer-safe triggers
const occupants = new Set();

// Set mesh visibility if it exists
if (mesh) {
	mesh.active = true;
	const updateVisibility = (value) => {
		mesh.active = value === 'visible'
		lod.active = value === 'visible'
	}
	app.on('props:visibleType', updateVisibility)
	updateVisibility(app.props.visibleType)

}

rigidBody.onTriggerEnter = (e) => {
	const id = e?.playerId || e?.entityId;
	if (!id) {
		console.log('[Spherea] Ignoring ENTER for non-player entity', e);
		return;
	}
	occupants.add(id);
	console.log('[Spherea] Trigger ENTER', id, 'occupants:', occupants.size);

	// Emit player-specific signal for the entering player
	if (e?.playerId) {
		console.log(`[Spherea] Emitting player-specific signal for player: ${e.playerId}`);
		world.emit(signal, { playerId: e.playerId });
	}

	// Also emit the general signal if this is the first occupant
	if (occupants.size === 1) {
		console.log('[Spherea] Emitting OPEN');
		app.emit(signal, 1);
	}
};

rigidBody.onTriggerLeave = (e) => {
	const id = e?.playerId || e?.entityId;
	if (!id || !occupants.has(id)) {
		console.log('[Spherea] Ignoring LEAVE for non-occupant or non-player', e);
		return;
	}
	occupants.delete(id);
	console.log('[Spherea] Trigger LEAVE', id, 'occupants:', occupants.size);
	if (occupants.size === 0) {
		console.log('[Spherea] Emitting CLOSE');
		app.emit(signal, 0);
	}
}; 