# Avatar

Renders a VRM avatar

Avatars with standard VRM blink morph bindings blink automatically. Each avatar
instance has its own timing and morph weights, including previews and local or
remote players. A combined blink preset is preferred; separate left/right
presets are supported when it is absent. Models without these bindings keep
their original behavior. Eyelid animation pauses with the avatar.

```jsx
const src = props.avatar?.url
const emote = props.emote?.url
const avatar = app.create('avatar', { src, emote })
app.add(avatar)
```

## Properties

### `.src`: String

An asset url (eg from props) or an absolute URL to a `.vrm` file.

### `.emote`: String

An emote url (eg from props) or an absolute URL to a `.glb` file with an emote animation.

### `.visible`: Boolean

Whether the avatar is visible or not. 

## Methods

### `.getHeight()`: Number

Returns the height of the avatar in meters. This might be `null` if the avatar hasn't loaded yet. Read-only. 

### `.getBoneTransform(boneName)`: Matrix4

Returns a matrix of the bone transform in world space.

```jsx
const matrix = avatar.getBoneTransform('rightHand')
weapon.position.setFromMatrixPosition(matrix)
weapon.quaternion.setFromRotationMatrix(matrix)
```

Note that VRM avatars have required and optional bones, and in some cases incuding while avatars are loading this method may return null.

The VRM spec defines the following bones as required:

```
hips, spine, chest, neck, head, leftShoulder, leftUpperArm, leftLowerArm, leftHand, rightShoulder, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, leftToes, rightUpperLeg, rightLowerLeg, rightFoot, rightToes
```

### `.{...Node}`

Inherits all [Node](/docs/scripting/nodes/Node.md) properties
