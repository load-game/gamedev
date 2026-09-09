# UIInput

A text input field rendered in 3D world space using CSS3D. Allows players to type text, supporting focus, blur, and submit events.

When players click on a UIInput, their pointer is unlocked so they can interact with the native input element.

## Properties

### `.value`: String

The current text value of the input. Defaults to `''`.

### `.placeholder`: String

Placeholder text shown when the input is empty. Defaults to `''`.

### `.width`: Number

Width of the input in pixels (before scaling by factor). Defaults to `200`.

### `.height`: Number

Height of the input in pixels (before scaling by factor). Defaults to `32`.

### `.factor`: Number

Resolution scaling factor. The actual size in meters is `width / factor` by `height / factor`. Defaults to `100`.

For example, with `width: 200` and `factor: 100`, the input is 2 meters wide.

### `.fontSize`: Number

Font size in pixels. Defaults to `14`.

### `.color`: String

Text color. Defaults to `'#000000'`.

### `.backgroundColor`: String

Background color of the input. Defaults to `'#ffffff'`.

### `.borderWidth`: Number

Border width in pixels. Defaults to `1`.

### `.borderColor`: String

Border color. Defaults to `'#cccccc'`.

### `.borderRadius`: Number

Border radius in pixels. Defaults to `4`.

### `.padding`: Number

Inner padding in pixels. Defaults to `8`.

### `.disabled`: Boolean

Whether the input is disabled. Defaults to `false`.

### `.onFocus`: Function

Callback triggered when the input receives focus.

```javascript
input.onFocus = () => {
  console.log('Input focused')
}
```

### `.onBlur`: Function

Callback triggered when the input loses focus.

```javascript
input.onBlur = () => {
  console.log('Input blurred')
}
```

### `.onChange`: Function

Callback triggered when the input value changes. Receives the new value as an argument.

```javascript
input.onChange = (value) => {
  console.log('Value changed:', value)
}
```

### `.onSubmit`: Function

Callback triggered when the user presses Enter. Receives the current value as an argument.

```javascript
input.onSubmit = (value) => {
  console.log('Submitted:', value)
}
```

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties.

## Methods

### `.focus()`

Programmatically focuses the input.

### `.blur()`

Programmatically blurs the input.

## Example

```javascript
const input = app.create('uiinput', {
  placeholder: 'Type a message...',
  width: 300,
  height: 36,
  fontSize: 14,
  position: [0, 2, 0],
  onSubmit: (value) => {
    console.log('Message:', value)
    input.value = ''
  },
})
app.add(input)
```
### `.type`: String

Native input type, default `text`. `button` creates a keyboard-accessible
world-space action whose pointer click or Enter key invokes `onSubmit`.
Use `value` for its visible label, `disabled` to prevent activation, and the
same `focus()` / `onFocus` API for keyboard navigation. Nodes retain browser
focus and text selection when their properties update without rebuilding.

`fontFamily` accepts a CSS font-family string (default `Space Mono, monospace`).
`onKeyDown({key, code, shiftKey})` receives keyboard data without a DOM event.
Return `true` to consume the key and replace the default behavior, for example
for a Tab focus loop or Escape closing a world-space form. Other keys retain
native input behavior. `onSubmit` still handles Enter when not consumed.
