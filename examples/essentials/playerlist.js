// Initialize app properties
app.currentPlayers = app.currentPlayers || [];
app.openDetailsUI = null; // Track the open details UI

// Initialize global variables
let savedPins = [];

// Function to get all online players
const getAllPlayers = () => {
	const players = world.getPlayers();
	return players.map(player => ({
		id: player.id,
		name: player.name !== 'Anonymous' ? player.name : player.id,
		position: player.position
	}));
};

// Function to get current player name
const getCurrentPlayerName = (playerId) => {
	const players = world.getPlayers();
	const player = players.find(p => p.id === playerId);
	if (player) {
		return player.name !== 'Anonymous' ? player.name : playerId;
	}
	return playerId; // Fallback to ID if player not found
};

// Function to format position
const formatPosition = (pos) => {
	return `[${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}]`;
};

// Function to create a position object
const createPositionObject = (x, y, z) => {
	const player = world.getPlayer();
	if (player && player.position) {
		// Create a new position object directly from player's position
		return {
			x: x,
			y: y,
			z: z,
			toArray: function () {
				return [this.x, this.y, this.z];
			}
		};
	}
	return { x, y, z };
};

// Server-side storage for pins
if (world.isServer) {
	// Initialize server storage if it doesn't exist
	savedPins = world.get('savedPins') || [];

	// Clean up any invalid pins
	savedPins = savedPins.filter(pin =>
		pin &&
		pin.position &&
		!isNaN(pin.position.x) &&
		!isNaN(pin.position.y) &&
		!isNaN(pin.position.z)
	);

	world.set('savedPins', savedPins);

	// Handle pin addition
	app.on('pinAdded', (pin) => {
		// Create a new pin with a proper position object
		const newPin = {
			position: {
				x: pin.position.x,
				y: pin.position.y,
				z: pin.position.z,
				toArray: function () {
					return [this.x, this.y, this.z];
				}
			},
			playerId: pin.playerId,
			playerName: pin.playerName
		};

		savedPins.push(newPin);
		world.set('savedPins', savedPins);
		app.send('pinAdded', newPin);
	});

	// Handle pin deletion
	app.on('pinDeleted', ({ index }) => {
		if (savedPins[index]) {
			savedPins.splice(index, 1);
			world.set('savedPins', savedPins);
			app.send('pinDeleted', { index });
		}
	});

	// Handle teleport all request
	app.on('teleportAllToPlayer', (sourcePlayerId) => {
		console.log('Server received teleport all request from:', sourcePlayerId);
		const players = world.getPlayers();
		const sourcePlayer = players.find(p => p.id === sourcePlayerId);

		if (sourcePlayer) {
			console.log('Source player found, position:', sourcePlayer.position);
			console.log('Total players to teleport:', players.length);

			players.forEach(player => {
				if (player.id !== sourcePlayerId) {
					console.log('Teleporting player:', player.id);
					try {
						const targetPos = {
							x: sourcePlayer.position.x,
							y: sourcePlayer.position.y,
							z: sourcePlayer.position.z,
							toArray: function () {
								return [this.x, this.y, this.z];
							}
						};
						player.teleport(targetPos, 3.14);
						console.log('Successfully teleported player:', player.id);
					} catch (error) {
						console.error('Failed to teleport player:', player.id, error);
					}
				}
			});
		} else {
			console.error('Source player not found:', sourcePlayerId);
		}
	});

	// Handle client connection
	world.on('enter', (player) => {
		// Send current pins to the new player
		app.send('pinsSync', savedPins);
	});

	// Handle clear pins request
	app.on('clearPlayerPins', (playerId) => {
		console.log('Clearing pins for player:', playerId);
		const initialLength = savedPins.length;
		savedPins = savedPins.filter(pin => pin.playerId !== playerId);
		world.set('savedPins', savedPins);
		console.log(`Removed ${initialLength - savedPins.length} pins`);
		app.send('pinsSync', savedPins);
	});

	// Handle teleport all to pin
	app.on('teleportAllToPin', (pinIndex) => {
		console.log('Teleporting all players to pin:', pinIndex);
		if (savedPins[pinIndex]) {
			const targetPin = savedPins[pinIndex];
			const players = world.getPlayers();
			console.log('Total players to teleport:', players.length);

			players.forEach(player => {
				console.log('Teleporting player:', player.id);
				try {
					const targetPos = {
						x: targetPin.position.x,
						y: targetPin.position.y,
						z: targetPin.position.z,
						toArray: function () {
							return [this.x, this.y, this.z];
						}
					};
					player.teleport(targetPos, 3.14);
					console.log('Successfully teleported player:', player.id);
				} catch (error) {
					console.error('Failed to teleport player:', player.id, error);
				}
			});
		} else {
			console.error('Pin not found:', pinIndex);
		}
	});
}

