
// Slate color scheme
const COLORS = {
	slate50: 'rgb(248, 250, 252)',
	slate100: 'rgb(241, 245, 249)',
	slate200: 'rgb(226, 232, 240)',
	slate300: 'rgb(203, 213, 225)',
	slate400: 'rgb(148, 163, 184)',
	slate500: 'rgb(100, 116, 139)',
	slate600: 'rgb(71, 85, 105)',
	slate700: 'rgb(51, 65, 85)',
	slate800: 'rgb(30, 41, 59)',
	slate900: 'rgb(15, 23, 42)'
}

const PROPERTIES = [
	{
		name: 'Text',
		description: 'A text input',
		code: `{ 
      type: 'text', 
      key: String,           // the key on \`props\` to set this value
      label: String,         // the label for the text input
      placeholder: String,   // an optional placeholder displayed inside the input
			initial: String        // the initial value to set if not configured
		}`
	},
	{
		name: 'Textarea',
		description: 'A multi-line textarea input',
		code: `{
  		type: 'textarea',
  		key: String,           // the key on \`props\` to set this value
  		label: String,         // the label for the text input
  		placeholder: String,   // an optional placeholder displayed inside the input
  		initial: String        // the initial value to set if not configured
		}`
	},
	{
		name: 'Number',
		description: 'A number input. Also supports math entry and up/down stepping.',
		code: `{
  		type: 'number',
  		key: String,           // the key on \`props\` to set this value
  		label: String,         // the label for the text input
  		dp: Number,            // the number of decimal places allowed (default = 0)
  		min: Number,           // the minimum value allowed (default = -Infinity)
  		max: Number,           // the maximum value allowed (default = Infinity)
  		step: Number,          // the amount incremented/decrement when pressing up/down arrows (default = 1)
  		initial: Number        // the initial value to set if not configured (default = 0)
		}`
	},
	{
		name: 'Range',
		description: 'A range slider input',
		code: `{
  		type: 'range',
  		key: String,           // the key on \`props\` to set this value
  		label: String,         // the label for the slider
  		min: Number,           // the minimum value allowed (default = 0)
  		max: Number,           // the maximum value allowed (default = 1)
  		step: Number,          // the step amount when sliding (default= 0.05)
  		initial: Number        // the initial value to set if not configured (default = 0)
		}`
	},
	{
		name: 'Switch',
		description: 'A switch input',
		code: `{
  		type: 'switch',
  		key: String,           // the key on \`props\` to set this value
  		label: String,         // the label for the text input
  		options: [
  		  {
  		    label: String,     // the label to show on this switch item
  		    value: String      // the value to set on the props when selected
  		  }
  		],
  		initial: String        // the initial value to set if not configured
		}`
	},
	{
		name: 'Dropdown',
		description: 'A dropdown menu',
		code: `{
  		type: 'dropdown',
  		key: String,           // the key on \`props\` to set this value
  		label: String,         // the label for the text input
  		options: [
    		{
    		  label: String,     // the label to show on this item
    		  value: String      // the value to set on the props when selected
    		}
  		],
  		initial: String        // the initial value to set if not configured
		}`
	},
	{
		name: 'File',
		description: 'A file field for selecting and uploading additional assets that can be used by your app.',
		code: `{
  		type: 'file',
  		key: String,           // the key on \`props\` to set this value
  		label: String,         // the label for the text input
  		kind: String           // the kind of file, must be one of: avatar, emote, model, texture, hdr, audio
		},
			// Note: The value set on props is an object that looks like this:
		{
		  type: String,          // the type of file (avatar, emote, model, texture, hdr, audio)
		  name: String,          // the original files name
		  url: String           // the url to the file
		},
		// Example usage with audio:
			const audio = app.create('audio', {
			  src: props.audio?.url
			})

			audio.play()
		}`
	},
	{
		name: 'Section',
		description: 'A simple section header to help group fields together',
		code: `{
  		type: 'section',
  		key: String,           // a unique \`key\` to represent this section
  		label: String          // the label for the section header
		}`
	},
	{
		name: 'Buttons',
		description: 'Displays one or more buttons that when clicked, execute something in the running app.',
		code: `{
  		type: 'buttons',
  		key: String,           // a unique \`key\` for this button
  		label: String,         // the label for the button
  		buttons: [
  		  ...{ label: String, onClick: Function }
  		]
		}`
	}
]

