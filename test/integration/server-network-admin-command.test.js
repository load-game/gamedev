import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Ranks } from '../../src/core/extras/ranks.js'
import { ServerNetwork } from '../../src/core/systems/ServerNetwork.js'

function createServerNetworkForAdminCommandTest(auth) {
  const sentPackets = []
  const dbUpdates = []
  const eventEmits = []
  const player = {
    data: {
      id: 'player-1',
      userId: 'user-1',
      rank: Ranks.VISITOR,
    },
    isAdmin() {
      return this.data.rank >= Ranks.ADMIN
    },
    isBuilder() {
      return this.data.rank >= Ranks.BUILDER
    },
    modify(changes) {
      Object.assign(this.data, changes)
    },
  }
  const world = {
    chat: {
      add() {},
    },
    events: {
      emit(name, payload) {
        eventEmits.push({ name, payload })
      },
    },
    monitor: {
      async getStats() {
        return {
          currentCPU: 0,
          currentMemory: 0,
          maxMemory: 0,
        }
      },
    },
  }
  const network = new ServerNetwork(world)
  clearInterval(network.socketIntervalId)
  network.auth = auth
  network.send = (name, data) => {
    sentPackets.push({ name, data })
  }
  network.db = () => ({
    where(column, value) {
      return {
        async update(data) {
          dbUpdates.push({ column, value, data })
        },
      }
    },
  })
  const socket = {
    id: 'socket-1',
    player,
    send(name, data) {
      sentPackets.push({ name, data })
    },
  }
  return { network, socket, player, sentPackets, dbUpdates, eventEmits }
}

async function withCapturedConsole(method, fn) {
  const original = console[method]
  const entries = []
  console[method] = value => {
    entries.push(value)
  }
  try {
    await fn(entries)
  } finally {
    console[method] = original
  }
}

test('hosted runtimes ignore /admin <code> chat escalation', async () => {
  const previousAdminCode = process.env.ADMIN_CODE
  process.env.ADMIN_CODE = 'secret-code'
  const { network, socket, player, sentPackets, dbUpdates, eventEmits } = createServerNetworkForAdminCommandTest({
    admin: {
      kind: 'player_token',
      codeConfigured: false,
      openAccess: false,
    },
  })
  try {
    await withCapturedConsole('warn', async entries => {
      await network.onCommand(socket, {
        cmd: 'admin',
        args: ['/admin', 'secret-code'],
      })

      assert.equal(entries.length, 1)
      assert.deepEqual(JSON.parse(entries[0]), {
        component: 'server_network',
        event: 'chat_admin_code',
        transport: 'chat',
        admin_auth_kind: 'player_token',
        auth_result: 'rejected',
        hosted_admin_code_rejected: true,
        reason: 'hosted_admin_code_rejected',
        player_id: 'player-1',
        user_id: 'user-1',
        world_id: null,
      })
    })

    assert.equal(player.data.rank, Ranks.VISITOR)
    assert.equal(sentPackets.length, 0)
    assert.equal(dbUpdates.length, 0)
    assert.equal(eventEmits.length, 0)
  } finally {
    process.env.ADMIN_CODE = previousAdminCode
  }
})

test('standalone runtimes still allow /admin <code> chat escalation', async () => {
  const previousAdminCode = process.env.ADMIN_CODE
  process.env.ADMIN_CODE = 'secret-code'
  const { network, socket, player, sentPackets, dbUpdates, eventEmits } = createServerNetworkForAdminCommandTest({
    admin: {
      kind: 'admin_code',
      codeConfigured: true,
      openAccess: false,
    },
  })
  try {
    await withCapturedConsole('info', async entries => {
      await network.onCommand(socket, {
        cmd: 'admin',
        args: ['/admin', 'secret-code'],
      })

      assert.equal(entries.length, 1)
      assert.deepEqual(JSON.parse(entries[0]), {
        component: 'server_network',
        event: 'chat_admin_code',
        transport: 'chat',
        admin_auth_kind: 'admin_code',
        auth_result: 'accepted',
        hosted_admin_code_rejected: false,
        reason: 'admin_granted',
        player_id: 'player-1',
        user_id: 'user-1',
        world_id: null,
      })
    })

    assert.equal(player.data.rank, Ranks.ADMIN)
    assert.deepEqual(sentPackets[0], {
      name: 'entityModified',
      data: { id: 'player-1', rank: Ranks.ADMIN },
    })
    assert.equal(sentPackets[1].name, 'chatAdded')
    assert.match(sentPackets[1].data.body, /Admin granted!/)
    assert.deepEqual(dbUpdates, [
      {
        column: 'id',
        value: 'user-1',
        data: { rank: Ranks.ADMIN },
      },
    ])
    assert.equal(eventEmits.length, 0)
  } finally {
    process.env.ADMIN_CODE = previousAdminCode
  }
})