// Client-side initialization
if (world.isClient) {
	// Listen for initial pins sync
	app.on('pinsSync', (pins) => {
		savedPins = pins;
		updatePlayerList();
	});

	// Listen for pin updates
	app.on('pinAdded', (pin) => {
		savedPins.push(pin);
		updatePlayerList();
	});

	app.on('pinDeleted', ({ index }) => {
		if (savedPins[index]) {
			savedPins.splice(index, 1);
			updatePlayerList();
		}
	});
}

// Function to get pin count for a player
const getPlayerPinCount = (playerId) => {
	return savedPins.filter(pin => pin.playerId === playerId).length;
};

// Function to update the player list
const updatePlayerList = () => {
	const players = getAllPlayers();
	app.currentPlayers = players;

	// Remove all existing player entries
	while (playerListView.children.length > 0) {
		playerListView.remove(playerListView.children[0]);
	}

	// Create entries for each player
	players.forEach(player => {
		const playerView = app.create('uiview', {
			width: app.props.uiSpace === 'world' ? 110 : 180,
			height: app.props.uiSpace === 'world' ? 35 : 50,
			flexDirection: 'column',
			padding: 3,
			backgroundColor: 'rgba(255, 255, 255, 0.05)',
			borderRadius: 5
		});

		// Name and ID row
		const infoRow = app.create('uiview', {
			width: app.props.uiSpace === 'world' ? 100 : 170,
			height: app.props.uiSpace === 'world' ? 12 : 18,
			padding: 2,
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center'
		});

		const nameText = app.create('uitext', {
			value: player.name,
			fontSize: app.props.uiSpace === 'world' ? 10 : 14,
			color: '#ffffff'
		});

		const idText = app.create('uitext', {
			value: player.id,
			fontSize: app.props.uiSpace === 'world' ? 8 : 12,
			color: '#aaaaaa'
		});

		infoRow.add(nameText);
		infoRow.add(idText);
		playerView.add(infoRow);

		// Position and pins row
		const positionRow = app.create('uiview', {
			width: app.props.uiSpace === 'world' ? 100 : 170,
			height: app.props.uiSpace === 'world' ? 12 : 18,
			padding: 2,
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center'
		});

		const positionText = app.create('uitext', {
			value: formatPosition(player.position),
			fontSize: app.props.uiSpace === 'world' ? 8 : 12,
			color: '#88ff88'
		});

		// Add pin count indicator
		const pinCount = getPlayerPinCount(player.id);
		if (pinCount > 0) {
			const pinCountText = app.create('uitext', {
				value: `📍 ${pinCount}`,
				fontSize: app.props.uiSpace === 'world' ? 8 : 12,
				color: '#ffaa88'
			});
			positionRow.add(pinCountText);
		}

		positionRow.add(positionText);
		playerView.add(positionRow);

		// Add hover effects for entire player entry
		playerView.onPointerEnter = () => {
			playerView.backgroundColor = 'rgba(255, 255, 255, 0.15)';
			nameText.color = '#88ff88';
		};

		playerView.onPointerLeave = () => {
			playerView.backgroundColor = 'rgba(255, 255, 255, 0.05)';
			nameText.color = '#ffffff';
		};

		// Add click handler to show player details
		playerView.onPointerDown = () => {
			if (world.isClient) {
				createPlayerDetailsUI(player);
			}
		};

		playerListView.add(playerView);
	});
};

