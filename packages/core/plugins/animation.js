import { definePlugin } from '../plugins.js'
import { Animation } from '../systems/Animation.js'

export { Animation }

export const animationPlugin = definePlugin({
  name: '@gamedev/plugin-animation',
  requires: ['core', 'entities', 'view'],
  provides: ['@gamedev/plugin-animation'],
  systems: [['animation', Animation]],
})
