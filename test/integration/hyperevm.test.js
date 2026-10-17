import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { EVM as ServerEVM } from '../../packages/extra-systems/systems/EVMServer.js'
import { EVM as ClientEVM } from '../../packages/extra-systems/systems/EVMClient.js'

for (const [name, EVM] of [
  ['server', ServerEVM],
  ['client', ClientEVM],
]) {
  test(`${name}: HyperEVM reads use the bound public chain without connecting a wallet`, async () => {
    const evm = new EVM({}),
      calls = []
    evm.publicClients.set(999, {
      getChainId: async () => 999,
      readContract: async request => {
        calls.push(request)
        return 3321n
      },
    })
    const api = evm.getRuntimeAPI(999)
    assert.equal(await api.getChainId(), 999)
    assert.equal(await api.getRpcChainId(), 999)
    const request = {
      address: '0x9125e2d6827a00b0f8330d6ef7bef07730bac685',
      abi: [],
      functionName: 'tokenOfOwnerByIndex',
      args: ['0x' + 'a'.repeat(40), 0n],
      blockNumber: 100n,
    }
    assert.equal(await api.readContract(request), 3321n)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].address, request.address)
    assert.equal(calls[0].blockNumber, 100n)
    assert.equal(await evm.getRuntimeAPI(1).getChainId(), 1)
    assert.throws(() => evm.getRuntimeAPI(998), /Unsupported/)
  })
}