// Create the main UI container
const playerListUI = app.create('ui', {
	space: app.props.uiSpace || 'screen',  // Use the configured space or default to screen
	pivot: 'center',
	position: app.props.uiSpace === 'world' ? [0, 0, 0] : [0.5, 0.4, 0],
	offset: app.props.uiSpace === 'world' ? undefined : [0, 20, 0],
	width: app.props.uiSpace === 'world' ? 150 : 230,
	height: app.props.uiSpace === 'world' ? 250 : 400,
	backgroundColor: 'rgba(0, 0, 0, 0.7)',
	borderRadius: 10,
	padding: 15,
	flexDirection: 'column',
	gap: 10
});

// Set initial world space position if needed
if (app.props.uiSpace === 'world') {
	const player = world.getPlayer();
	if (player) {
		const pos = player.position;
		playerListUI.position.set(
			pos.x - 0.65,           // Same X as player
			pos.y + 1.5,     // 2.3 units above player
			pos.z + 2.0      // 2.0 units in front of player
		);
		playerListUI.billboard = 'full';
	}
}

// Create the title view
const titleView = app.create('uiview', {
	width: app.props.uiSpace === 'world' ? 120 : 190,
	height: app.props.uiSpace === 'world' ? 25 : 40,
	flexDirection: 'row',
	justifyContent: 'space-between',
	alignItems: 'center'
});

const titleText = app.create('uitext', {
	value: 'inWorld',
	fontSize: app.props.uiSpace === 'world' ? 12 : 16,
	color: '#ffffff',
	textAlign: 'center',
	fontWeight: 'bold'
});

// Add refresh button
const refreshButton = app.create('uiview', {
	width: app.props.uiSpace === 'world' ? 20 : 28,
	height: app.props.uiSpace === 'world' ? 20 : 28,
	backgroundColor: 'rgba(255, 255, 255, 0.1)',
	borderRadius: 5,
	justifyContent: 'center',
	alignItems: 'center'
});

const refreshIcon = app.create('uitext', {
	value: '↻',
	fontSize: app.props.uiSpace === 'world' ? 14 : 20,
	color: '#ffffff'
});

refreshButton.add(refreshIcon);
refreshButton.onPointerDown = () => {
	updatePlayerList();
};

// Add hover effects for refresh button
refreshButton.onPointerEnter = () => {
	refreshButton.backgroundColor = 'rgba(255, 255, 255, 0.2)';
	refreshIcon.color = '#88ff88';
};

refreshButton.onPointerLeave = () => {
	refreshButton.backgroundColor = 'rgba(255, 255, 255, 0.1)';
	refreshIcon.color = '#ffffff';
};

// Add drop pin button
const dropPinButton = app.create('uiview', {
	width: app.props.uiSpace === 'world' ? 18 : 26,
	height: app.props.uiSpace === 'world' ? 18 : 26,
	backgroundColor: 'rgba(255, 170, 136, 0.2)',
	borderRadius: 5,
	justifyContent: 'center',
	alignItems: 'center',
	marginRight: 10
});

const pinIcon = app.create('uitext', {
	value: '📍',
	fontSize: app.props.uiSpace === 'world' ? 12 : 16,
	color: '#ffaa88'
});

dropPinButton.add(pinIcon);
dropPinButton.onPointerDown = () => {
	if (world.isClient) {
		const localPlayer = world.getPlayer();
		if (localPlayer && localPlayer.position) {
			// Create pin object with player info and proper position
			const pin = {
				position: {
					x: localPlayer.position.x,
					y: localPlayer.position.y,
					z: localPlayer.position.z,
					toArray: function () {
						return [this.x, this.y, this.z];
					}
				},
				playerId: localPlayer.id,
				playerName: localPlayer.name !== 'Anonymous' ? localPlayer.name : localPlayer.id
			};

			// Send pin addition event to server
			app.send('pinAdded', pin);
		}
	}
};

// Add hover effects for pin button
dropPinButton.onPointerEnter = () => {
	dropPinButton.backgroundColor = 'rgba(255, 170, 136, 0.3)';
	pinIcon.color = '#ffcc88';
};

