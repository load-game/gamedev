import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateAppServerWorldUrl } from '../../app-server/helpers.js'

test('validateAppServerWorldUrl accepts direct runtime and pretty world URLs', () => {
  const direct = validateAppServerWorldUrl('http://localhost:3000')
  assert.equal(direct.ok, true)

  const pretty = validateAppServerWorldUrl('https://dev.lobby.ws/worlds/my-world')
  assert.equal(pretty.ok, true)
  assert.equal(pretty.isPrettyWorldUrl, true)
})

test('validateAppServerWorldUrl rejects invalid platform URL paths', () => {
  const missingSlug = validateAppServerWorldUrl('https://dev.lobby.ws')
  assert.equal(missingSlug.ok, false)
  assert.match(missingSlug.errors[0] || '', /\/worlds\/<slug>/)

  const apiPath = validateAppServerWorldUrl('https://dev.lobby.ws/api')
  assert.equal(apiPath.ok, false)
  assert.match(apiPath.errors[0] || '', /\/api/)

  const invalidPrettyPath = validateAppServerWorldUrl('https://dev.lobby.ws/worlds/my-world/admin')
  assert.equal(invalidPrettyPath.ok, false)
  assert.match(invalidPrettyPath.errors[0] || '', /\/worlds\/<slug>/)
})
