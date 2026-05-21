import { definePlugin } from '../../plugins.js'
import { Particles } from './Particles.js'

export { Particles }

export const particlesClientPlugin = definePlugin({
  name: '@gamedev/plugin-particles/client',
  requires: ['core', 'client', 'loader', 'loader:texture', 'stage'],
  provides: ['@gamedev/plugin-particles', 'particles'],
  systems: [['particles', Particles]],
})