dropPinButton.onPointerLeave = () => {
	dropPinButton.backgroundColor = 'rgba(255, 170, 136, 0.2)';
	pinIcon.color = '#ffaa88';
};

// Add teleport all button
const teleportAllButton = app.create('uiview', {
	width: app.props.uiSpace === 'world' ? 18 : 26,
	height: app.props.uiSpace === 'world' ? 18 : 26,
	backgroundColor: 'rgba(136, 255, 136, 0.2)',
	borderRadius: 5,
	justifyContent: 'center',
	alignItems: 'center',
	marginRight: 10
});

const teleportAllIcon = app.create('uitext', {
	value: '🚀',
	fontSize: app.props.uiSpace === 'world' ? 12 : 16,
	color: '#88ff88'
});

teleportAllButton.add(teleportAllIcon);
teleportAllButton.onPointerDown = () => {
	if (world.isClient) {
		const localPlayer = world.getPlayer();
		if (localPlayer) {
			console.log('Sending teleport all request for player:', localPlayer.id);
			app.send('teleportAllToPlayer', localPlayer.id);
		}
	}
};

// Add hover effects for teleport all button
teleportAllButton.onPointerEnter = () => {
	teleportAllButton.backgroundColor = 'rgba(136, 255, 136, 0.3)';
	teleportAllIcon.color = '#aaffaa';
};

teleportAllButton.onPointerLeave = () => {
	teleportAllButton.backgroundColor = 'rgba(136, 255, 136, 0.2)';
	teleportAllIcon.color = '#88ff88';
};

// Add clear my pins button
const clearPinsButton = app.create('uiview', {
	width: app.props.uiSpace === 'world' ? 18 : 26,
	height: app.props.uiSpace === 'world' ? 18 : 26,
	backgroundColor: 'rgba(255, 136, 136, 0.2)',
	borderRadius: 5,
	justifyContent: 'center',
	alignItems: 'center',
	marginRight: 10
});

const clearPinsIcon = app.create('uitext', {
	value: '🗑️',
	fontSize: app.props.uiSpace === 'world' ? 12 : 16,
	color: '#ff8888'
});

clearPinsButton.add(clearPinsIcon);
clearPinsButton.onPointerDown = () => {
	if (world.isClient) {
		const localPlayer = world.getPlayer();
		if (localPlayer) {
			app.send('clearPlayerPins', localPlayer.id);
		}
	}
};

// Add hover effects for clear pins button
clearPinsButton.onPointerEnter = () => {
	clearPinsButton.backgroundColor = 'rgba(255, 136, 136, 0.3)';
	clearPinsIcon.color = '#ff4444';
};

clearPinsButton.onPointerLeave = () => {
	clearPinsButton.backgroundColor = 'rgba(255, 136, 136, 0.2)';
	clearPinsIcon.color = '#ff8888';
};

titleView.add(titleText);
titleView.add(dropPinButton);
titleView.add(teleportAllButton);
titleView.add(clearPinsButton);
titleView.add(refreshButton);
playerListUI.add(titleView);

// Create the player list container
const playerListView = app.create('uiview', {
	width: app.props.uiSpace === 'world' ? 120 : 200,
	height: app.props.uiSpace === 'world' ? 200 : 330,
	flexDirection: 'column',
	gap: 5,
	padding: 8,
	backgroundColor: 'rgba(255, 255, 255, 0.1)',
	borderRadius: 5
});

// Add player list to world
world.add(playerListUI);

// Add the player list to the main UI
playerListUI.add(playerListView);

// Initial update
updatePlayerList();

// Listen for player enter/leave events
if (world.isClient) {
	// Refresh list when a player enters
	world.on('enter', () => {
		updatePlayerList();
	});

	// Refresh list when a player leaves
	world.on('leave', () => {
		updatePlayerList();
	});

	// Refresh list when any player moves or teleports
	world.on('move', () => {
		updatePlayerList();
	});

	// Listen for pin events
	world.on('pinAdded', (pin) => {
		savedPins.push(pin);
		updatePlayerList();
	});

	world.on('pinDeleted', ({ index }) => {
		if (savedPins[index]) {
			savedPins.splice(index, 1);
			updatePlayerList();
		}
	});
}

