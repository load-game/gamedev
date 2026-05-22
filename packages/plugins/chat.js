import { definePlugin } from '../core/plugins.js'
import { Chat } from './chat/Chat.js'

export { Chat }

export const chatScriptApi = Object.freeze({
  world: Object.freeze({
    chat(entity, msg, broadcast) {
      if (!msg) return
      entity.world.chat.add(msg, broadcast)
    },
  }),
})

export const chatPlugin = definePlugin({
  name: '@gamedev/plugin-chat',
  requires: ['core'],
  provides: ['chat'],
  systems: [['chat', Chat]],
  scripts: chatScriptApi,
})
