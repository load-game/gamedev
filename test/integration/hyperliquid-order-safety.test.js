import assert from 'node:assert/strict'
import { test } from 'vite-plus/test'
import { Hyperliquid } from '@gamedev/extra-systems'

const address = '0x00000000000000000000000000000000000000AA'
function fixture() {
  const hl = new Hyperliquid({})
  const orders = []
  hl.address = address
  hl.walletAdapter = {}
  hl.exchangeClient = {
    order: async payload => {
      orders.push(payload)
      return payload
    },
  }
  hl._resolveMarketDescriptor = async ticker => ({ ticker, marketType: 'perp', assetId: 0, szDecimals: 3 })
  hl.getPrice = async () => 100
  return { hl, orders }
}

test('closing long and short perps always submits reduce-only IOC orders', async () => {
  for (const size of [2, -2]) {
    const { hl, orders } = fixture()
    hl.getPositions = async () => [{ ticker: 'BTC', size }]
    await hl.closePosition('BTC', 1, { cloid: '0x1234567890abcdef1234567890abcdef' })
    assert.equal(orders.length, 1)
    assert.equal(orders[0].orders[0].r, true)
    assert.equal(orders[0].orders[0].b, size < 0)
    assert.equal(orders[0].orders[0].c, '0x1234567890abcdef1234567890abcdef')
    assert.equal(orders[0].orders[0].t.limit.tif, 'Ioc')
  }
})

test('wallet changes while loading a price cannot place an order from the new account', async () => {
  for (const side of ['buy', 'sell']) {
    const { hl, orders } = fixture()
    hl.getPrice = async () => {
      hl.walletGeneration++
      return 100
    }
    await assert.rejects(hl[side]('BTC', 1), /Wallet changed/)
    assert.equal(orders.length, 0)
  }
})

test('closing cannot use another wallet position after account refresh', async () => {
  const { hl, orders } = fixture()
  hl.getPositions = async () => {
    hl.address = '0x00000000000000000000000000000000000000BB'
    return [{ ticker: 'BTC', size: 2 }]
  }
  await assert.rejects(hl.closePosition('BTC'), /Wallet changed/)
  assert.equal(orders.length, 0)
})

test('invalid slippage never reaches exchange submission', async () => {
  const { hl, orders } = fixture()
  for (const slippage of [NaN, Infinity, -1, 100]) await assert.rejects(hl.buy('BTC', 1, slippage), /Slippage/)
  assert.equal(orders.length, 0)
  assert.equal(hl.getRuntimeAPI().getCapabilities().orderSafety, 1)
})

test('leverage cannot be changed for a wallet that changed during market discovery', async () => {
  const { hl } = fixture()
  let called = false
  hl.exchangeClient.updateLeverage = async () => {
    called = true
  }
  hl._resolveMarketDescriptor = async () => {
    hl.walletGeneration++
    return { ticker: 'BTC', marketType: 'perp', assetId: 0 }
  }
  await assert.rejects(hl.updateLeverage('BTC', 2), /Wallet changed/)
  assert.equal(called, false)
})

test('deposit cannot continue after wallet changes during balance lookup', async () => {
  const { hl } = fixture()
  let transfers = 0
  hl._ensureArbitrum = async () => {}
  hl.walletAdapter.readContract = async () => {
    hl.walletGeneration++
    return 20_000_000n
  }
  hl.walletAdapter.writeContract = async () => {
    transfers++
    return '0x123'
  }
  await assert.rejects(hl.deposit(10), /Wallet changed/)
  assert.equal(transfers, 0)
  assert.equal(hl.pendingDeposit, false)
})

test('reverted deposits are not reported as successful', async () => {
  const { hl } = fixture()
  hl._ensureArbitrum = async () => {}
  hl.walletAdapter.readContract = async () => 20_000_000n
  hl.walletAdapter.writeContract = async () => '0x123'
  hl.walletAdapter.waitForTransactionReceipt = async () => ({ status: 'reverted', transactionHash: '0x123' })
  await assert.rejects(hl.deposit(10), /did not succeed/)
})

test('referral setup cannot sign for a wallet changed during lookup', async () => {
  const { hl } = fixture()
  let called = false
  hl.infoClient = {
    referral: async () => {
      hl.walletGeneration++
      return { referredBy: null }
    },
  }
  hl._createUserExchangeClient = () => ({
    setReferrer: async () => {
      called = true
    },
  })
  await assert.rejects(hl._setConfiguredReferrerIfNeeded(), /Wallet changed/)
  assert.equal(called, false)
})

test('missing live mids cannot fall back to a cached catalog price for a trade', async () => {
  const { hl, orders } = fixture()
  hl.getPrice = Hyperliquid.prototype.getPrice
  hl._resolveMarketDescriptor = async () => ({
    ticker: 'BTC',
    marketType: 'perp',
    assetId: 0,
    szDecimals: 3,
    midPrice: 100,
  })
  hl._getAllMids = async () => ({})
  await assert.rejects(hl.buy('BTC', 1), /No price/)
  assert.equal(orders.length, 0)
})