let detailView = null

function createMainInterface() {
	const board = app.create('ui')
	board.backgroundColor = COLORS.slate800
	board.width = 300
	board.height = 200
	board.borderRadius = 10
	board.padding = 20
	board.position.set(0, 0.2, 0.5)

	board.flexDirection = 'row'
	board.flexWrap = 'wrap'
	board.justifyContent = 'center'
	board.alignItems = 'center'
	board.alignContent = 'center'
	board.gap = 10

	const title = app.create('uitext')
	title.value = 'Configuration Properties'
	title.fontSize = 20
	title.color = COLORS.slate50
	title.textAlign = 'center'
	title.margin = 10
	board.add(title)

	PROPERTIES.forEach(property => {
		const tile = app.create('uiview')
		tile.backgroundColor = COLORS.slate700
		tile.padding = 10
		tile.borderRadius = 5
		tile.width = 80
		tile.height = 30
		tile.justifyContent = 'center'
		tile.alignItems = 'center'

		const text = app.create('uitext')
		text.value = property.name
		text.fontSize = 12
		text.color = COLORS.slate200
		text.textAlign = 'center'
		tile.add(text)

		tile.onPointerEnter = () => {
			tile.backgroundColor = COLORS.slate600
		}

		tile.onPointerLeave = () => {
			tile.backgroundColor = COLORS.slate700
		}

		tile.onPointerDown = () => {
			showDetailView(property)
		}

		board.add(tile)
	})

	return board
}

function showDetailView(property) {
	if (detailView) {
		app.remove(detailView)
	}

	const detail = app.create('ui')
	detail.backgroundColor = COLORS.slate800
	detail.width = 250
	detail.height = 200
	detail.borderRadius = 10
	detail.padding = 15
	detail.position.set(0.6, 1.2, -0.2)
	detail.flexDirection = 'column'

	// Title section
	const header = app.create('uiview')
	header.flexDirection = 'row'
	header.justifyContent = 'center'
	header.alignItems = 'center'
	header.marginBottom = 12

	const title = app.create('uitext')
	title.value = property.name
	title.fontSize = 16
	title.color = COLORS.slate50
	title.textAlign = 'center'
	header.add(title)
	detail.add(header)

	// Description section with more padding
	const description = app.create('uitext')
	description.value = property.description
	description.fontSize = 11
	description.color = COLORS.slate300
	description.marginBottom = 12
	description.textAlign = 'left'
	detail.add(description)

	// Code section with scroll if needed
	const codeContainer = app.create('uiview')
	codeContainer.backgroundColor = COLORS.slate900
	codeContainer.padding = 12
	codeContainer.borderRadius = 4
	codeContainer.marginBottom = 12
	codeContainer.overflowY = 'scroll'
	codeContainer.height = 90

	const codeText = app.create('uitext')
	codeText.value = property.code
	codeText.fontSize = 10
	codeText.color = COLORS.slate200
	codeText.fontFamily = 'monospace'
	codeText.whiteSpace = 'pre'
	codeContainer.add(codeText)

	detail.add(codeContainer)

	// Close button container at bottom
	const buttonContainer = app.create('uiview')
	buttonContainer.flexDirection = 'row'
	buttonContainer.justifyContent = 'center'
	buttonContainer.alignItems = 'center'
	buttonContainer.marginTop = 8

	const closeButton = app.create('uiview')
	closeButton.backgroundColor = COLORS.slate600
	closeButton.padding = 6
	closeButton.borderRadius = 4
	closeButton.width = 20
	closeButton.height = 20
	closeButton.justifyContent = 'center'
	closeButton.alignItems = 'center'

	const closeText = app.create('uitext')
	closeText.value = 'X'
	closeText.color = COLORS.slate200
	closeText.fontSize = 12
	closeText.textAlign = 'center'
	closeButton.add(closeText)

	closeButton.onPointerEnter = () => {
		closeButton.backgroundColor = COLORS.slate500
	}

	closeButton.onPointerLeave = () => {
		closeButton.backgroundColor = COLORS.slate600
	}

	closeButton.onPointerDown = () => {
		app.remove(detail)
		detailView = null
	}

	buttonContainer.add(closeButton)
	detail.add(buttonContainer)

	app.add(detail)
	detailView = detail
}

function init() {
	const mainBoard = createMainInterface()
	app.add(mainBoard)
}

init()