// Function to update world UI positions
const updateWorldUIPositions = () => {
	if (!world.isClient) return;

	const player = world.getPlayer();
	if (!player) {
		console.log('No player found');
		return;
	}

	try {
		// Get player position
		const pos = player.position;

		// Update main UI position - fixed distance in front of player
		if (playerListUI && playerListUI.space === 'world') {
			playerListUI.position.set(
				pos.x,           // Same X as player
				pos.y + 2.3,     // 2.3 units above player
				pos.z + 2.0      // 2.0 units in front of player
			);
			playerListUI.billboard = 'full';
		}

		// Update details UI position if it exists - slightly to the right
		if (app.openDetailsUI && app.openDetailsUI.space === 'world') {
			app.openDetailsUI.position.set(
				pos.x + 0.5,     // 0.5 units to the right
				pos.y + 2.3,     // Same height as main UI
				pos.z + 2.0      // Same distance in front
			);
			app.openDetailsUI.billboard = 'full';
		}
	} catch (err) {
		console.error('Error updating UI positions:', err);
	}
};

// Configure refresh button and UI space switch
if (world.isClient) {
	app.configure([
		{
			key: 'refreshPlayerList',
			type: 'button',
			label: 'Refresh Player List',
			onClick: updatePlayerList
		},
		{
			type: 'switch',
			key: 'uiSpace',
			label: 'UI Space',
			options: [
				{
					label: 'Screen',
					value: 'screen'
				},
				{
					label: 'World',
					value: 'world'
				}
			],
			initial: 'screen',
			onChange: (value) => {
				if (!world.isClient) return;

				console.log('Switching UI space to:', value);

				// Update main UI
				if (playerListUI) {
					const oldSpace = playerListUI.space;
					playerListUI.space = value;

					if (value === 'screen') {
						playerListUI.position = [0.5, 0.4, 0];
						playerListUI.offset = [0, 20, 0];
						playerListUI.billboard = 'full';
						playerListUI.doubleside = false;
						playerListUI.borderColor = null;
						playerListUI.borderWidth = 0;
						playerListUI.width = 230;
						playerListUI.height = 400;

						// Update title view
						titleView.width = 190;
						titleView.height = 40;
						titleText.fontSize = 16;

						// Update buttons
						refreshButton.width = 28;
						refreshButton.height = 28;
						refreshIcon.fontSize = 20;
						dropPinButton.width = 26;
						dropPinButton.height = 26;
						pinIcon.fontSize = 16;

						// Update player list
						playerListView.width = 200;
						playerListView.height = 330;

						// Update all player entries
						playerListView.children.forEach(playerView => {
							playerView.width = 185;
							playerView.height = 60;

							// Update info row
							const infoRow = playerView.children[0];
							infoRow.width = 170;
							infoRow.height = 20;
							infoRow.children[0].fontSize = 14; // name
							infoRow.children[1].fontSize = 12; // id

							// Update position row
							const positionRow = playerView.children[1];
							positionRow.width = 170;
							positionRow.height = 20;
							positionRow.children[0].fontSize = 12; // position
							if (positionRow.children[1]) {
								positionRow.children[1].fontSize = 12; // pin count
							}
						});
					} else if (oldSpace !== 'world') {
						// Only update position when switching TO world space
						playerListUI.billboard = 'full';
						playerListUI.doubleside = true;
						playerListUI.borderColor = 'rgba(65, 253, 254, 0.7)';
						playerListUI.borderWidth = 1;
						playerListUI.width = 150;
						playerListUI.height = 250;

						// Update title view
						titleView.width = 120;
						titleView.height = 25;
						titleText.fontSize = 12;

						// Update buttons
						refreshButton.width = 20;
						refreshButton.height = 20;
						refreshIcon.fontSize = 14;
						dropPinButton.width = 18;
						dropPinButton.height = 18;
						pinIcon.fontSize = 12;

						// Update player list
						playerListView.width = 120;
						playerListView.height = 200;

						// Update all player entries
						playerListView.children.forEach(playerView => {
							playerView.width = 120;
							playerView.height = 40;

							// Update info row
							const infoRow = playerView.children[0];
							infoRow.width = 110;
							infoRow.height = 15;
							infoRow.children[0].fontSize = 10; // name
							infoRow.children[1].fontSize = 8; // id

							// Update position row
							const positionRow = playerView.children[1];
							positionRow.width = 110;
							positionRow.height = 15;
							positionRow.children[0].fontSize = 8; // position
							if (positionRow.children[1]) {
								positionRow.children[1].fontSize = 8; // pin count
							}
						});

						updateWorldUIPositions();
					}
				}

				// Update details UI if it exists
				if (app.openDetailsUI) {
					const oldSpace = app.openDetailsUI.space;
					app.openDetailsUI.space = value;

					if (value === 'screen') {
						app.openDetailsUI.position = [0.5, 0.5, 0];
						app.openDetailsUI.offset = [0, 0, 0];
						app.openDetailsUI.billboard = 'none';
						app.openDetailsUI.doubleside = false;
						app.openDetailsUI.borderColor = null;
						app.openDetailsUI.borderWidth = 0;
						app.openDetailsUI.width = 300;
						app.openDetailsUI.height = 400;
					} else if (oldSpace !== 'world') {
						// Only update position when switching TO world space
						app.openDetailsUI.billboard = 'full';
						app.openDetailsUI.doubleside = true;
						app.openDetailsUI.borderColor = 'rgba(65, 253, 254, 0.7)';
						app.openDetailsUI.borderWidth = 1;
						app.openDetailsUI.width = 200;
						app.openDetailsUI.height = 300;
						updateWorldUIPositions();
					}
				}
			}
		}
	]);
}

