# Commands

There are a few commands that can be used by entering them in the chat.

### `/admin <code>`

Standalone runtimes with `ADMIN_CODE` set can use this command to grant or revoke admin for the current player.

Hosted slug worlds ignore `/admin <code>` and require a valid Lobby-backed runtime session instead.
For SDK/app-server setup against hosted worlds, use `WORLD_AUTH_TOKEN` instead of `ADMIN_CODE`.

If a standalone runtime does not set `ADMIN_CODE`, admin access is open instead of using this command.

See your `.env` file for the configured standalone admin code.

### `/spawn set`

Sets the spawn point for all future players entering the world, to the current position and direction you are facing. Requires builder rank.

### `/spawn clear`

Resets the spawn point back to origin. Requires builder rank.

### `/name <name>`

Sets your player name.

### `/chat clear`

Clears all chat messages. Requires builder rank. 

## Script commands

App scripts can listen for slash commands through `world.on('command', callback)`.

The callback receives:

- `playerId`
- `cmd`
- `value`
- `args`

Example:

```javascript
export default (world, app) => {
  function onCommand({ playerId, cmd, args }) {
    if (!world.isServer) return
    if (cmd !== 'tower') return

    const market = args[2]
    if (!market) return

    app.sendTo(playerId, 'towerCommand', { market })
  }

  world.on('command', onCommand)
  app.on('destroy', () => {
    world.off('command', onCommand)
  })
}
```

Notes:

- Slash commands are global. There is no per-app registration API in scripts right now, so choose unique command names and filter inside your handler.
- For reliable gameplay logic, handle commands on the server.
- Built-in runtime commands such as `/admin`, `/name`, and `/spawn` are reserved.
