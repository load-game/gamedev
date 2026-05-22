import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'vite-plus/test'

import { admin } from '../../packages/server/admin.js'

function createFastifyStub() {
  const routes = []
  return {
    routes,
    log: {
      info() {},
    },
    addHook() {},
    route(route) {
      routes.push(route)
    },
    get(url, handler) {
      routes.push({ method: 'GET', url, handler })
    },
    post(url, handler) {
      routes.push({ method: 'POST', url, handler })
    },
    put(url, handler) {
      routes.push({ method: 'PUT', url, handler })
    },
    delete(url, handler) {
      routes.push({ method: 'DELETE', url, handler })
    },
  }
}

function createReplyStub() {
  return {
    statusCode: 200,
    body: undefined,
    code(statusCode) {
      this.statusCode = statusCode
      return this
    },
    send(body) {
      this.body = body
      return this
    },
  }
}

test('admin plugin no longer serves a standalone /admin browser experience', async () => {
  const fastify = createFastifyStub()
  const network = new EventEmitter()
  network.spawn = null
  const world = {
    network,
    settings: { serialize: () => ({}) },
    blueprints: { serialize: () => [] },
    entities: {
      serialize: () => [],
      players: new Map(),
    },
  }

  await admin(fastify, { world, assets: { url: '' } })

  const adminRoute = fastify.routes.find(route => route.method === 'GET' && route.url === '/admin')
  assert.ok(adminRoute)

  const reply = createReplyStub()
  await adminRoute.handler({}, reply)
  assert.equal(reply.statusCode, 404)
  assert.equal(reply.body, undefined)

  assert.ok(fastify.routes.some(route => route.method === 'GET' && route.url === '/admin/snapshot'))
})