// Function to create or update player details UI
const createPlayerDetailsUI = (player) => {
	// Remove existing details UI if it exists
	if (app.openDetailsUI) {
		world.remove(app.openDetailsUI);
		app.openDetailsUI = null;
	}

	// Remove player list UI
	if (playerListUI) {
		world.remove(playerListUI);
	}

	// Create the main UI container
	const detailsUI = app.create('ui', {
		space: app.props.uiSpace || 'screen',  // Use the configured space or default to screen
		pivot: 'center',
		position: app.props.uiSpace === 'world' ? [0, 0, 0] : [0.5, 0.5, 0],
		offset: app.props.uiSpace === 'world' ? undefined : [0, 0, 0],
		width: app.props.uiSpace === 'world' ? 110 : 220,  // Reduced width to match buttons
		height: app.props.uiSpace === 'world' ? 250 : 400,
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		borderRadius: 10,
		padding: app.props.uiSpace === 'world' ? 10 : 15,
		flexDirection: 'column',
		gap: app.props.uiSpace === 'world' ? 5 : 10
	});

	// Create the header
	const headerView = app.create('uiview', {
		width: app.props.uiSpace === 'world' ? 90 : 200,  // Reduced width in world space
		height: app.props.uiSpace === 'world' ? 25 : 40,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	});

	const titleText = app.create('uitext', {
		value: `${player.name}'s Details`,
		fontSize: app.props.uiSpace === 'world' ? 12 : 20,  // Smaller font in world space
		color: '#ffffff',
		textAlign: 'center',
		fontWeight: 'bold'
	});

	const closeButton = app.create('uitext', {
		value: '×',
		fontSize: app.props.uiSpace === 'world' ? 16 : 24,  // Smaller font in world space
		color: '#ff8888'
	});

	closeButton.onPointerDown = () => {
		world.remove(detailsUI);
		app.openDetailsUI = null;
		// Add back the player list UI
		world.add(playerListUI);
	};

	// Add hover effects for close button
	closeButton.onPointerEnter = () => {
		closeButton.color = '#ff4444';
		closeButton.fontSize = app.props.uiSpace === 'world' ? 18 : 26;
	};

	closeButton.onPointerLeave = () => {
		closeButton.color = '#ff8888';
		closeButton.fontSize = app.props.uiSpace === 'world' ? 16 : 24;
	};

	headerView.add(titleText);
	headerView.add(closeButton);
	detailsUI.add(headerView);

	// Create back to list button
	const backButton = app.create('uiview', {
		width: app.props.uiSpace === 'world' ? 90 : 200,  // Reduced width in world space
		height: app.props.uiSpace === 'world' ? 25 : 40,
		backgroundColor: 'rgba(136, 136, 255, 0.2)',
		borderRadius: 5,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 10
	});

	const backText = app.create('uitext', {
		value: 'Back to Player List',
		fontSize: app.props.uiSpace === 'world' ? 10 : 16,  // Smaller font in world space
		color: '#8888ff'
	});

	backButton.add(backText);
	backButton.onPointerDown = () => {
		world.remove(detailsUI);
		app.openDetailsUI = null;
		// Add back the player list UI
		world.add(playerListUI);
	};

	// Add hover effects for back button
	backButton.onPointerEnter = () => {
		backButton.backgroundColor = 'rgba(136, 136, 255, 0.3)';
		backText.color = '#aaaaff';
	};

	backButton.onPointerLeave = () => {
		backButton.backgroundColor = 'rgba(136, 136, 255, 0.2)';
		backText.color = '#8888ff';
	};

	detailsUI.add(backButton);

	// Create teleport to player button
	const teleportButton = app.create('uiview', {
		width: app.props.uiSpace === 'world' ? 90 : 200,  // Reduced width in world space
		height: app.props.uiSpace === 'world' ? 25 : 40,
		backgroundColor: 'rgba(136, 255, 136, 0.2)',
		borderRadius: 5,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 10
	});

	const teleportText = app.create('uitext', {
		value: 'Teleport to Player',
		fontSize: app.props.uiSpace === 'world' ? 10 : 16,  // Smaller font in world space
		color: '#88ff88'
	});

	teleportButton.add(teleportText);
	teleportButton.onPointerDown = () => {
		if (world.isClient) {
			const localPlayer = world.getPlayer();
			if (localPlayer) {
				localPlayer.teleport(player.position, 3.14);
				if (app.openDetailsUI) {
					world.remove(app.openDetailsUI);
					app.openDetailsUI = null;
				}
			}
		}
	};

	// Add hover effects for teleport button
	teleportButton.onPointerEnter = () => {
		teleportButton.backgroundColor = 'rgba(136, 255, 136, 0.3)';
		teleportText.color = '#aaffaa';
	};

	teleportButton.onPointerLeave = () => {
		teleportButton.backgroundColor = 'rgba(136, 255, 136, 0.2)';
		teleportText.color = '#88ff88';
	};

	detailsUI.add(teleportButton);

	// Create pins section
	const pinsTitle = app.create('uitext', {
		value: 'Saved Pins',
		fontSize: app.props.uiSpace === 'world' ? 12 : 16,
		color: '#ffffff',
		marginBottom: 5
	});

	detailsUI.add(pinsTitle);

	// Create pins container
	const pinsContainer = app.create('uiview', {
		width: app.props.uiSpace === 'world' ? 90 : 200,  // Reduced width in world space
		height: app.props.uiSpace === 'world' ? 200 : 330, // Match player list height
		flexDirection: 'column',
		gap: 5,
		padding: 10,
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		borderRadius: 5
	});

	// Filter and display player's pins
	const playerPins = savedPins.filter(pin => pin.playerId === player.id);
	console.log('Player pins for', player.name, ':', playerPins);

	if (playerPins.length === 0) {
		const noPinsText = app.create('uitext', {
			value: 'No pins saved',
			fontSize: app.props.uiSpace === 'world' ? 10 : 14,
			color: '#aaaaaa',
			textAlign: 'center'
		});
		pinsContainer.add(noPinsText);
	} else {
		playerPins.forEach((pin, index) => {
			const pinView = app.create('uiview', {
				width: app.props.uiSpace === 'world' ? 70 : 180,
				height: app.props.uiSpace === 'world' ? 35 : 50,
				flexDirection: 'column',
				padding: 5,
				backgroundColor: 'rgba(255, 255, 255, 0.05)',
				borderRadius: 5,
				justifyContent: 'center',
				alignItems: 'center'
			});

			// Pin name and position row
			const infoRow = app.create('uiview', {
				width: app.props.uiSpace === 'world' ? 60 : 170,
				height: app.props.uiSpace === 'world' ? 12 : 18,
				flexDirection: 'row',
				justifyContent: 'space-between',
				alignItems: 'center'
			});

			const nameText = app.create('uitext', {
				value: `Pin ${index + 1}`,
				fontSize: app.props.uiSpace === 'world' ? 10 : 14,
				color: '#ffaa88'
			});

			const positionText = app.create('uitext', {
				value: formatPosition(pin.position),
				fontSize: app.props.uiSpace === 'world' ? 8 : 12,
				color: '#88ff88'
			});

			infoRow.add(nameText);
			infoRow.add(positionText);
			pinView.add(infoRow);

			// Add teleport all button for this pin
			const teleportAllToPinButton = app.create('uiview', {
				width: app.props.uiSpace === 'world' ? 60 : 170,
				height: app.props.uiSpace === 'world' ? 15 : 20,
				backgroundColor: 'rgba(136, 255, 136, 0.2)',
				borderRadius: 3,
				justifyContent: 'center',
				alignItems: 'center',
				marginTop: 3
			});

			const teleportAllToPinText = app.create('uitext', {
				value: 'Teleport All Here',
				fontSize: app.props.uiSpace === 'world' ? 8 : 12,
				color: '#88ff88'
			});

			teleportAllToPinButton.add(teleportAllToPinText);
			teleportAllToPinButton.onPointerDown = () => {
				if (world.isClient) {
					app.send('teleportAllToPin', savedPins.indexOf(pin));
				}
			};

			// Add hover effects for teleport all to pin button
			teleportAllToPinButton.onPointerEnter = () => {
				teleportAllToPinButton.backgroundColor = 'rgba(136, 255, 136, 0.3)';
				teleportAllToPinText.color = '#aaffaa';
			};

			teleportAllToPinButton.onPointerLeave = () => {
				teleportAllToPinButton.backgroundColor = 'rgba(136, 255, 136, 0.2)';
				teleportAllToPinText.color = '#88ff88';
			};

			pinView.add(teleportAllToPinButton);

			// Add hover effects for pin view
			pinView.onPointerEnter = () => {
				pinView.backgroundColor = 'rgba(255, 255, 255, 0.15)';
				nameText.color = '#ffcc88';
			};

			pinView.onPointerLeave = () => {
				pinView.backgroundColor = 'rgba(255, 255, 255, 0.05)';
				nameText.color = '#ffaa88';
			};

			// Add individual teleport functionality
			pinView.onPointerDown = () => {
				if (world.isClient) {
					const localPlayer = world.getPlayer();
					if (localPlayer) {
						const teleportPos = {
							x: pin.position.x,
							y: pin.position.y,
							z: pin.position.z,
							toArray: function () {
								return [this.x, this.y, this.z];
							}
						};
						localPlayer.teleport(teleportPos, 3.14);
						if (app.openDetailsUI) {
							world.remove(app.openDetailsUI);
							app.openDetailsUI = null;
						}
					}
				}
			};

			pinsContainer.add(pinView);
		});
	}

	detailsUI.add(pinsContainer);
	world.add(detailsUI);
	app.openDetailsUI = detailsUI;

	// Set world space position if needed
	if (app.props.uiSpace === 'world') {
		const localPlayer = world.getPlayer();
		if (localPlayer) {
			const pos = localPlayer.position;
			detailsUI.position.set(
				pos.x - 0.65,         // Same X as player list UI
				pos.y + 1.3,     // Same height as player list UI
				pos.z + 2.0      // Same distance in front as player list UI
			);
			detailsUI.billboard = 'full';
			detailsUI.width = 110;
			detailsUI.height = 260;
		}
	}
};