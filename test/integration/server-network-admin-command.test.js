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
    await network.onCommand(socket, {
      cmd: 'admin',
      args: ['/admin', 'secret-code'],
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
    await network.onCommand(socket, {
      cmd: 'admin',
      args: ['/admin', 'secret-code'],
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
